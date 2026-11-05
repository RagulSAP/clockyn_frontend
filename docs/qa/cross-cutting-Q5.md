# Cross-cutting QA (Q5)

Scope: brand, cross-platform, architecture, security, accessibility, performance, tooling. Each item: check, method, result, fixes.
Gates at the end of this pass: `npx tsc --noEmit` 0 errors, `npm run check:brand` passes, `npx expo-doctor` 20/20, web + android + ios exports bundle.

## 1. Brand / legacy-name audit (zero references)

| Check | Method | Result | Fix |
|---|---|---|---|
| `npm run check:brand` | run | pass | none |
| Source, docs, README, config, scripts, e2e, `.claude`, `.expo` (incl. caches) | independent `grep -rai` with the same fragments, plus UTF-16LE/BE decode of every file | 0 hits | none |
| `package.json` fields | read | `name: clockyn`; no description/keywords/author/repository fields, nothing to leak | none |
| `package-lock.json` | brand scan + `resolved` host census | name `clockyn`; all 1522 `resolved` URLs are `registry.npmjs.org` | none |
| `app.config.ts` / `expo config --type public` | read + resolve | name, slug, scheme, bundle/package id, permission strings all Clockyn/neutral | none |
| PNG assets (7 files) | Python/Pillow + manual chunk walk | each PNG is only `IHDR, IDAT, IEND`: no tEXt/iTXt/zTXt/eXIf, `info == {}` | none needed |
| Built output (web, android, ios exports) | grep for the names and the absolute project path | 0 hits (no source paths embedded) | none |
| File/folder names | scanner `[name]` rule | clean | none |
| Other-product / vendor names in user-visible copy | grep of string literals | one hit: Share row in `InvoicesScreen.tsx` said "Send via WhatsApp, Email & more" | changed to "Send via email, messaging apps & more" |
| Expo-template text, lorem ipsum, TODO/FIXME, placeholder copy | grep | none. "Coming soon" appears only on the spec'd placeholders (`DevicesScreen`, `ComingSoon`, a CRM "Fine / Deduction" menu row), kept per FIX_POLICY section B7 | none |
| Mojibake | Python scan for `Ã`, `Â`, `â€`, U+FFFD and double-encoded emoji in every ts/tsx/js/md/json | 0 hits; non-ASCII in `src` is only deliberate (em dash, rupee, arrows, box-drawing comments, Devanagari/Tamil sample names in tests) | none |
| Hard-coded e-mail addresses / URLs | grep outside tests | none for contact/legal/store. Only literals: default API host inside `@/config/env`, third-party endpoints in the platform layer (OSM tiles, Nominatim, Esri imagery, Razorpay checkout origin) and two picsum URLs in the dev-only UI gallery. Test mocks use `example.com` | none |
| Test names / mock data | brand scan | clean (`example.com` / fake keys `rzp_test_*` only) | none |
| Gaps in `scripts/check-brand.js` | review | (a) only a fixed extension list was scanned, so `.snap`, `.sh`, `.toml`, `.csv`, ... were skipped; (b) binary files, including PNG metadata chunks, were never inspected | **extended**: every non-binary file is scanned whatever its extension; binary files are scanned as latin1 and UTF-16 strings; PNG chunks are parsed (tEXt/iTXt/zTXt incl. zlib-inflated text). Verified with a planted zTXt chunk and a `.snap` file in a temp copy (both flagged); the script still contains no literal legacy name |

Note: `.claude/settings.json` (enabled plugin id) is tooling metadata, not a legacy name. `.claude/settings.local.json` is now git-ignored.

## 2. Cross-platform correctness

