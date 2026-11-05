# N1 - Native build-readiness audit (no device)

Date: 2026-10-18. Scope: everything provable without a device or Mac/Android SDK. Prebuild ran in a scratch copy of the project config (junctioned `node_modules`); generated `android/` and `ios/` were deleted afterwards. Local toolchain: Windows, Java 8, no Android SDK, no Xcode, so no Gradle or CocoaPods build could be run.

## Summary

| # | Check | Method | Result | Fix |
|---|---|---|---|---|
| 1 | `expo-doctor` | `npx expo-doctor` (before and after edits) | 20/20 pass | none |
| 2 | `expo config --type public` / `--type prebuild` | run in project | OK, all plugins resolve | none |
| 3 | Android prebuild (baseline, no env) | `expo prebuild --no-install --clean --platform android` | Pass | manifest hardening, see below |
| 4 | iOS prebuild (baseline) | Expo skips iOS on Windows; ran the CLI with a platform shim limited to that one check | Pass; Info.plist, entitlements, xcassets, Podfile generated | usage keys / background modes cleaned |
| 5 | Variant with `GOOGLE_MAPS_API_KEY`, `GOOGLE_SERVICES_JSON`, `GOOGLE_SERVICE_INFO_PLIST` (dummy files in the scratch dir only), `APP_ID=com.example.dummyid` | prebuild both platforms | Pass after fixes. Maps meta-data present only with the key; google-services Gradle plugin + copied json; plist added to Xcode project; applicationId and bundle id follow `APP_ID` | Firebase plugin wrapper, iOS `FirebaseApp.configure()` |
| 6 | Only one Firebase file present | prebuild each platform | Stock RNFB plugin failed for the platform without a file ("Path to ... is not defined") | `plugins/withFirebase.js` applies each half only when its file exists |
| 7 | Native JS bundles | `expo export --platform android --platform ios` (plain and Hermes bytecode) | Pass. 5.7 MB JS each (no bytecode), 8.3 MB `.hbc` each. Bundle contains `defineTask` and the location task name; no `leaflet` | none |
| 8 | `tsc --noEmit`, eslint on touched files, `npm run check:brand` | run | 0 errors, clean, passed | none |

## Findings and fixes

### Fixed

