Pod::Spec.new do |s|
  s.name           = 'HiloVoip'
  s.version        = '1.0.0'
  s.summary        = 'Hilo rings like a call: VoIP pushes shown with CallKit'
  s.author         = 'Hilo'
  s.homepage       = 'https://hilo-app-beta.vercel.app'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