| Check | Method | Result | Fix |
|---|---|---|---|
| Native-only packages out of the web bundle | `expo export --platform web`, grep output for `react-native-maps`, `@react-native-firebase`, `expo-task-manager`, `expo-print`, `react-native-webview`, `RNMaps`, `RNFB` | 0 matches. The one `react-native-webview` string is an error message inside Expo's own DOM-component runtime, not the package. Source grep: those packages are imported only from `*.native.*` files | none |
| Android + iOS exports | `expo export --platform android --platform ios` | both bundle (2996 / 2991 modules), also after the dependency removals | none |
| Gesture-handler on web | bundle analysis | `react-native-gesture-handler`'s barrel pulled the whole reanimated layout-animation runtime (~1 MB chunk) into the web bundle although nothing on the web uses it | added `components/layout/GestureRoot.tsx` (web: `View`) + `GestureRoot.native.tsx` (`GestureHandlerRootView`); root layout uses it. The `_layout` chunk (1.0 MB) disappeared from the web export |
| `Alert.alert` | grep | none (`useConfirm` / toasts are used) | none |
| `window` / `document` / `localStorage` / `navigator` | grep outside `.web.*` | all inside the platform layer (base `.ts` = web implementation with a `.native.ts` twin), `DataTable` and `ui/internal/web.ts`, each behind `typeof document/window !== 'undefined'` and/or `Platform.OS === 'web'`. No `localStorage` use (storage goes through AsyncStorage) | none |
| `Platform.OS` usage | grep (about 60 uses) | mostly keyboard / refresh / native-driver / store selection; no screen forks that should be file splits | none |
| react-native-web incompatibilities | grep `shadow*`, `pointerEvents` prop, `useNativeDriver`, `aria-*`; read RNW 0.21 source | RNW 0.21 emits no deprecation warnings for `shadow*` styles or the `pointerEvents` prop; `useNativeDriver` is always gated by `Platform.OS !== 'web'` | none |
| Keyboard / safe area | read `Screen`, `OverlayShell`, `insets.ts` | `KeyboardAvoidingView` (padding off on web), `automaticallyAdjustKeyboardInsets` on iOS, safe-area insets degrade to zero without a provider | none |

## 3. Architecture rules

| Check | Result | Fix |
|---|---|---|
| `fetch` / `XMLHttpRequest` outside `src/lib/api` | `lib/api/client.ts` only, plus the justified platform layer: `platform/files.ts` (download by URL / blob URI), `platform/geocode.ts` (OSM Nominatim reverse geocode, third party). No `new WebSocket` outside `lib/realtime` | none |
| Hard-coded hex colours in `src/features/**`, `src/app/**` | **16 occurrences, 2 files**: `chat/utils/chatThemes.ts` (7; user-selectable chat palettes from the spec) and `reports/utils/employeeProfile.ts` (9; print/PDF HTML stylesheet, which must be light). `components/` has only intentional ones (`BrandMark` white logo, `ImageViewer` black viewer, payment WebView page, web-map pin text) | none; justified |
| Raw `fontSize` in features/app | **3** (`fontSize: 9` micro labels inside calendar cells in `AttendanceCalendarScreen`, `AttendanceCalendarGrid`, `CalendarTab`) | left: they exist to fit status letters in small cells (see residual risks) |
| `console.log` | 0. 12 `console.warn/error`, all fixed messages or error text (no OTP/token/PII) | none |
| JSON blobs in route params | none: `navigation.ts` types params as flat primitives, every `useLocalSearchParams` takes ids/strings | none |
| Layering | `components/ui` imports nothing from features/api/store (only `ui/dev/UiKitGallery` imports `components/layout`, dev-only); `api` and `lib` import nothing from features/components; no cross-feature deep imports; `src/app` has no api imports. `components/layout/bootstrap` uses `api`/`store` (app shell, allowed) | none |
| Circular imports | `npx madge --circular` over 992 files: **1 cycle**, type-only: `types/api/groupChat.ts <-> types/api/chat.ts` (`import type`, erased at runtime) | left (harmless); could move the shared message-type union to `common.ts` |

## 4. Security hygiene