1. **iOS Firebase never configured (real bug).** `@react-native-firebase/app` inserts `FirebaseApp.configure()` above `factory.startReactNative(`, but the SDK 58 AppDelegate starts React Native from `SceneDelegate`. Prebuild printed "Unable to determine correct Firebase insertion point... Skipping" and still added `import FirebaseCore`. Fix: `plugins/withIosFirebaseConfigure.js` (idempotent, inserts the call before `let delegate = ReactNativeDelegate()`), applied through `plugins/withFirebase.js`. Verified the generated AppDelegate contains exactly one call.
2. **One-platform Firebase file broke prebuild/EAS** (item 6 above). Fixed by `plugins/withFirebase.js`, wired in `app.config.ts` with `{ android, ios }` flags.
3. **Likely Android manifest-merger conflict (not buildable here, so unverified).** `@react-native-firebase/messaging` declares `default_notification_channel_id` (empty) and `default_notification_color` (`@color/white`) meta-data, and the expo-notifications plugin writes the same keys with different values into the app manifest. Added root `firebase.json` (RNFB's documented mechanism) with `messaging_android_notification_channel_id=attendance_notifications` and `messaging_android_notification_color=@color/notification_icon_color` so both sides carry identical values. If Gradle still reports a conflict, add `tools:replace` via a manifest plugin.
4. **iOS Info.plist hygiene.** expo-location's plugin was adding `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSLocationAlwaysUsageDescription` (generic placeholder text), `NSMotionUsageDescription` and the full-accuracy dictionary although iOS never tracks in the background. Now disabled via plugin options (`false`). Location, camera and photo usage strings moved from `ios.infoPlist` into the plugin options (the plugins overwrite those keys, the richer wording now wins).
5. **`UIBackgroundModes`.** expo-task-manager's plugin force-adds `fetch`. `plugins/withIosBackgroundModes.js` removes `fetch`, `location`, `processing`. Result: only `remote-notification`. No `location` mode, as per policy.
6. **Android manifest.** Added `allowBackup=false` (session in AsyncStorage) and blocked `SYSTEM_ALERT_WINDOW` in the main manifest (Expo adds it by default; the debug manifest still declares it for the dev menu). `androidForegroundServiceIcon` (the 96x96 notification icon) now styles the background-location foreground-service notification.
7. **Notification permission without Firebase.** `registerForPush` only triggered the OS prompt through FCM `requestPermission()`. In builds without Firebase files (and Expo Go) Android 13+ never asked for POST_NOTIFICATIONS, so local notifications and the foreground-service notification were hidden. `src/lib/platform/notifications.native.ts` now asks through expo-notifications when Firebase is unavailable and `prompt !== false`.
8. **Android map crash guard.** Google Maps throws "API key not found" natively when the manifest key meta-data is missing (cannot be caught in JS). `ClockynMap.native.tsx` now shows a placeholder on Android when the build has no key (Expo Go exempt). `app.config.ts` publishes `extra.googleMapsKeyConfigured` because `android.config` is stripped from the runtime manifest. The manifest meta-data is still emitted only when the key is set.
9. **New files.** `eas.json`, `firebase.json`, `plugins/*.js`, `docs/RUNNING_ON_DEVICES.md`, README section.

### Verified OK (baseline Android manifest)

- Permissions: ACCESS_FINE/COARSE/BACKGROUND_LOCATION, FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION, POST_NOTIFICATIONS, CAMERA, RECEIVE_BOOT_COMPLETED, VIBRATE, READ_MEDIA_IMAGES, INTERNET; `RECORD_AUDIO` explicitly removed; `READ/WRITE_EXTERNAL_STORAGE` carry `maxSdkVersion=32` (from expo libraries). No Google Maps meta-data without a key. Firebase default channel/colour/icon meta-data present (`attendance_notifications`). Location services (`LocationTaskService`, `LocationForegroundService`) are declared in the expo-location library manifest with `foregroundServiceType="location"` and merge at Gradle time.
- Package `com.clockyn.app` (from `APP_ID`), scheme `clockyn` (intent filter on Android, `CFBundleURLSchemes` on iOS). `newArchEnabled=true`, `hermesEnabled=true`, `edgeToEdgeEnabled=true`. Release builds do not allow cleartext (debug manifest only). iOS `NSAllowsArbitraryLoads=false`, deployment target 16.4.
- Assets: icon 1024x1024 RGB (no alpha, as App Store requires); adaptive foreground/monochrome 1024x1024 with content inside the 66 percent safe zone (bbox 219..804); background 1024x1024; notification icon 96x96 alpha silhouette; splash 1024x1024; favicon 48x48. Generated Android mipmaps/drawables and iOS 1024 icon + splash 200/400/600 present.
- expo-router/camera/image-picker/location/notifications/datetimepicker/splash/sharing/font/image plugins all applied; maps needs no plugin (key via `android.config`); no `UIBackgroundModes` `location`.

### Native-module safety (code read)

| Module | Reach / guard | Verdict |
|---|---|---|
| `expo-task-manager` + `expo-location` | `defineTask` at module scope of `location.native.ts`, imported statically by `_layout.tsx` -> `Bootstrap` -> `useLocationResume`, so it runs at JS entry (also on headless wake). Background start is in try/catch (fails soft in Expo Go), Android-only, requires "Allow all the time". Upload needs no auth token (no Authorization header; user id in payload), so no hydration race in the headless task | OK; device-verify kill/wake |
| `@react-native-firebase/messaging` | Only via guarded `require` + `getMessaging()` in `loadFirebase()`; null result disables push, listeners and token | OK. `setBackgroundMessageHandler` is registered lazily on first `loadFirebase()` (after login). Notification-payload pushes are OS-displayed so this is fine; data-only background messages before the first load only produce an RNFB "no headless task" warning |
| `expo-notifications` | Handler set in `configure()` (called by every public entry); channel `attendance_notifications` MAX created before token/prompt; expo-notifications' FCM service has priority -1, RNFB's service wins. Remote push is not available in Expo Go (local only) | OK |
| `expo-camera`, `expo-image-picker` | Permission requested before use; denied path handled; no microphone | OK |
| `react-native-maps` | Android Google (needs key; guard added), iOS Apple Maps (no key); single native file | OK after fix 8 |
| `react-native-webview`, `expo-print`, `expo-file-system`, `expo-sharing`, `expo-intent-launcher`, `expo-document-picker`, `expo-clipboard` | Imported only from `*.native.*` files (WebPage, payment, pdf, files, media, clipboard). `Sharing.isAvailableAsync` checked; VIEW intent falls back to the share sheet; file providers declared by the libraries | OK |
| `datetimepicker`, `expo-haptics`, `expo-blur` | Imported in shared files; all three have web support and Expo Go support; haptics wrapped | OK |
| reanimated / worklets / gesture-handler | Not imported directly in `src`; gesture root is `GestureRoot.native.tsx`; babel plugin comes from `babel-preset-expo` (no babel.config) | OK |

Android 13+/14+: POST_NOTIFICATIONS requested at runtime (FCM or fallback, fix 7); foreground-service-location type declared and permission present; background location is requested after foreground, in a separate step; the foreground service is started only while the app is foregrounded (resume on foreground), which satisfies the Android 14/15 start restrictions. Not started from BOOT_COMPLETED.

### iOS 17+ privacy manifest (noted, not exhaustively researched)

`privacy_file_aggregation_enabled` is on in the generated Podfile, so pod-level manifests are aggregated. Manifests found in `node_modules`: react-native (core, cxxreact, timing), async-storage, expo-constants, expo-file-system, expo-notifications, expo-system-ui, expo-task-manager, react-native-maps (plus the Google Maps bundle). None found for react-native-webview, datetimepicker, reanimated, gesture-handler, screens, svg, expo-print, expo-sharing (this only lists files, it does not prove those libraries use no required-reason APIs). No app-level `ios.privacyManifests` is configured. Run Xcode "Generate Privacy Report" on the first archive and fix anything App Store Connect flags.

## Remaining risks (cannot be proven without a device or Mac/SDK)

1. No Gradle or Xcode build was run: manifest merge (item 3), CocoaPods/SPM resolution and link of Firebase on iOS are unverified. RNFB 26 uses SPM by default and documents it as requiring dynamic frameworks; if `pod install` or link fails, set `ios.useFrameworks: "dynamic"` (needs `expo-build-properties`) or `ios.disableSPM: true` in the Firebase plugin props (pass it through `plugins/withFirebase.js`, which currently drops props).
2. `aps-environment` is generated as `development`; EAS distribution signing rewrites it for store/ad hoc builds, confirm in the first preview/production build. APNs key must be uploaded to Firebase.
3. Background location survival across OEM battery optimisers, Android 14 FGS notification behaviour and the kill/wake path need the device script (items 5-7 in `docs/RUNNING_ON_DEVICES.md`).
4. Razorpay in a WebView: UPI deep links (`upi:`/`intent:`) via `Linking.openURL` need real-device confirmation.
5. READ_MEDIA_IMAGES stays declared because the Permissions screen uses the media-library permission API; Play Console's photo/video permission declaration may ask for justification. Dropping it means removing the "photos" row from that screen.
6. `extra.eas.projectId` is empty until `eas init`/`EAS_PROJECT_ID` is set. `eas.json` was not validated by eas-cli (no login in this environment).
7. Expo Go for SDK 58 must be available for the store version in use; Expo Go cannot exercise push, background location or deep links.
