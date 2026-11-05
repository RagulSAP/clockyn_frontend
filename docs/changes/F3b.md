# F3b — App shell, bootstrap, realtime

## Implemented
- `src/app/_layout.tsx` — providers (GestureHandler, SafeArea, Theme, Query, Toast + confirm host), fonts, splash gate (`appReady.ts`, safety timeout 6 s), `<Bootstrap/>`.
- Role areas: `admin/_layout.tsx` (roles 1, 2), `staff/_layout.tsx` (roles 2, 3) = `RoleGuard` + `AppShell` + Stack; `(tabs)/_layout.tsx` = Tabs with `TabBar`; `+not-found.tsx`; 8 tab-root placeholders (`ComingSoonScreen`, first line `// PLACEHOLDER`) — builders overwrite them.
- `components/layout`: `AppShell`, `TabBar`, `SidebarNav`, `RoleGuard`, `Bootstrap`, `BrandSplash`, `useShellNav`, `shellNav.ts` (pure tab/plan-gate/sidebar logic). Exported from the layout barrel.
- `hooks/useRootRedirect.ts` (`{ ready, href }`) — B1's welcome screen should `if (!ready) return null; if (href) return <Redirect href={href} />`.
- `lib/realtime`: `socketCore.ts` (createSocket, backoff, dedupe), `socket.ts` (re-exports + `useGlobalSocket`, `useChatSocket`, `useGroupSocket`), `events.ts` (frame/push interpretation + `realtimeBus`), `globalRealtime.ts` (badge-store wiring).
- `scripts/check-routes.js` (`npm run check:routes`; `--allow-missing`, `--strict`).

## Using it (for builders)
- Never navigate after `signOut()`: the guards and `useRootRedirect` react to the cleared session (the stack is replaced by the welcome screen).
- Tab navigation is by pathname: Home/CRM/Chat/Settings always `router.navigate` to the tab root (no more "Home = back"). The CRM press is plan-gated with `useOrgPlan()` (toast with the plan message; allowed while the status is still loading).
- Chat screens: `useChatSocket(userId, onMessage, { onReconnect })` / `useGroupSocket(groupId, userId, onMessage)` deliver every frame but NEVER touch badges; counting happens only in the global socket (+ foreground push), de-duplicated by message id (also in `@/store/badges`). Chat list/unread queries are invalidated after a socket reconnect; `realtimeBus` emits `socket_reconnected`, `request_submitted`, `punch_notification`, `announcement`, `chat_message`.
- Expo Router 58 requires `<Tabs.Screen name=…/>` declarations in a Tabs layout (done for the 4 tabs); Stack layouts auto-register routes.

## Fixes applied (v1 → now)
- Session poll / FCM `force_logout` / push registration / sockets / location resume are keyed to the reactive session (start on login in the same run, rebind on user change, stop on sign-out). Late `check-session` answers for a previous user are ignored.
- Sockets always reconnect (exponential backoff 1 s → 30 s, jitter), respect CONNECTING, close cleanly; chat/group sockets no longer double-count.
- CRM tab gate reads plan status from the API for every role (staff/managers no longer blocked outside a trial).
- Notification taps are routed by the session role, held until hydrated + navigator mounted + initial redirect settled; taps on locally re-displayed chat notifications work.
- Update modal: neutral wording (no hard-coded store name), env/backend store URLs, check at most every 10 min.

## Deferred / notes
- No CRM data prefetch on tab press (optional in the brief; screens load via react-query).
- Punch notifications are published on `realtimeBus` but not persisted to storage (v1 list was a dead UI) — the dashboard builder can persist them with `STORAGE_KEYS.punchNotifications` if the bell is kept.
- iOS blurred tab bar is in-flow (blur over the page background), not floating over content.

## Backend needs
- None new. (Known: pushes should carry `message_id` so foreground chat pushes de-duplicate against the socket; token is not revoked server-side on sign-out — no endpoint exists.)
