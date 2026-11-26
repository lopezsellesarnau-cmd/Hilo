Pod::Spec.new do |s|
  s.name           = 'HiloDocs'
  s.version        = '1.0.0'
  s.summary        = 'Reads documents on the phone (Vision, PDFKit) and scans them (VisionKit)'
  s.description    = 'On-device text recognition and document scanning for Hilo. Nothing leaves the phone.'
  s.author         = 'Hilo'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Vision', 'VisionKit', 'PDFKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
  s.source_files = '**/*.{h,m,swift}'
end
