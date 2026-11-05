/**
 * Expo config plugin — platform-aware wrapper around `@react-native-firebase/app`'s config plugin.
 *
 * The stock RNFB plugin applies its iOS *and* Android halves unconditionally, and each half throws when its
 * Firebase file (`expo.ios.googleServicesFile` / `expo.android.googleServicesFile`) is not configured. That
 * breaks e.g. `eas build -p android` when only GOOGLE_SERVICES_JSON is provided. `app.config.ts` tells this wrapper
 * which files exist and only the matching halves are applied. iOS additionally gets `FirebaseApp.configure()`
 * (see ./withIosFirebaseConfigure.js).
 *
 * Props: `{ android: boolean, ios: boolean }`.
 */
const path = require('node:path');
const { withPlugins } = require('expo/config-plugins');

// The package `exports` map does not expose the plugin's internals, so load them by file path.
const rnfbRoot = path.dirname(require.resolve('@react-native-firebase/app/package.json'));
const rnfbIos = require(path.join(rnfbRoot, 'plugin', 'build', 'ios'));
const rnfbAndroid = require(path.join(rnfbRoot, 'plugin', 'build', 'android'));
const withIosFirebaseConfigure = require('./withIosFirebaseConfigure');

/** @type {import('expo/config-plugins').ConfigPlugin<{ android?: boolean; ios?: boolean }>} */
const withFirebase = (config, props = {}) => {
  const plugins = [];
  if (props.ios) {
    plugins.push(rnfbIos.withFirebaseAppDelegate, rnfbIos.withIosGoogleServicesFile, withIosFirebaseConfigure);
  }
  if (props.android) {
    plugins.push(
      rnfbAndroid.withBuildscriptDependency,
      rnfbAndroid.withApplyGoogleServicesPlugin,
      rnfbAndroid.withCopyAndroidGoogleServices,
    );
  }
  return withPlugins(config, plugins);
};

module.exports = withFirebase;
