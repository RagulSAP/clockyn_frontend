# Clockyn — Architecture

Clockyn is a staff attendance & workforce-management app built with **Expo SDK 58 / React Native 0.88 / React 19 / TypeScript (strict)** and **Expo Router** (file-based). One codebase targets **Android, iOS and Web** (`npx expo start` → a / i / w, or `expo export --platform web`).

## Principles
1. **Cross-platform first.** Every screen must work on Android, iOS and Web. Native-only capabilities live behind `src/lib/platform/*` with `.native.ts(x)` / `.web.ts(x)` implementations behind a single typed API (Metro picks the right file). Screens never import native-only packages (`react-native-maps`, `@react-native-firebase/*`, `expo-task-manager`, `react-native-webview`) directly.
2. **Same functionality as the previous generation of the product** (specs in `../project_complete_context/pages/**`), with the defects listed in each spec's §13 fixed per `docs/FIX_POLICY.md`.
3. **Design system, not styles.** Screens compose `@/components/ui` primitives and read `useTheme()` tokens. No hard-coded colours/spacings/fonts in screens. Light + dark themes, system-following with a manual override.
4. **Thin routes, fat features.** `src/app/**` files only declare routes (re-export a screen); logic and UI live in `src/features/<feature>/`.
5. **Server state = TanStack Query.** No hand-rolled caches, no `*_need_refresh` flags, no JSON route params for data hand-off. Invalidate query keys after mutations.
6. **One API client, typed domain modules.** No `fetch` in screens or components.
7. **No legacy names anywhere** (code, comments, strings, storage keys, docs, file names). `npm run check:brand` enforces it. Contact/legal/store URLs come from `src/config/env.ts` (env vars), never literals.

## Folder structure
```
Clockyn/
├─ app.config.ts            Expo config (env-driven, no secrets)
├─ docs/                    ARCHITECTURE, CONTRACTS, FIX_POLICY, ROUTES, CONVENTIONS, changes/<builder>.md
├─ backend_changes.md       Backend work needed for this app (compiled at the end)
├─ e2e/                     End-to-end tests (web, Playwright) + mock backend
├─ scripts/                 check-brand.js, check-routes.js, …
├─ assets/                  icon, splash, favicon, adaptive icons, fonts
└─ src/
   ├─ app/                  Expo Router routes (thin)
   │  ├─ _layout.tsx        Root providers + bootstrap
   │  ├─ index.tsx          Welcome (role chooser)
   │  ├─ admin-login.tsx, staff-login.tsx, register.tsx, device-change-request.tsx
   │  ├─ admin/             role 1 (+ role 2 via shortcuts) — _layout.tsx (guard + Stack), (tabs)/ home|crm|chat|settings, and stack screens
   │  └─ staff/             role 2/3 — _layout.tsx, (tabs)/ home|crm|chat|settings, and stack screens
   ├─ features/             One folder per feature: screens/, components/, hooks/, utils/, types.ts
   │  ├─ auth/ dashboard/ staff-directory/ org-structure/ company/ team-rules/ billing/ settings/
   │  ├─ payroll/ reports/ requests/ expenses/ location/ chat/ announcements/ crm/
   │  └─ employee/ (home & punch, attendance calendar, profile, requests, expenses, settings)
   ├─ components/
   │  ├─ ui/                Design-system primitives (Button, Card, TextField, Select, Modal, BottomSheet, Toast, …)
   │  └─ layout/            Screen, ScreenHeader, AppShell (sidebar on wide screens), TabBar, ResponsiveContainer
   ├─ api/                  Typed domain API modules (auth, home, staff, …) — the only code that knows URLs
   ├─ lib/
   │  ├─ api/client.ts      fetch wrapper, ApiError, upload w/ progress
   │  ├─ query/             QueryClient, key factory, helpers
   │  ├─ realtime/          WebSocket helper (reconnect/ping), chat/badge sockets
   │  ├─ platform/          files, exporter, maps, location, notifications, permissions, payment, camera-picker, analytics, app-update
   │  ├─ datetime.ts        IST-aware date helpers (single source of truth for "today", ranges, formatting)
   │  ├─ format.ts          currency (INR), numbers, phone, names
   │  ├─ storage.ts         typed AsyncStorage wrapper + STORAGE_KEYS
   │  └─ navigation.ts      typed push/replace helpers over routes
   ├─ store/                zustand stores: auth (persisted), badges, ui
   ├─ hooks/                Cross-feature hooks (useAsyncAction, usePolling, useDebounce, useRefreshOnFocus, useBreakpoint)
   ├─ config/               env.ts, brand.ts, routes.ts, plans.ts
   ├─ theme/                tokens + ThemeProvider
   └─ types/                Shared domain types (Session, Staff, Branch, …)
```

## Layers & dependency rule
`app` → `features` → (`components`, `hooks`, `api`, `store`, `lib`, `config`, `theme`, `types`). `components/ui` depends only on `theme`/`lib/platform` (never on features/api). `api` depends only on `lib/api` and `types`. Features never import other features' internals (share via `components`, `hooks`, or a feature's `index.ts` exports).

## Navigation model
- Role guards in `src/app/admin/_layout.tsx` (roles 1 & 2) and `src/app/staff/_layout.tsx` (roles 2 & 3); unauthenticated → welcome.
- Tab roots (Home / CRM / Chat / Settings) are inside `(tabs)` groups. Mobile: bottom tab bar; Web ≥ 1100px / tablets: sidebar (`AppShell`). Stack screens hide the tab bar and show `ScreenHeader` with back.
- Route constants: `src/config/routes.ts`. Navigate with `src/lib/navigation` helpers. Data hand-off between screens uses **query cache + minimal id params** (never JSON blobs).
- Notification taps and deep links route through `src/lib/platform/notifications` → `routes`.

## Runtime systems (all in the root layout bootstrap)
Auth hydration → session watcher (single-device check-session poll + FCM `force_logout`) → global badge/chat socket → push registration → update check → location resume (field staff). All keyed to the **reactive** auth store (fixes the v1 cold-start snapshot bug), and torn down on sign-out (`signOut()` stops tracking, closes sockets, clears query cache and stores).

## Testing
- Unit (jest-expo): pure logic — datetime, format, pricing, validation, status machines, API client. Colocate as `*.test.ts(x)`.
- Component/screen tests with `@testing-library/react-native` for critical flows.
- E2E on web (Playwright) against a mock backend (`e2e/`), plus static gates: `npm run verify` (typecheck, lint, unit, brand check), `npm run check:routes`, `npx expo export --platform web`.

## Naming & style
See `docs/CONVENTIONS.md`.