| Check | Method | Result | Fix |
|---|---|---|---|
| Secrets / keys / tokens | regex for `AIza`, `sk_`, `rzp_`, bearer/JWT, `AKIA`, `ghp_`, private-key blocks, `api_key=`, `secret=`, `password=` across the repo (minus node_modules) | only fake mock keys in tests / e2e mock server (`rzp_test_*`). `.env.example` has placeholders and the (public) default API host. No `.env`, `google-services.json` or plist committed; all are git-ignored (verified with `git check-ignore`) | `.gitignore`: added `*.pem`, `.metro-health-check*`, `.claude/settings.local.json`, `.idea/`, `.vscode/` |
| OTP / PII in logs | review of all `console.*` | none logged; location upload warning is a constant string | none |
| HTML escaping | grep `innerHTML`, `dangerouslySetInnerHTML`, `srcdoc`, `document.write`, `bindTooltip`, `divIcon`; read builders | no `innerHTML`; exports use `escapeHtml` (table + Word); web map pin/tooltips escape label, title, description and colour; `employeeProfile` escapes values; Excel/CSV neutralise formulas | none |
| WebView / iframe sources | read `WebPage.*`, `payment*` | `WebPage` is only used with `env.privacyPolicyUrl`; iframe has `referrerPolicy=no-referrer`. Checkout WebView uses `baseUrl: CHECKOUT_ORIGIN` and hands non-http(s) deep links (UPI) to the OS | none |
| External links | read every `Linking.openURL` / `window.open` | chat video links come from other users' messages and were opened with any scheme | added `lib/safeUrl.ts` (`isHttpUrl`, with a unit test) and gated the chat video press (`MessageBubble`) on it. Other callers use env values or backend store URLs (`market:` style schemes may be legitimate there) |
| Android / iOS permissions (`app.config.ts`) | `expo config --type public` | the `expo-camera` / `expo-image-picker` plugins silently added `RECORD_AUDIO` and an iOS microphone usage string although the app only captures stills | set `microphonePermission: false` (both plugins) and `recordAudioAndroid: false`; `RECORD_AUDIO` is gone from the resolved config. Remaining set is justified: location (+ background + foreground-service location for field-staff tracking, Android only), camera (face verify, photos), `READ_MEDIA_IMAGES`, `POST_NOTIFICATIONS`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED` |
| `npm audit --omit=dev` | run + parse | 58 advisories (28 moderate, 30 high, 0 critical). **Real, direct, no fix: `xlsx` (SheetJS) prototype pollution + ReDoS** (affects parsing untrusted workbooks; the app only writes workbooks). The rest are transitive through Expo/Metro/React Native tooling (`@expo/cli`, `metro*`, `braces`, `micromatch`, `node-forge`, `uuid` via `xcode`) and `@grpc/grpc-js` via the `firebase` JS SDK pulled by `@react-native-firebase/app`; the suggested "fixes" are downgrades (expo 44, RN 0.72), so nothing was force-upgraded | none; see decisions |

Hardening not applied (needs a browser check): add `sandbox="allow-same-origin allow-modals"` to the print iframe in `platform/pdf.ts` so HTML in an exported document can never run script.

## 5. Accessibility and UX baseline

| Check | Method | Result | Fix |
|---|---|---|---|
| Accessibility labels | `IconButton` makes `accessibilityLabel` a required prop (type-enforced); script over all 91 `Pressable`/`Touchable` usages | every one has a role or label; none are icon-only without a label; `SearchBar`, `TextField`, `PickerTrigger`, `OTPInput` fall back to a label automatically | none |
| Touch targets | read `Button`, `IconButton`, `Checkbox`, `Switch` | md/lg >= 44; `sm` is 36 + 4 px hit slop on each side = 44; checkbox / switch rows have `minHeight: 44` | none |
| Form labels | script over `TextField`/`Select`/`DateField`/... | all labelled via `label`, `placeholder` fallback, or `accessibilityLabel` | none |
| Web keyboard | read `Touchable`, `OverlayShell`, RNW `Modal` | Enter activates, Space via `activateOnSpace`, keyboard-only focus ring, scrim out of tab order; RNW `Modal` closes on Escape and traps focus; dialog has `role="dialog"` + `aria-modal` | none |
| Colour contrast | `node` script computing WCAG ratios for all text/surface and status pairs in both themes (script kept in this pass's scratch dir; re-runnable from `colors.ts`) | **Before (light):** `textMuted` 3.1-3.8, `success`/`warning`/`danger`/`info` text 2.4-3.9 on surface and on their soft tints, white text on status/semantic fills 2.7-4.2, `primary` on `primarySoft` 4.18. **Before (dark):** `textMuted` 3.9-4.3 on muted surfaces, `primary` on `primarySoft` 4.09 | Tuned tokens, keeping hue and feel. Light: `textMuted #7A82A3 -> #60688A`, `primary #5B5CF6 -> #5152F5`, `gradientEnd #8B5CF6 -> #8655F6`, `success -> #0E7C50`, `warning -> #9E6100`, `danger -> #D21E24`, `info -> #0A62EC`, status colours aligned (`statusHalfDay #8655F6`, `statusHoliday #D33198`, `statusWeekOff #60688A`). Dark: `textMuted -> #9097BD`, `primary -> #8486FF`. Chat bubble palettes (Ocean/Forest/Sunset/Teal/Dark) darkened one step so white text is >= 4.5. After: every text pair >= 4.5 and every status-on-surface pair >= 3 in both themes. Test `primitives.test.tsx` now reads `lightColors.danger` instead of a literal |
| Dark mode | grep for literal light colours | none in components/features apart from those listed in section 3; chat "Default" theme follows tokens | none |

Remaining contrast gaps (not text, visual-design decision): `border`/`borderStrong` against surface/background are 1.2-2.0:1 in both themes (WCAG 1.4.11 asks 3:1 for input boundaries); mint `accent` has no readable foreground in either theme (used only as an icon/dot/fill, never behind text).

