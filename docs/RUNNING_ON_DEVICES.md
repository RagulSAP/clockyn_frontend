# Running Clockyn on devices (run-it-yourself checklist)

Nothing in this repository has been executed on a physical device yet. Use this list to do the first native runs.

## 0. Prerequisites

- Node 20+ and `npm install` done. `npx expo-doctor` should report 20/20.
- Backend URL in `.env` (`EXPO_PUBLIC_API_BASE_URL`), see `.env.example`.
- For push: Firebase project with an Android app (package = `APP_ID`) and an iOS app (bundle id = `APP_ID`); download `google-services.json` and `GoogleService-Info.plist` (both are gitignored). iOS also needs an APNs auth key uploaded in Firebase.
- For Android maps: a Google Maps SDK for Android key in `GOOGLE_MAPS_API_KEY`.

## 1. Expo Go (fastest smoke test)

```bash
npx expo start            # scan the QR code with Expo Go (SDK 58 compatible version)
```

Works: navigation, login, API, camera/face punch screen, pickers, PDF/file share, maps, Razorpay WebView, haptics.
Limited: no FCM push (token is null, nothing breaks), no background location (the foreground watcher still runs), no `clockyn://` links, default icon/splash, Android 13+ notification prompt is shown by Expo Go itself.

## 2. Android dev client

Option A, EAS (no local SDK): `eas build --profile development --platform android`, install the APK, then `npx expo start --dev-client`.

Option B, local: needs JDK 17, Android SDK (platform 36 + build-tools), `ANDROID_HOME`, an emulator or USB-debugging device.

```bash
npx expo prebuild --platform android --clean     # android/ is gitignored
npx expo run:android                              # builds + installs + starts Metro
```

Set before prebuild when you want those features: `GOOGLE_MAPS_API_KEY`, `GOOGLE_SERVICES_JSON=./google-services.json`. Check `android/app/src/main/AndroidManifest.xml` contains the `com.google.android.geo.API_KEY` meta-data and that `android/app/google-services.json` exists.

## 3. iOS dev client (no Mac required)

```bash
eas device:create                                  # register the iPhone (ad hoc)
eas build --profile development --platform ios
npx expo start --dev-client
```

Local alternative on macOS with Xcode: `npx expo prebuild --platform ios --clean && npx expo run:ios`. (Prebuild on Windows cannot generate `ios/`.) The first build is also the first time CocoaPods resolves Firebase; if pod install or linking fails, see the Firebase note in `docs/qa/native-readiness-N1.md`.

## 4. Web

```bash
npx expo start --web          # dev
npm run export:web            # static SPA in dist/
```

Hosting the export: it is a single-page app (`web.output = single`). Serve `dist/` with a fallback that returns `index.html` for unknown paths (Netlify `/* /index.html 200`, Vercel rewrite `/(.*)` to `/index.html`, S3/CloudFront 403/404 error response to `/index.html` with status 200, nginx `try_files $uri /index.html`). Serve over HTTPS (geolocation and camera need a secure context).

## 5. Manual on-device test script (native-only features)

Use a field-staff account (role 2/3) on an Android 13+/14+ device and one iPhone. Reset app data between sections when a first-run prompt is under test.

| # | Feature | Steps | Expected |
| --- | --- | --- | --- |
| 1 | Notification permission (Android 13+) | Fresh install, sign in | One system "allow notifications" prompt appears (with Firebase files via FCM, without them via the app's fallback). Denying keeps the app usable |
| 2 | Face punch camera | Punch in, allow camera | Front camera preview, capture works, no audio/microphone prompt ever appears. Denying shows the "camera denied" state with an "open settings" action |
| 3 | GPS geofence | Punch in inside the branch radius, then outside | Inside: punch accepted. Outside: rejected with the distance message. Location off: "location unavailable" message, no crash |
| 4 | Foreground location prompt | First punch | While-in-use prompt only (iOS shows no "Always" option because no Always usage key is shipped) |
| 5 | Background tracking (Android only) | Punch in as field staff, grant "Allow all the time" (Settings page), background the app, lock the phone for 5+ min | Persistent "Location Tracking Active" notification (Android 14: appears even if notifications are muted for FGS). Location rows keep arriving on the backend about every 20 s |
| 6 | Background tracking after kill | With tracking active, swipe the app away | Notification stays, uploads continue (the task is defined at JS entry via the root layout import). Re-open: tracking resumes only while still punched in |
| 7 | Tracking stop | Punch out, or sign out | Notification disappears, uploads stop. A 403 from the upload endpoint also stops it |
| 8 | iOS background | Same as 5 on iPhone | No background tracking by design: foreground only, no blue location bar after backgrounding |
| 9 | FCM push, app in background | Send a test push from the Firebase console to the device token (notification + `data` payload) | System notification in the "Attendance Notifications" channel with the app icon; tapping it opens the routed screen from the payload |
| 10 | FCM push, app killed | Force-stop (Android) / swipe away (iOS), send the push, tap it | Cold start lands on the routed screen (initial notification path) |
| 11 | FCM push, foreground | Keep the app open, send a push | In-app handling (toast/banner/badge), no crash; `force_logout` data message signs the user out |
| 12 | Local notification tap | Trigger a local notification, tap it | Same routing as remote taps |
| 13 | Razorpay | Open a plan checkout | Full-screen WebView checkout, UPI app hand-off works if an UPI app is installed (verify: `upi:`/`intent:` links), success/failure/dismiss each return to the app with the right toast |
| 14 | PDF/Excel | Export a report | File is written to app storage and the share sheet opens; "Open" launches an external viewer (Android VIEW intent) or the share sheet (iOS); "Save to Downloads" on Android opens the folder picker and writes the file |
| 15 | Maps | Open a branch editor and a staff location map | Android: Google tiles (needs the key, otherwise the "map unavailable" placeholder shows). iOS: Apple Maps. Marker drag, circle radius and "my location" work |
| 16 | Deep link | `adb shell am start -a android.intent.action.VIEW -d clockyn://` / `xcrun simctl openurl booted clockyn://` | App opens (dev client / store build only) |
| 17 | Cold start | Launch from icon | Native splash (white light / dark navy dark) fades into the brand splash, then the first screen; adaptive icon (round + themed monochrome on Android 13+) looks right |

Record failures with device model, OS version, build profile and `adb logcat` / Xcode console output.
