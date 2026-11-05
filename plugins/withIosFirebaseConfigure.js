/**
 * Expo config plugin — makes sure `FirebaseApp.configure()` runs in the generated iOS `AppDelegate.swift`.
 *
 * Why: `@react-native-firebase/app` inserts the call right above `factory.startReactNative(`, but the SDK 58 app
 * template starts React Native from `SceneDelegate` (scene-based life cycle), so that anchor no longer exists in
 * `AppDelegate.swift` and the plugin only prints "Unable to determine correct Firebase insertion point ...
 * Skipping Firebase addition." Without the call the Firebase default app is never created and FCM
 * (`getToken`, `onMessage`, ...) fails on iOS.
 *
 * Idempotent and safe next to the RNFB plugin: it does nothing when `FirebaseApp.configure()` is already present.
 * Only registered by `app.config.ts` when a GoogleService-Info.plist is available.
 */
const fs = require('node:fs');
const { withDangerousMod, IOSConfig } = require('expo/config-plugins');

const CONFIGURE_CALL = 'FirebaseApp.configure()';
const MARKER = '// clockyn: configure Firebase before React Native starts';

/** @param {string} contents */
function addFirebaseConfigure(contents) {
  if (contents.includes(CONFIGURE_CALL)) return contents;

  let next = contents;
  if (!/^[ \t]*import\s+FirebaseCore[ \t]*$/m.test(next)) {
    const expoImport = /^[ \t]*(?:internal\s+)?import\s+Expo[ \t]*$/m.exec(next);
    next = expoImport
      ? `${next.slice(0, expoImport.index + expoImport[0].length)}\nimport FirebaseCore${next.slice(expoImport.index + expoImport[0].length)}`
      : `import FirebaseCore\n${next}`;
  }

  // Anchors, most specific first. Each captures the line's indentation so the inserted code lines up.
  const anchors = [
    /^([ \t]*)let delegate = ReactNativeDelegate\(\)/m,
    /^([ \t]*)return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)/m,
  ];
  for (const anchor of anchors) {
    const m = anchor.exec(next);
    if (m) {
      const indent = m[1];
      return `${next.slice(0, m.index)}${indent}${MARKER}\n${indent}${CONFIGURE_CALL}\n\n${next.slice(m.index)}`;
    }
  }
  throw new Error(
    'withIosFirebaseConfigure: could not find an insertion point in AppDelegate.swift. Add `FirebaseApp.configure()` to application(_:didFinishLaunchingWithOptions:) manually.',
  );
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withIosFirebaseConfigure = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const { path, language, contents } = IOSConfig.Paths.getAppDelegate(cfg.modRequest.projectRoot);
      if (language !== 'swift') return cfg; // the Objective-C template is handled by the RNFB plugin itself
      const updated = addFirebaseConfigure(contents);
      if (updated !== contents) fs.writeFileSync(path, updated);
      return cfg;
    },
  ]);

module.exports = withIosFirebaseConfigure;
module.exports.addFirebaseConfigure = addFirebaseConfigure;