## 6. Performance and robustness

| Check | Result | Fix |
|---|---|---|
| Virtualised lists | `FlatList` for chat messages, chat lists, staff directory, pickers. **Not virtualised (ScrollView + `.map`)**: dashboard Overview staff list, Monthly Salary cards, CRM assign employee list, location staff list, `DataTable` rows (used by the Late / Overtime / Salary sheet / Staff detailed reports) | not changed (needs screen restructuring; v1 did the same). Risk for orgs with several hundred staff, see residual risks |
| Keys / `keyExtractor` | every `FlatList` has one (the two grep misses spread props) | none |
| Timers / listeners / sockets | every `setInterval`, `AppState`/`BackHandler` listener, DOM listener and socket has cleanup (`clearInterval`, `sub.remove()`, `removeEventListener`, socket `close`) | none |
| Unhandled rejections | all `.then` chains in effects end with `.catch`/`.finally` or call helpers that never reject (storage wrappers, `registerAppOpen`, `uploadFixes`, `reverseGeocode`, `suggestEmployeeId`) | none |
| Web bundle size | before: `__common` 3.7 MB, `entry` 1.1 MB, `_layout` 1.0 MB (8.3 MB total export). Causes: `lucide-react-native` barrel pulling all ~1,700 icons (~0.7 MB+), `xlsx` (~0.5 MB) in the shared chunk, gesture-handler pulling reanimated | (1) `components/ui/icons.ts` imports each icon from `lucide-react-native/icons/<name>` (jest `moduleNameMapper` added for that path); (2) `xlsx` lazy-loaded on web (`exportXlsx.ts` dynamic `import()`, `exportXlsx.native.ts` static, shared `exportXlsxCore.ts`; `buildXlsxBytes` is now async and its two tests await it); (3) `GestureRoot` split (section 2). After: `__common` 1.2 MB, `entry` 1.1 MB, separate `xlsx` chunk 423 KB, no `_layout` chunk, **total export 5.4 MB (-35%)**; every route chunk is < 80 KB |
| Chunks still > 500 KB | `entry` (1.1 MB: React DOM, react-native-web, expo-router, router/navigation) and `__common` (1.2 MB: app-wide shared code, Leaflet 145 KB, design system, api modules) | framework baseline plus shared code; no further cheap wins. The dev-only UI gallery ships as a 17 KB lazy chunk (the route redirects outside `__DEV__`) |

## 7. Tooling health

| Check | Result | Fix |
|---|---|---|
| `npx expo-doctor` | 20/20 checks passed | none |
| `npm run verify` | typecheck 0 errors, lint clean, brand check passes, jest 2254/2255 on the full run; the single failure (an announcements screen test) passed on immediate re-run and is unrelated to this pass (concurrent edits / load) | none |
| `npx depcheck` | unused: `expo-application`, `expo-device`, `expo-keep-awake`, `expo-navigation-bar`, `expo-store-review` (also `expo-system-ui`, `@react-native-firebase/app`, `prettier`, `@types/ws`) | removed the five clearly unused packages from `package.json` and the lockfile (`expo-application` stays installed through `expo-notifications`, `expo-keep-awake` through `expo`). Kept: `expo-system-ui` (needed for Android `userInterfaceStyle`/background colour), `@react-native-firebase/app` (config plugin + peer of messaging), `prettier` (dev tooling), `@types/ws` (e2e mock server). Android + iOS + web exports re-run afterwards: all bundle |
| `.gitignore` | verified with `git check-ignore` that `.env`, `google-services.json`, `.expo`, `node_modules`, `e2e/.artifacts` are ignored and `.env.example` is not | additions listed in section 4 |
| `app.config.ts` validity | `npx expo config --type public` resolves (name, scheme, ids, plugins, permissions as expected) | microphone fix above |

## Decisions needed / residual risks
1. `xlsx@0.18.5` (high, no npm fix): acceptable while the app only writes workbooks; the maintained SheetJS build is distributed outside npm. Decide whether to vendor it or keep as is.
2. Unvirtualised staff-sized lists and `DataTable` (section 6): consider windowing or pagination if orgs with 300+ staff are expected.
3. Input borders under 3:1 and the `fontSize: 9` calendar-cell labels are visual-design calls.
4. Optional: sandbox the print iframe; remove unused iOS `UIBackgroundModes: fetch`; move the chat/group message type union to break the type-only cycle.
5. Tokens changed globally (light semantic colours are darker, e.g. amber `warning` reads as burnt amber); worth a quick visual pass in the UI gallery (`/dev/ui-kit`) in both themes.
