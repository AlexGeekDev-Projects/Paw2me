import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore 


@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    // ⚙️ Configuración explícita de Firebase (sin depender del plist copiado)
    if FirebaseApp.app() == nil {
      let options = FirebaseOptions(googleAppID: "1:224492382935:ios:952927362088eab8e55e92",
                                    gcmSenderID: "224492382935")
      options.apiKey       = "AIzaSyAQirQ5-Ie0ErDox_EMfj8EkO0Wy4aoOwQ"
      options.projectID    = "paw-2me"
      options.bundleID     = "org.reactjs.native.example.Paw2me"
      // 🔧 Bucket correcto suele ser appspot.com, no firebasestorage.app
      options.storageBucket = "paw-2me.appspot.com"
      FirebaseApp.configure(options: options)
    }

    factory.startReactNative(
      withModuleName: "Paw2me",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
