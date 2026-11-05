# Clockyn

Clockyn is a staff attendance and workforce-management app: punch in/out with face verification and geofencing, shifts, requests, expenses, payroll and reports, CRM and chat. One codebase runs on **Android, iOS and Web**.

Stack: Expo SDK 58, React Native 0.88, React 19, TypeScript (strict), Expo Router, TanStack Query, Zustand.

## Setup

Requirements: Node 20+ and npm. For device builds: Android Studio / Xcode (see "Dev client" below).

```bash
npm install
cp .env.example .env     # then fill in the values you need (Windows: copy .env.example .env)
npm start                # Expo dev server; press a / i / w
```

### Environment variables

All `EXPO_PUBLIC_*` values are bundled into the client — never put secrets in them. Every value is optional except where noted; empty values degrade gracefully (the related UI is hidden).

| Variable | Used for |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Backend base URL (a default is built in). WebSocket URLs are derived from it. |
| `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_SALES_EMAIL` | Contact links in Settings / Help. |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Privacy-policy link. |
| `EXPO_PUBLIC_WEB_PORTAL_URL` | Web-portal link shown on mobile. |
| `EXPO_PUBLIC_ANDROID_STORE_URL`, `EXPO_PUBLIC_IOS_STORE_URL` | Store listing for the update prompt and the rate-the-app prompt. With none set, the rate prompt never shows and the update prompt relies on the URL sent by the backend. |
| `APP_ID` | Android package / iOS bundle id (`app.config.ts`, default `com.clockyn.app`). |
| `EAS_PROJECT_ID` | EAS project id for builds. |
| `GOOGLE_MAPS_API_KEY` | Native Google Maps key (Android). The web map uses Leaflet and needs no key. |
| `GOOGLE_SERVICES_JSON`, `GOOGLE_SERVICE_INFO_PLIST` | Firebase config files for push (FCM). When the files are missing, push is disabled and the app still runs. |

Configuration is read only through `src/config/env.ts`; do not hard-code URLs or e-mail addresses elsewhere.

## Scripts

| Script | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run android` / `ios` / `web` | Start and open on that platform |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` (ESLint) |
| `npm test` | Jest (jest-expo) unit and component tests |
| `npm run check:brand` | Fails if a legacy product/vendor name appears anywhere in the repo |
| `npm run check:routes` | Verifies every route in `src/config/routes.ts` has a route file (`--allow-missing`, `--strict`) |
| `npm run export:web` | Static web export (`expo export --platform web`) |
| `npm run verify` | typecheck + lint + tests + brand check (run before every commit) |

## Running on each platform

- **Web** — `npm run web` (or `w` in the Expo terminal). Browser geolocation, Leaflet maps, `window.print` PDF export and Razorpay `checkout.js` are real implementations. Background location tracking and FCM push do not exist on the web (documented no-ops).
- **Android** — `npm run android` with an emulator/device attached (USB debugging).
- **iOS** — `npm run ios` on macOS with Xcode, or install a development build on a device.

### Dev client (push and background location)

Expo Go cannot run everything. Firebase push (`@react-native-firebase/*`), background location (`expo-task-manager`), native maps and the Razorpay WebView flow need a **development build**:

```bash
npx expo prebuild                 # generates android/ and ios/ (not committed)
npx expo run:android              # or: npx expo run:ios
# or with EAS:  eas build --profile development --platform android
```

Provide the Firebase files (`google-services.json`, `GoogleService-Info.plist`) and `GOOGLE_MAPS_API_KEY` before building. In Expo Go and on the web the app still starts: push registration resolves to "no token" and tracking is a no-op.

### EAS builds (`eas.json`)

| Profile | Purpose | Output |
| --- | --- | --- |
| `development` | Dev client + internal distribution (needed for FCM push, background location, native maps key) | Android APK, iOS ad hoc device build |
| `development-simulator` | Same dev client for the iOS simulator | iOS simulator build |
| `preview` | Internal release-mode build for QA (runs without Metro) | Android APK, iOS ad hoc |
| `production` | Store build, `autoIncrement` (remote version source) | Android AAB, iOS App Store build |

```bash
eas init                                         # once: writes extra.eas.projectId (or set EAS_PROJECT_ID)
eas build --profile development --platform android
eas build --profile development --platform ios  # no Mac needed; register devices first: eas device:create
eas build --profile preview --platform all
eas build --profile production --platform all
eas submit --profile production --platform android   # fill the (empty) submit block / use EAS credentials
```

Each profile reads the EAS environment of the same name. Create the variables with `eas env:create` (nothing secret is committed):

| Variable | Kind | Notes |
| --- | --- | --- |
| `APP_ID` | plain | Android package / iOS bundle id (default `com.clockyn.app`) |
| `GOOGLE_MAPS_API_KEY` | secret | Android Google Maps key. Without it Android builds show a "map unavailable" placeholder |
| `GOOGLE_SERVICES_JSON` | file | Firebase `google-services.json` (FCM push, Android) |
| `GOOGLE_SERVICE_INFO_PLIST` | file | Firebase `GoogleService-Info.plist` (FCM push, iOS; also needs an APNs key in Firebase) |
| `EXPO_PUBLIC_*` | plain | See `.env.example` (API base URL, support links, store URLs) |

Either Firebase file may be provided alone; the matching platform gets push, the other builds without it.

