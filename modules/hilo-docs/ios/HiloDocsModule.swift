import ExpoModulesCore
import PDFKit
import UIKit
import Vision
import VisionKit

/// Hilo's documents, read on the phone. Nothing here touches the network.
/// - recognize(uri): the text of a photo (Vision) or a PDF (its own text, or Vision on its pages if it's a scan)
/// - scan(): the system document scanner (finds the edges, straightens the page); the pages become one PDF
///   in the temporary folder, and their text is read on the way
public class HiloDocsModule: Module {
  private var scanning: ScanDelegate?

  public func definition() -> ModuleDefinition {
    Name("HiloDocs")

    Constant("canScan") {
      VNDocumentCameraViewController.isSupported
    }

    AsyncFunction("recognize") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        promise.resolve(Reader.text(of: uri))
      }
    }

    AsyncFunction("scan") { (promise: Promise) in
      guard VNDocumentCameraViewController.isSupported,
            let top = self.appContext?.utilities?.currentViewController() else {
        promise.resolve(nil)
        return
      }
      let camera = VNDocumentCameraViewController()
      let delegate = ScanDelegate { [weak self] result in
        self?.scanning = nil
        promise.resolve(result)
      }
      self.scanning = delegate
      camera.delegate = delegate
      top.present(camera, animated: true)
    }.runOnQueue(.main)
  }
}

enum Reader {
  static let maxPages = 6

  static func text(of uri: String) -> String {
    guard let url = URL(string: uri) ?? Optional(URL(fileURLWithPath: uri)) else { return "" }
    if url.pathExtension.lowercased() == "pdf", let pdf = PDFDocument(url: url) {
      // A PDF made by a computer has its text inside; a scanned one has only pictures of pages
      let own = (pdf.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
      if own.count > 40 { return own }
      var pages: [String] = []
      for i in 0..<min(pdf.pageCount, maxPages) {
        guard let page = pdf.page(at: i) else { continue }
        let box = page.bounds(for: .mediaBox)
        let scale = 2000 / max(box.width, 1)
        let image = page.thumbnail(of: CGSize(width: box.width * scale, height: box.height * scale), for: .mediaBox)
        if let cg = image.cgImage { pages.append(ocr(cg, .up)) }
      }
      return pages.joined(separator: "\n\n")
    }
    guard let image = UIImage(contentsOfFile: url.path), let cg = image.cgImage else { return "" }
    return ocr(cg, orientation(image.imageOrientation))
  }

  static func ocr(_ image: CGImage, _ orientation: CGImagePropertyOrientation) -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.automaticallyDetectsLanguage = true
    if let supported = try? request.supportedRecognitionLanguages() {
      let wanted = ["es-ES", "ca-ES", "en-US", "nl-NL", "fr-FR", "de-DE"].filter { supported.contains($0) }
      if !wanted.isEmpty { request.recognitionLanguages = wanted }
    }
    try? VNImageRequestHandler(cgImage: image, orientation: orientation).perform([request])
    return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
  }

  static func orientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch o {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}

final class ScanDelegate: NSObject, VNDocumentCameraViewControllerDelegate {
  private let done: ([String: Any]?) -> Void

  init(_ done: @escaping ([String: Any]?) -> Void) {
    self.done = done
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
    let images = (0..<scan.pageCount).map { scan.imageOfPage(at: $0) }
    controller.dismiss(animated: true)
    DispatchQueue.global(qos: .userInitiated).async {
      // One PDF, A4 wide, each page a JPEG (small enough to lock and upload)
      let url = FileManager.default.temporaryDirectory.appendingPathComponent("scan-\(UUID().uuidString).pdf")
      let width: CGFloat = 595
      let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: width, height: 842))
      var texts: [String] = []
      do {
        try renderer.writePDF(to: url) { context in
          for image in images {
            let jpeg = image.jpegData(compressionQuality: 0.6).flatMap(UIImage.init(data:)) ?? image
            let height = width * image.size.height / max(image.size.width, 1)
            let rect = CGRect(x: 0, y: 0, width: width, height: height)
            context.beginPage(withBounds: rect, pageInfo: [:])
            jpeg.draw(in: rect)
            if texts.count < Reader.maxPages, let cg = image.cgImage {
              texts.append(Reader.ocr(cg, Reader.orientation(image.imageOrientation)))
            }
          }
        }
        let result: [String: Any] = ["uri": url.absoluteString, "pages": images.count, "text": texts.joined(separator: "\n\n")]
        DispatchQueue.main.async { self.done(result) }
      } catch {
        DispatchQueue.main.async { self.done(nil) }
      }
    }
  }

  func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
    controller.dismiss(animated: true)
    done(nil)
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
    controller.dismiss(animated: true)
    done(nil)
  }
}
