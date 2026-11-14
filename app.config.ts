import type { ExpoConfig, ConfigContext } from 'expo/config';
import fs from 'node:fs';

/**
 * Clockyn — Expo app configuration.
 *
 * Everything environment-specific (store ids, API keys, push credentials) comes from env vars so no
 * credentials live in the repository. See `.env.example`.
 */
const APP_ID = process.env.APP_ID ?? 'com.clockyn.app';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || 'dcae5d96-b513-4274-94b7-79167b05283a';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';
const GOOGLE_SERVICES_JSON = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';
const GOOGLE_SERVICE_INFO_PLIST = process.env.GOOGLE_SERVICE_INFO_PLIST ?? './GoogleService-Info.plist';

// The app has no default backend address (src/config/env.ts). On EAS build servers (EAS_BUILD=true) a build without one would ship an app that
// cannot reach any backend, so stop it here with a clear message. Create the variable for the profile's environment:
//   eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://your-backend-address --environment preview --visibility plaintext
if (process.env.EAS_BUILD === 'true' && !(process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim()) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL is not set for this EAS environment. Add it with `eas env:create` (see the Expo build tab of clockyn_run_commands.html), then build again.');
}

// Native push (FCM) needs per-environment Firebase files. Only wire the Firebase config plugin when
// they exist so the app still prebuilds/runs (without push) in environments that don't have them.
const hasAndroidFirebase = fs.existsSync(GOOGLE_SERVICES_JSON);
const hasIosFirebase = fs.existsSync(GOOGLE_SERVICE_INFO_PLIST);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Clockyn',
  slug: 'clockyn',
  scheme: 'clockyn',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#0A0A0A',
  ios: {
    supportsTablet: true,
    bundleIdentifier: APP_ID,
    ...(hasIosFirebase ? { googleServicesFile: GOOGLE_SERVICE_INFO_PLIST } : {}),
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // No `location` (background tracking is Android-only) and no `fetch` (no background-fetch task is used).
      // `remote-notification` lets FCM data messages wake the app. Usage-description strings live in the
      // plugin options below (camera / photos / location) because the plugins write those keys.
      UIBackgroundModes: ['remote-notification'],
    },
  },
  android: {
    package: APP_ID,
    // Session data lives in AsyncStorage: keep it out of Auto Backup / device-to-device transfers.
    allowBackup: false,
    // Expo adds SYSTEM_ALERT_WINDOW by default; release builds do not need it (the debug manifest keeps it for the dev menu).
    blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'],
    adaptiveIcon: {
      backgroundColor: '#0A0A0A',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    ...(hasAndroidFirebase ? { googleServicesFile: GOOGLE_SERVICES_JSON } : {}),
    permissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.CAMERA',
      'android.permission.READ_MEDIA_IMAGES',
    ],
    config: GOOGLE_MAPS_API_KEY ? { googleMaps: { apiKey: GOOGLE_MAPS_API_KEY } } : undefined,
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-image',
    'expo-sharing',
    '@react-native-community/datetimepicker',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 200, resizeMode: 'contain', backgroundColor: '#F2F1EE', dark: { image: './assets/splash-icon-dark.png', backgroundColor: '#0A0A0A' } }],
    // The app only captures stills (never audio/video), so the microphone permission is not requested.
    ['expo-camera', { cameraPermission: 'Allow Clockyn to use your camera for face verification, profile photos and photos shared in chat.', microphonePermission: false, recordAudioAndroid: false }],
    ['expo-image-picker', { photosPermission: 'Allow Clockyn to access your photos for profile pictures, receipts and sharing in chat.', cameraPermission: 'Allow Clockyn to use your camera for face verification, profile photos and photos shared in chat.', microphonePermission: false }],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Allow Clockyn to use your location while the app is open to verify attendance and log field-staff visit locations.',
        // iOS never tracks in the background (Android-only policy): do not ship the "Always" / motion / full-accuracy strings.
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        locationFullAccuracyPermission: false,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        androidForegroundServiceIcon: './assets/notification-icon.png',
      },
    ],
    // `defaultChannel` = FCM default channel: pushes shown by the OS while the app is closed use the MAX-importance channel created at runtime.
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#06C270', defaultChannel: 'attendance_notifications' }],
    // Platform-aware wrapper around the `@react-native-firebase/app` plugin: applies each half only when its file exists
    // (the stock plugin throws for the platform without a file) and adds iOS `FirebaseApp.configure()` (the stock
    // plugin cannot find its AppDelegate anchor in the SDK 58 template). See plugins/withFirebase.js.
    ...(hasAndroidFirebase || hasIosFirebase ? [['./plugins/withFirebase', { android: hasAndroidFirebase, ios: hasIosFirebase }] as [string, object]] : []),
    // expo-task-manager's plugin force-adds the iOS `fetch` background mode; the app does not use it.
    './plugins/withIosBackgroundModes',
  ],
  experiments: { typedRoutes: true },
  extra: {
    router: {},
    // `android.config` (where the key lives) is stripped from the runtime manifest; the map component needs to know
    // whether a key was baked into this build (Android without one would crash natively when a map view is created).
    googleMapsKeyConfigured: Boolean(GOOGLE_MAPS_API_KEY),
    eas: { projectId: EAS_PROJECT_ID },
  },
});
