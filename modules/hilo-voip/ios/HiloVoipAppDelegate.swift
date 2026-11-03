import ExpoModulesCore
import PushKit

/// The family pressed "Llamar ahora": the Edge Function ring sends a VoIP push that wakes the phone,
/// even locked or with Hilo closed. iOS requires showing it as a call at once, or it stops delivering them.
public class HiloVoipAppDelegate: ExpoAppDelegateSubscriber, PKPushRegistryDelegate {
  static var token: String?
  static var onToken: ((String) -> Void)?
  private var registry: PKPushRegistry?

  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let registry = PKPushRegistry(queue: .main)
    registry.delegate = self
    registry.desiredPushTypes = [.voIP]
    self.registry = registry
    return true
  }

  public func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
    let token = credentials.token.map { String(format: "%02x", $0) }.joined()
    Self.token = token
    Self.onToken?(token)
  }

  public func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    let data = payload.dictionaryPayload
    // The ring's id from the server: her answer marks that row
    let uuid = data["uuid"] as? String ?? UUID().uuidString
    let caller = data["caller"] as? String ?? "Hilo"
    // RNCallKeep found at runtime, not imported: importing it into Swift broke the app's React import
    let selector = NSSelectorFromString(
      "reportNewIncomingCall:handle:handleType:hasVideo:localizedCallerName:supportsHolding:supportsDTMF:"
        + "supportsGrouping:supportsUngrouping:fromPushKit:payload:withCompletionHandler:")
    guard let callKeep = NSClassFromString("RNCallKeep"), let method = class_getClassMethod(callKeep, selector) else {
      return completion()
    }
    typealias Report = @convention(c) (
      AnyClass, Selector, NSString, NSString, NSString, Bool, NSString, Bool, Bool, Bool, Bool, Bool, NSDictionary,
      @convention(block) () -> Void
    ) -> Void
    let report = unsafeBitCast(method_getImplementation(method), to: Report.self)
    report(
      callKeep, selector, uuid as NSString, "Hilo", "generic", false, caller as NSString,
      false, false, false, false, true, data as NSDictionary, completion)
  }
}