### Expo Go vs dev client

| Feature | Expo Go | Dev client / store build |
| --- | --- | --- |
| UI, navigation, API calls, camera (face punch), image/document picker, date pickers, haptics, file save/share/PDF, maps, Razorpay WebView | Works (Expo Go version must support SDK 58) | Works |
| FCM push (`@react-native-firebase/messaging`) | No (module missing, push resolves "no token") | Yes, needs Firebase files |
| Background location (Android foreground service) | No (foreground tracking only) | Yes (Android only, by policy) |
| `clockyn://` deep links, custom icon/splash/notification icon, config-plugin permission texts | No | Yes |
| Google Maps key / Android map styling | Expo Go's own key | Your `GOOGLE_MAPS_API_KEY` |

Step-by-step device instructions and the manual test script: [`docs/RUNNING_ON_DEVICES.md`](docs/RUNNING_ON_DEVICES.md). Native-readiness audit: [`docs/qa/native-readiness-N1.md`](docs/qa/native-readiness-N1.md).

## Folder structure

```
app.config.ts        Expo config (env-driven, no secrets)
backend_changes.md   Backend work needed and owner-supplied configuration
docs/                ARCHITECTURE, CONTRACTS, CONVENTIONS, FIX_POLICY, ROUTES, MIGRATION_COVERAGE, FIXES_APPLIED, DEFERRED_DECISIONS, changes/<engineer>.md, qa/
scripts/             check-brand.js, check-routes.js
e2e/                 End-to-end tests (web) and mock backend
assets/              icons, splash, fonts
src/
  app/               Expo Router routes (thin: they re-export a screen from features/)
  features/          One folder per feature: screens, components, hooks, utils
  components/ui/     Design-system primitives (Button, Modal, TextField, Toast, ...)
  components/layout/ Screen, AppShell, TabBar, Bootstrap (session watcher, sockets, push, update check)
  components/overlays/ Shared app-level overlays: RateAppModal, PermissionOnboarding
  api/               Typed domain API modules; the only code that knows URLs
  lib/               API client, query, realtime sockets, platform layer (.native/.web), datetime, storage
  store/             Zustand stores: auth (persisted), badges, ui
  hooks/             Cross-feature hooks
  config/            env, brand, routes, plans
  theme/             Tokens and ThemeProvider (light/dark)
  types/             Shared domain types
```

Rules of thumb: screens never import native-only packages directly (go through `src/lib/platform/*`); server state lives in TanStack Query; business dates use `@/lib/datetime` (IST); storage keys come from `STORAGE_KEYS`. See `docs/ARCHITECTURE.md` and `docs/CONVENTIONS.md`.

## Documentation map

| Document | What it answers |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Principles, folder layout, layers, navigation model, runtime systems |
| [`docs/CONTRACTS.md`](docs/CONTRACTS.md) | Public exports of the design system, layout, platform layer, API client, store and realtime |
| [`docs/ROUTES.md`](docs/ROUTES.md) | Route table: which v1 screen became which route, feature folder and builder |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Naming, style and coding rules |
| [`docs/FIX_POLICY.md`](docs/FIX_POLICY.md) | What was preserved, what was fixed, what was deferred, and why |
| [`docs/MIGRATION_COVERAGE.md`](docs/MIGRATION_COVERAGE.md) | All 88 v1 screens mapped to Clockyn (ported, merged, dropped), plus additions that were not in v1 |
| [`docs/FIXES_APPLIED.md`](docs/FIXES_APPLIED.md) | The v1 defects that were fixed, with file and test for each (15 rebuild traps, defect lists, QA fixes) |
| [`docs/DEFERRED_DECISIONS.md`](docs/DEFERRED_DECISIONS.md) | Decision register: every open product or backend question, with options and a recommendation |
| [`backend_changes.md`](backend_changes.md) | Backend work needed (P0 to P3) and the values the product owner must supply |
| [`docs/BUILDER_BRIEF.md`](docs/BUILDER_BRIEF.md) | The brief the feature builders worked from |
| `docs/changes/*.md` | One change log per engineer (`F2b2`, `F3b`, `F4`, `B1` to `B12`): what was built, fixed, deferred and what the backend needs |
| `docs/qa/*.md` | Spec-conformance matrices (`spec-conformance-Q4a` to `Q4d`, `Q4d-A` to `Q4d-D`), cross-cutting QA (`cross-cutting-Q5`) and the harness findings (`Q0-findings`) |
| [`e2e/README.md`](e2e/README.md) | The Playwright suite and the mock backend that doubles as an executable API contract |

Reading order for a new owner: `docs/MIGRATION_COVERAGE.md`, then `docs/DEFERRED_DECISIONS.md` and `backend_changes.md`. The v1 specification set that the screens were rebuilt from is outside this repository (`../project_complete_context/`, relative to this folder).

## Testing

- **Unit / component** — `npm test` (jest-expo, `@testing-library/react-native`). Tests are colocated as `*.test.ts(x)` or in `__tests__/` folders; only files matching `*.test.*` are collected, so shared helpers (for example `src/api/testUtils/apiMock.ts`) live in `testUtils` folders. `AsyncStorage` is mocked globally in `jest.setup.ts`.
- **Static gates** — `npm run verify`, `npm run check:routes`.
- **E2E (web)** — Playwright against a mock backend lives in `e2e/` and is excluded from the Jest run.
