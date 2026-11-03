import ExpoModulesCore

/// The phone's VoIP token for JS, which saves it for the server (save_voip_token)
public class HiloVoipModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HiloVoip")
    Events("onToken")

    Function("getToken") { HiloVoipAppDelegate.token }

    OnStartObserving {
      HiloVoipAppDelegate.onToken = { [weak self] token in
        self?.sendEvent("onToken", ["token": token])
      }
    }
    OnStopObserving {
      HiloVoipAppDelegate.onToken = nil
    }
  }
}
