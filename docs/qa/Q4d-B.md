# Q4d-B - Spec-conformance audit: staff settings + shell systems

Scope: `pages/11_employee_home_profile/emp_settings.md`; `shared/systems/{permissions_and_onboarding, push_notifications, navigation_and_routing, auth_and_session, badges_and_realtime, plan_gating}.md`; `shared/components/{PermissionOnboarding, UnifiedBottomNavigationBar}.md`.
Implementation reviewed: `src/features/employee/{screens/StaffSettingsScreen,AppPermissionsScreen,MoreOptionsScreen}, utils/managerShortcuts, hooks/usePermissionStatus`, `src/components/layout/**` (+ `bootstrap/*`), `src/app/_layout` + area layouts, `src/store/{auth,badges,ui}`, `src/lib/realtime/**`, `src/lib/platform/{notifications*,permissions*,notificationRouting}`, `src/config/{routes,plans}.ts`, `src/hooks/useOrgPlan`, `src/components/overlays/*`, `app.config.ts`.
Deviations recorded in `docs/changes/{F2b2,F3b,F4,B11,B9a,B9b,B1,B5,B10,B2}.md` and `docs/FIX_POLICY.md` are treated as DEVIATION-OK.

## Counts (matrix rows)
| PASS | DEVIATION-OK | GAP/BUG fixed | Needs decision | Out of scope (other audit) |
|---|---|---|---|---|
| 131 | 27 | 5 | 8 | 8 |

(5 fixed: G1 delete-failure copy, G2 "Profile Settings" copy, G3 FCM default channel, G4 plan-status staleness on native, G5 chat badge seeding - G5 was fixed concurrently by another engineer as `useChatBadgeSeed`; I verified it and removed my duplicate.)

## Gaps found and fixed
| # | Gap / bug | Fix | Test |
|---|---|---|---|
| G1 | Delete-account failure always showed the server/network text. Spec F5/§14.15: non-2xx -> `Failed to delete account`; network/exception -> `Error deleting account` (a network failure showed "Network connection failed..."). | `MoreOptionsScreen.tsx`: `deleteFailureMessage(e)` - refusal (HTTP / business error) -> server `detail` (FIX_POLICY B2) else `Failed to delete account`; offline / timeout / unexpected -> `Error deleting account`. | `features/employee/__tests__/SettingsScreens.test.tsx` (3 new cases) |
| G2 | General Settings row read `Profile`; v1 copy is `Profile Settings` (no change log records a copy change). | `StaffSettingsScreen.tsx` row title. | `SettingsScreens.test.tsx` updated |
| G3 | Android FCM default channel not configured: pushes displayed by the OS while the app is closed would use the fallback channel, not `attendance_notifications` (importance MAX, vibration). v1 set it through a manifest plugin. | `app.config.ts`: `expo-notifications` plugin `defaultChannel: 'attendance_notifications'`. | `src/lib/platform/__tests__/notificationChannel.test.ts` |
| G4 | Plan status was never re-read on native while the app stayed open (query stale after 5 min but no focus refetch; only the tab bar observer exists) -> a renewal / upgrade / expiry was not reflected in tab gates, chat/CRM/camera-punch gates until restart (spec plan_gating §5 failure mode, §7 "refetch status on focus"). | New `components/layout/bootstrap/usePlanStatusRefresh.ts` (`refreshPlanStatusIfStale` + `usePlanStatusRefresh`), mounted in `Bootstrap.tsx`: on every app foreground, invalidates the plan-status query when older than 5 min (`PLAN_STALE_TIME_MS`). Matrix and messages unchanged. | `components/layout/bootstrap/__tests__/usePlanStatusRefresh.test.ts` |
| G5 | Chat tab badge not seeded at start (v1: group count fetched when the badge provider mounted; here counts only loaded when the chat hub was opened). | Added concurrently by another engineer: `features/chat/hooks/useChatBadgeSeed.ts` mounted in `Bootstrap.tsx` (shares cache keys with the hub). Verified; my identical hook was deleted. Note: it has no foreground re-sync (socket reconnect invalidation + hub/list loads keep it current). | `features/chat/hooks/__tests__/useChatBadgeSeed.test.tsx` |

Also added (no behaviour change): `features/employee/utils/__tests__/managerShortcutsContract.test.ts` - asserts char-for-char equality of every shortcut permission string with the admin catalogue `features/team-rules/utils/permissions.ts` (`MANAGER_PERMISSIONS`) and that every shortcut target has a route file.

## 1. pages/11 emp_settings (section 14 + rules + copy)
| # | Bullet / rule | Status | Evidence |
|---|---|---|---|
| 1 | Staff (role 3) sees only General Settings, More Options, Logout | PASS | `StaffSettingsScreen.tsx:58` (block only when `shortcuts.length>0`); `managerShortcuts.ts:86` role gate; test "shows only General Settings..." |
| 2 | Manager with `["Staff Management","Requests Management"]` sees exactly those rows in canonical order | PASS | `ADMIN_SHORTCUTS` order = catalogue order; `managerShortcuts.test.ts` |
| 3 | Manager with no permissions: no `Admin Settings` header | PASS | `StaffSettingsScreen.tsx:58` |
| 4 | View Staff as manager opens staff list with orgId = manager's user id; other roles org id | DEVIATION-OK | No route param exists (ROUTES.md): scope derived from session role - `features/staff-directory/hooks/useStaffScope.ts:10`, `features/org-structure/hooks/useOrgScope.ts:27`; B11 "Backend needs / Manager scope" |
| 5 | Add Staff opens `/admin/staff/edit`, sheet closes first | PASS | `StaffSettingsScreen.tsx:39-42` (`setMenu(null)` then `push`) |
| 6 | Add Branch -> add mode | DEVIATION-OK | `routes.admin.branches.edit` without `branchId` = add mode (routes.ts comment) |
| 7 | Salary: Monthly Fixed / Daily Wages / Hourly Calculation -> payslips / daily-wages / hourly | PASS | `managerShortcuts.ts` Salary options; `managerShortcuts.test.ts` |
| 8 | Incentive: Count Basis / Turnover Basis / OT / Bonus | PASS | same file/test |
| 9 | Leads: Enter Leads / Assign Leads -> `/admin/crm/leads/edit` / `/admin/crm/leads` | PASS | same |
| 10 | Attendance Reports / Shift Management / Requests Management -> `/staff/reports`, `/admin/shifts`, `/admin/requests` | PASS | ROUTES.md maps `monthly_report` manager variant to `/staff/reports`; test asserts targets |
| 11 | Holiday Management / Company Settings (no handler in v1) | DEVIATION-OK | Spec 13(a) "map them or hide"; B11 Fixes: `/admin/holidays`, `/admin/company` |
| 12 | App Permissions: Enabled/Disabled per OS state, tap opens OS settings, refresh after returning | PASS | `AppPermissionsScreen.tsx`; `usePermissionStatus.ts` (mount + `useAppActive` re-read + `refreshSoon` 1 s = `RECHECK_AFTER_SETTINGS_MS`) |
| 12b | Tap on a never-asked permission shows the system prompt first | DEVIATION-OK | Same pattern as admin permissions (B5); web has no settings deep link (spec s11) |
| 13 | Logout -> confirm; auth, push-token flags, caches cleared; lands on `/` with no back stack; Cancel keeps user | PASS | `StaffSettingsScreen.tsx:45-49` -> `signOut()` (`store/auth.ts:235-250`: teardowns (tracking, chat memory, realtime), session null, badges, query cache, session storage incl. `pushToken`); `RoleGuard` redirect replaces the area route |
| 14 | Delete -> toast `Account deleted successfully`, redirect after ~1.5 s, auth cleared | PASS | `MoreOptionsScreen.tsx` (`DELETE_REDIRECT_MS`, `signOut({reason:'deleted'})`) |
| 15 | Delete failure copy (non-2xx / network) | BUG-fixed (G1) | `MoreOptionsScreen.tsx` `deleteFailureMessage` |
| 16 | Header back shows `Loading...` and navigates home | DEVIATION-OK | Settings is a tab root with its own bar; warm-up fetch is dead (spec 13(f)); B11 Deviations |
| 17 | Android hardware back goes home | DEVIATION-OK | Tabs `backBehavior="firstRoute"` (`AreaLayouts.tsx:46`) = Home; More/Permissions are routes so back returns to Settings (spec 13(e) fix) |
| 18 | Foreground re-evaluates permission status | PASS | `usePermissionStatus.ts` effect on `useAppActive` |
| R1 | Shortcut permission strings exact, case-sensitive, 10 of them, vs admin catalogue | PASS | `managerShortcuts.ts` == `features/team-rules/utils/permissions.ts` `MANAGER_PERMISSIONS`; new contract test |
| R2 | Titles of the 10 rows verbatim | PASS | `ADMIN_SHORTCUTS[].title === permission` (contract test) |
| R3 | Sub-menu titles + option labels (Add Staff, View Staff, Add Branch, View Branch, Enter Leads, Assign Leads, Monthly Fixed, Daily Wages, Hourly Calculation, Count Basis, Turnover Basis, OT, Bonus) | PASS | `managerShortcuts.ts`; sheet title = shortcut title (`StaffSettingsScreen.tsx`) |
| R4 | Admin block only for role 2 even if permissions exist on role 3 | PASS | `managerShortcuts.test.ts` |
| R5 | Section titles `Admin Settings`, `General Settings`; rows `App Permissions`, `More Options`; button `Logout` | PASS | `StaffSettingsScreen.tsx` |
| R6 | Row `Profile Settings` | BUG-fixed (G2) | `StaffSettingsScreen.tsx:80`; wired to `/staff/profile` (13(b)) |
| R7 | Row `Help & Support` | DEVIATION-OK | Spec 13(b) allows removal; B11 Deviations (no staff support route) |
| R8 | Permissions copy: `App Permissions`, `Location`, `Camera`, `Notifications`, `Enabled`, `Disabled`; photo library computed but not shown | PASS | `AppPermissionsScreen.tsx`, `LISTED_PERMISSIONS` |
| R9 | More page copy `More Options`, `Delete My Account`, `Permanently remove your account & data` | PASS | `MoreOptionsScreen.tsx` |
| R10 | Delete modal copy `Delete Account?` / message / `Cancel` / `Delete` | PASS | `MoreOptionsScreen.tsx`; smoke test asserts the strings |
| R11 | Toast `Account deleted successfully` | PASS | `MoreOptionsScreen.tsx` |
| R12 | Logout modal `Confirm Logout` / `Are you sure you want to logout?` / `Logout` | PASS | `StaffSettingsScreen.tsx:45` |
| R13 | Header logo / org placeholder, `Loading...` overlay, `emp_home_loading` write | DEVIATION-OK | Modern UI (BUILDER_BRIEF s3); dead state (spec 13(f)); not ported per FIX_POLICY B7 |
| R14 | Appearance row | DEVIATION-OK | Requested addition, B5 Deviations |
| R15 | Notifications enabled iff authorized/provisional; Android 13 POST_NOTIFICATIONS | PASS | `lib/platform/permissions.native.ts` (expo-notifications `granted`); `app.config.ts` declares POST_NOTIFICATIONS |
| R16 | Delete semantics for employees/managers (could remove the org?) + stronger confirmation | Needs decision | Single confirm kept (B11 Deferred) - see section "Needs decision" |
| R17 | `manager_permissions` stale until re-login | Needs decision | Session list read reactively but only refreshed at login - see below |
| R18 | Logout does not unregister push token server-side | Needs decision | No endpoint (B1 Backend needs) - see below |
| R19 | Plan gating on this screen: none | PASS | no gate in screen |

## 2. shared/systems/auth_and_session (section 13 + rules)
| # | Bullet / rule | Status | Evidence |
|---|---|---|---|
| 1 | No stored device token -> OTP required | OUT OF SCOPE | Login screens (B1 / auth audit) |
| 2 | Stored token -> verify-device-token + Continue path | OUT OF SCOPE | B1 |
| 3 | Role mismatch messages `Access denied. Employee credentials required.` / `Admin credentials required.` | PASS | `store/auth.ts` `ACCESS_DENIED_*`, `sessionFromLogin` validates role BEFORE `signIn` (FIX_POLICY B3) |
| 4 | Staff login session has `deviceToken`, `managerPermissions`; last-login stored; staff home opens | PASS | `sessionFromLogin` (manager permissions only for role 2), `signIn` writes `lastLoginAt` (`store/auth.ts:176`) |
| 5 | Admin session has no device token | PASS | `sessionFromLogin` admin branch |
| 6 | Logout: auth gone, caches cleared, stack cleared, device token kept | PASS | `performSignOut`; `SESSION_SCOPED_KEYS` excludes `deviceToken`, `lastOrg` (`lib/storage.ts:73-86`) |
| 7 | `last_org_{uid}` = previous org on clear | PASS | `store/auth.ts:243` (all roles) |
| 8 | Admin restores last company B at login | OUT OF SCOPE | B1 (`getLastOrg` + company details) |
| 9 | Account deletion: toast then `/` after 1.5 s | PASS | row 14 above |
| 10 | Force logout within 30 s or on next foreground | PASS | `sessionWatch.ts:14` `SESSION_POLL_MS=30000`; `useSessionWatcher.ts` poll + `useAppForeground` |
| 11 | No userId -> redirect to `/` | PASS | `RoleGuard` + `resolveAreaGuard` |
| R1 | Session poll roles 2/3 only (needs device token); admins never polled | PASS | `isSessionWatched` (`sessionWatch.ts:21`) |
| R2 | Grace 5 min after login | PASS | `LOGIN_GRACE_MS`; `runSessionCheck` returns `grace` |
| R3 | Fail open on network/HTTP error; only `force_logout` signs out | PASS | `api/requests.ts` `checkSession` (ApiError -> valid) + `runSessionCheck` catch -> `error`; `mapSessionCheck` |
| R4 | Poll/listener/sockets keyed to reactive store (v1 cold-start snapshot bug); late answer for previous user ignored | PASS | `useSessionWatcher.ts` deps; `runSessionCheck` `stale` outcome; `sessionWatch.test.ts` |
| R5 | Cold-start check without grace racing the redirect (v1 `index.tsx`) | PASS | single watcher with grace; no duplicate check |
| R6 | Single logout function: stop tracking, close sockets, clear query cache + stores + badges | PASS | `performSignOut` + registered teardowns (`lib/platform/trackingCore.ts` -> `stopAllTracking`; `useBootstrapTeardown`; `features/chat/utils/chatSession.ts`); sockets/poll/push stop with session null; announcements store resets reactively |
| R7 | Forced logout notice on welcome | PASS | `store/ui.ts` `signOutNoticeMessage` (shown by B1 welcome) |
| R8 | Dead duplicated logouts / `AsyncStorage.clear()` paths not ported | DEVIATION-OK | FIX_POLICY B7 |
| R9 | Device token / push token revoked server-side at sign-out | Needs decision | backend endpoint missing (B1 Backend needs) |
| R10 | Real session token / Authorization header | DEVIATION-OK | FIX_POLICY C/D: no backend support; v1 identity model kept (store header comment) |

## 3. shared/systems/push_notifications (section 13 + rules)
| # | Bullet / rule | Status | Evidence |
|---|---|---|---|
| 1 | Permission granted + logged-in start -> token fetched, POSTed `{user_id, push_token}`, stored | PASS | `usePushRegistration.ts`, `pushToken.ts` (`updatePushToken`, `STORAGE_KEYS.pushToken`) |
| 2 | Permission denied -> no POST, no crash | PASS | `registerForPush` returns null (`notifications.native.ts`); `refreshPushToken` try/catch |
| 3 | Foreground return re-registers and re-POSTs | PASS | `useAppForeground` in `usePushRegistration.ts`; concurrent calls share one run |
| 4 | Foreground `new_message` -> Chat badge +1 once, local notification (default `New Message`, sound) | PASS | `events.ts` `interpretPushData` + shared dedupe; `foregroundLocalNotification`; `usePushEvents.ts` |
| 5 | Foreground `new_group_message` default title `New Group Message` | PASS | `notificationRouting.ts:117-118` |
| 6 | `punch_in/out` push stored (max 50, de-dupe 10 s per user+type), home bell updates | DEVIATION-OK | De-dupe implemented (`globalRealtime.isDuplicatePunchPush`, `PUNCH_DEDUPE_MS`); persistence + bell not built: F3b Deferred, B2 "punch-notification panel (dead UI) not built" |
| 7 | `announcement` push branch/dept -> targeted else broadcast | PASS | `classifyAnnouncementTarget` (`events.ts:47`); B9b recomputes exact counts after each fetch |
| 8 | Tap routing table (punch -> admin home; chat by role -> direct chat; group likewise; `request_submitted` -> requests; `request_updated` -> staff requests; announcement/ticket/poll -> staff home) | PASS | `notificationRouting.ts` `parseNotificationTarget` (+ `resolveTapTarget` role-aware redirect to role home, `notificationGlue.ts`); tests in `notificationRouting.test.ts`, `notificationGlue.test.ts` |
| 9 | `force_logout` data push (roles 2/3) logs out, no local notification | PASS | `usePushEvents.ts:48`; `isForceLogoutPush` |
| 10 | Android channel `attendance_notifications` (MAX, vibration `[0,250,250,250]`) | PASS + fixed | `ensureNotificationChannel` (`notifications.native.ts:100-117`); FCM default channel added (G3) |
| 11 | Logout removes local `pushToken` and asked flag | PASS | both in `SESSION_SCOPED_KEYS`; asked flag is dead in the new code (DEVIATION-OK, FIX_POLICY B7) |
| R1 | Tap on local re-display routes | PASS | `notifications.native.ts` response listener + `getLastNotificationResponseAsync` |
| R2 | Cold-start tap held until hydrated + navigator + settled | PASS | `usePushEvents.ts` `settled`/`pending` |
| R3 | Tap while signed out opens nothing | PASS | `resolveTapTarget` null |
| R4 | Chat tap carries conversation id | PASS | `userId` / `groupId` params (B9a accepts them) |
| R5 | Token logging removed, token logic centralised | PASS | one `refreshPushToken` |
| R6 | Token rotation POSTed | PASS | `onTokenRefresh` |
| R7 | Foreground presentation: alert, sound, no badge | PASS | `notifications.native.ts` `configure()` |
| R8 | Web: no FCM, local notifications via Notification API, taps routed | DEVIATION-OK | documented in `notifications.ts` header (Web Push out of phase) |
| R9 | Ask for notification permission in context, not at start | Needs decision | `refreshPushToken` calls `registerForPush()` (prompts) right after sign-in/start, i.e. before/with the onboarding intro. Spec 12 "Fix" vs "Port as-is: re-register on launch"; changing it means pushes never start for users who press Skip. |

## 4. shared/systems/navigation_and_routing (section 13 + rules)
| # | Bullet / rule | Status | Evidence |
|---|---|---|---|
| 1 | Cold start: admin -> admin home, role 2/3 -> staff home | PASS | `useRootRedirect` / `homeForRole` (`routeGuard.ts`, `config/routes.ts`) |
| 2 | No stored auth -> role chooser | PASS | `resolveRootRedirect` (`href: null`) |
| 3 | Android channel after first launch | PASS | G3 row |
| 4 | App start with user -> push token requested/stored/POSTed; foreground re-registered | PASS | section 3 rows 1, 3 |
| 5 | Role 2/3 + device token + `force_logout:true` -> cleared, lands on `/` | PASS | `runSessionCheck` -> `signOut({reason:'forced'})` |
| 6 | Same user logged in < 5 min ago -> checks skipped | PASS | `withinLoginGrace` |
| 7 | Non-OK / network failure -> not logged out | PASS | `checkSession` fail-open |
| 8 | FCM `force_logout` foreground for role 2/3 -> logged out | PASS | `usePushEvents.ts:48` |
| 9 | Admin: no session poll / FCM force-logout listener | PASS | `isSessionWatched`, `isForceLogoutPush` role gate |
| 10 | Tab roots no animation / no swipe-back; sub-screens slide from right | PASS | `AreaLayouts.tsx:12-16` `areaScreenOptions` |
| 11 | Auth screens fade, no swipe-back | PASS | `_layout.tsx` `FADE_ROUTES` (`index`, `admin-login`, `staff-login`) |
| 12 | Tabs Home/CRM/Chat/Settings per role map | PASS | `shellNav.ts` `SHELL_TABS` (admin `/admin/*`, role 2/3 `/staff/*`); `shellNav.test.ts` |
| 13 | Android back on home exits the app | PASS | tabs `firstRoute` + single-entry stack after `replace` |
| 14 | Admin CRM hardware back prefetches and shows home | DEVIATION-OK | v1 prefetch/GlobalCache replaced by react-query (FIX_POLICY B8/ARCHITECTURE s5); back from a tab goes to Home |
| 15 | Chat screen with open conversation: back closes conversation first | DEVIATION-OK | conversation is a route (B9a Deviations) |
| 16 | Settings sub-view back order | DEVIATION-OK | sub-views are real routes (spec 5.2 "model as nested routes") |
| 17 | Logout clears stack and shows `/` | PASS | `RoleGuard` redirect (row 13 of emp_settings) |
| 18 | Notification tap opens mapped route | PASS | section 3 row 8 |
| 19 | New login as another user in the same session: poll and socket target the new user | PASS | session-keyed hooks (`useSessionWatcher`, `useGlobalSocket` deps `[userId]`); `signIn` resets caches/badges on user change |
| R1 | Init order / splash gate (auth hydrated + fonts, safety timeout) | PASS | `_layout.tsx` `useAppReady`; `appReady.test.ts` |
| R2 | Home tab navigates to the role home (not `router.back()`); no re-push of current tab | PASS (fix of v1 F5) | `useShellNav.ts:68-69` |
| R3 | Highlight of sub-areas (reports/requests/add staff) | PASS | `activeTabKey` `within` lists |
| R4 | Manager inside `/admin/*` shortcuts keeps the staff shell and tabs | PASS | `variantForRole` (role 1 only is admin shell) |
| R5 | Role guards for `/admin/*` (1, 2) and `/staff/*` (2, 3) | PASS | `routeGuard.ts:10-12` |
| R6 | Dead/duplicated session logic, `as any` pushes, flag-then-replace protocol | DEVIATION-OK | FIX_POLICY B7/B8 |

## 5. shared/systems/badges_and_realtime (section 13 + rules)
| # | Bullet / rule | Status | Evidence |
|---|---|---|---|
| 1 | Global-socket chat message -> Chat badge +1 exactly once (FCM / chat socket also deliver) | PASS | `globalRealtime.ts` shared deduper + `store/badges.ts` `registerMessageId`; chat sockets never count (`socket.ts`) |
| 2 | Own message (`sender_id == self`) -> no increment | PASS | `events.ts:87` (socket), push path `interpretPushData` |
| 3 | Opening a conversation with N unread -> badge -N (min 0) | PASS | `store/badges.ts` `markChatRead`; `useDirectConversation.ts:158`, `useGroupConversation.ts:104` (B9a) |
| 4 | Announcement event (role 2/3) -> badge up, exact after refetch; opening Broadcast marks seen | PASS | `globalRealtime.ts` `addAnnouncement` + `useAnnouncementUnreadSync` (B9b) |
| 5 | Admin: announcement and CRM counts stay 0 | PASS | `addAnnouncement` role gate; `tracksCrmBadge` roles 2/3 |
| 6 | Employee opens CRM -> badge 0, ids stored; new lead -> 1 after refresh | PASS | `features/crm/hooks/useCrmBadgeSync.ts` (B10) |
| 7 | Socket drop reconnects within ~3 s; foreground attempts connect | DEVIATION-OK | backoff 1 s -> 30 s with jitter, first retry ~1 s (F3b; spec v2 "add backoff"); `reconnectNow` on foreground (`socket.ts`) |
| 8 | Badge > 99 reads `99+` | PASS | `CountBadge` (`max=99`), `shellNav.formatBadgeCount` |
| 9 | `request_submitted` event on admin -> requests badge +1 | PASS | `globalRealtime.ts` `addRequest` (roles 1, 2) |
| 10 | `badge_update` with notification stored (max 50) + bell | DEVIATION-OK | published on `realtimeBus` only; F3b / B2 Deferred |
| 11 | Logout then login as other user -> counts and sockets reflect new user only | PASS | `resetBadges`, `resetGlobalRealtime`, socket effect keyed on user id, `resetUnread` |
| R1 | Chat tab = chat + announcements; CRM tab = new leads, hidden on CRM tab | PASS | `shellNav.tabBadgeCount` + test |
| R2 | Chat unread seeded from server at start (individual + group) | GAP-fixed (G5, concurrent) | `useChatBadgeSeed` |
| R3 | Ping 30 s `'ping'`, ignore non-JSON, ignore own frames, CONNECTING respected | PASS | `socketCore.ts` (`pingMs=30000`, state checks) |
| R4 | Event table: `new_message`/`new_chat_message` (+ `new_group_message`), `announcement`, `request_submitted`, `badge_update` | PASS | `events.ts` `interpretSocketFrame` |
| R5 | Per-user seen ids (announcements, leads); cleared on sign-out | PASS | `STORAGE_KEYS.*` scoped, in `SESSION_SCOPED_KEYS` |
| R6 | Announcement double count (WS then fetch heals; FCM did not) | PASS (fixed in v2) | `useAnnouncementUnreadSync` recomputes after every fetch |
| R7 | Dead `chat_message` bus / `crm_badge_count` not ported | DEVIATION-OK | FIX_POLICY B7 |
| R8 | Employee request badge on home / admin pending counts + 10 s polls | OUT OF SCOPE | B2 / B8 / B11 / B12 audits (`useRequestBadges`, `useRequestBadge`) |

## 6. shared/systems/plan_gating (section 8 + rules)
| # | Bullet / rule | Status | Evidence |
|---|---|---|---|
| 1 | Free trial: everything accessible | PASS | `config/plans.ts` `isPlanFeatureBlocked`; `plans.test.ts` |
| 2 | Core: staff location + CRM blocked with Prime message; chat/salary/punch allowed | PASS | `PLAN_BLOCKED_FEATURES[1]`; `planBlockMessage` admin wording |
| 3 | Prime: only CRM blocked (Elite message) | PASS | `PLAN_BLOCKED_FEATURES[2]` |
| 4 | Elite: nothing blocked | PASS | `PLAN_BLOCKED_FEATURES[3]` |
| 5 | Expired or no plan: all five blocked with trial-ended message | PASS | evaluation order unchanged (trial -> expired -> null -> matrix) |
| 6 | Blocked CRM tab press: toast ~3.5 s, no navigation or prefetch | PASS | `useShellNav.ts:61-64` (`toast.info`, default duration 3500 ms: `components/ui/internal/toastStore.ts:39`) |
| 7 | Employee on expired plan taps Punch -> `Feature Unavailable` / `Your plan has expired. Please contact your admin.` | PASS | `features/employee/hooks/usePunchFlow.ts:90` with `PLAN_PANEL_MESSAGES.staff` |
| 8 | iOS: `View Plan Status`, no payment path, no expiry popup | OUT OF SCOPE | `features/chat/screens/hub/hubLogic.ts` (B9b), B2/B5 |
| 9 | Add Staff limit banner / disabled submit | OUT OF SCOPE | B3b |
| 10 | Expiry popup once/day, 7-day window, expired not dismissible | OUT OF SCOPE | B2 / B5 |
| 11 | Payment completed -> plan refreshed, toast | OUT OF SCOPE | B5 (invalidates `queryKeys.plans.all`) |
| R1 | Plan read from plan-status API for every role (`useOrgPlan`), not stored `plan_id`; matrix unchanged | PASS | `hooks/useOrgPlan.ts`; `useOrgPlan.test.tsx` (staff case); FIX_POLICY B5 |
| R2 | CRM tab: one rule (`isFeatureBlocked`), tabs always visible, blocked on use | PASS | `shellNav.decideCrmPress` |
| R3 | Status unknown (loading / error) fails open | PASS | `isFeatureBlocked(null)`; F3b |
| R4 | Status refreshed during a long session | GAP-fixed (G4) | `usePlanStatusRefresh.ts` |
| R5 | Staff wording: expired -> `Your plan has expired. Please contact your admin.`; active Core/Prime CRM block -> `This feature isn't available on your organisation's current plan. Please contact your admin.` (v1 showed the admin "available only in the Prime/Elite plan" text to everyone) | DEVIATION-OK | plan_gating s7 "admin vs employee wording (employees are told to contact admin)"; `config/plans.ts` `MSG_STAFF_TIER`. Confirm copy (see Needs decision) |
| R6 | CRM data prefetch with `Loading...` overlay on tab press | DEVIATION-OK | F3b Deferred (optional in brief); v1 used admin endpoints even for staff; react-query screens show skeletons |
| R7 | Backend enforcement of plans | Needs decision | client-only (spec s5/s7) |

## 7. shared/systems/permissions_and_onboarding + components/PermissionOnboarding
| # | Bullet / rule | Status | Evidence |
|---|---|---|---|
| P1 | Admin first login: onboarding 1.5 s after load, completion stored, never again | PASS | `usePermissionOnboarding.ts` (`ONBOARDING_DELAY_MS`, per-user key) used by `features/dashboard/components/DashboardOverlays.tsx` |
| P2 | Employee first login: onboarding shows, per-user flag | PASS | `features/employee/components/HomeOverlays.tsx` |
| P3 | Notifications step: Enable Notifications prompts, skipping does not | PASS | `PermissionOnboarding.tsx` `requiresUpfront` |
| P4 | Face registration with denied/`canAskAgain=false`: `Permissions Required` + `Open Settings` | PASS | `usePunchFlow.ts:77,97` (B11) |
| P5 | Location off at punch: `Location Required` + `Open Settings` | PASS | `usePunchFlow.ts:105` |
| P6 | Settings -> App Permissions refreshes on return | PASS | emp_settings #12/#18 |
| P7 | Android 13+ notification status = POST_NOTIFICATIONS | PASS | `permissions.native.ts` via expo-notifications; manifest permission in `app.config.ts` |
| P8 | Dead modules (`permissions.ts`, `permissionManager.ts`) not ported | DEVIATION-OK | FIX_POLICY B7; single `lib/platform/permissions` |
| P9 | Per-user onboarding key for both roles, survives sign-out | PASS (fix) | F4 |
| P10 | Fresh registration re-shows admin onboarding (`fromRegistration`) | DEVIATION-OK | New user id = new per-user key, appears naturally; `resetOnboarding` available (F4) |
| P11 | Usage strings accurate (camera for face verification / profile / chat) | PASS | `app.config.ts` infoPlist + plugin strings name Clockyn and the real purposes |
| P12 | Background-location "Always" request in context for field staff | Needs decision | not built (B11 Known gaps; spec s9 "request ... in context"); Android-only background tracking exists |
| C1 | `visible=false` renders nothing; true shows intro first | PASS | `Modal visible` + step reset on show |
| C2 | Continue -> Step 1 "STEP 1 OF 4", 4 dots, Back returns to intro | PASS | `PermissionOnboarding.tsx` (`INTRO=-1`, `ProgressDots`) |
| C3 | Role-specific intro subtitle/info and step descriptions | PASS | `permissionCopy.ts` (every string compared with the spec table; product name = Clockyn) |
| C4 | Skip / Skip Now / Skip All -> `onComplete` once, no prompt | PASS | `finish()` guarded by `completed` ref |
| C5 | Location/Camera/Photo Next -> no prompt; last step `Finish` | PASS | `primaryTitle` |
| C6 | Notifications step advances whether granted or denied; `Not now` advances without prompt | PASS | `primary()` always `advance()` |
| C7 | `onPermissionGranted('Notifications')` callback | DEVIATION-OK | prop dropped (wired to no-ops by both v1 callers; F4) |
| C8 | Flow persisted per user; reappears never | PASS | `markOnboardingDone` |
| C9 | Android back swallowed while open | PASS | `dismissible={false}`, no-op `onClose` (F4 documents intent) |
| C10 | Feature chips `Secure & Private`, `Data Protected`, `Revoke Anytime`; step labels derived from list length | PASS | `permissionCopy.ts`, `STEP ${step+1} OF ${total}` |
| C11 | Per-step permission requests at point of use (camera, location, photos) | PASS | `requestPermission` in feature code (B3b/B11/B12/chat); out-of-scope detail |

## 8. components/UnifiedBottomNavigationBar (acceptance)
| # | Bullet | Status | Evidence |
|---|---|---|---|
| U1 | Tabs navigate per role map | PASS | nav row 12 |
| U2 | Only current tab highlighted; reports/requests sub-areas highlight parent or none | PASS | `activeTabKey` |
| U3 | Chat badge = chat + announcements (3 + 2 = 5; 120 -> `99+`) | PASS | `tabBadgeCount`, `formatBadgeCount` tests |
| U4 | CRM badge shows unseen leads when not on CRM; hidden on CRM | PASS | `tabBadgeCount` (`activeKey === 'crm' ? 0`) |
| U5 | Core/Prime admin CRM press -> no navigation, ~3.5 s toast | PASS | plan_gating #6 |
| U6 | Elite / trial CRM press -> `Loading...` overlay + prefetch, opens even if a request fails | DEVIATION-OK | prefetch not ported (F3b); opens immediately and the CRM screen loads with skeletons |
| U7 | `onCrmPress` override bypasses gate | DEVIATION-OK | per-screen overrides disappear with a layout-level bar (spec v2 note) |
| U8 | Settings pressed on a settings page does nothing | PASS | `useShellNav.ts:68` (already on tab root) |
| U9 | Home pressed on sub-screen returns to home (not `router.back()`) | PASS (fix) | `useShellNav.ts:69` `router.navigate(tab.route)` |
| U10 | Employee on a paid plan presses CRM -> opens | PASS | `decideCrmPress` staff Elite test; plan from plan-status |
| U11 | Safe area above home indicator | PASS | `TabBar.tsx` `bottomPad = max(insets.bottom, android 6)` |
| U12 | Plan toast text from plan matrix | PASS | `decideCrmPress` + `planBlockMessage` |
| U13 | Dead logout modal not ported; a11y labels on tabs | PASS | `TabBar.tsx` `accessibilityLabel` incl. unread count |

## Files changed
- `src/features/employee/screens/MoreOptionsScreen.tsx` (G1)
- `src/features/employee/screens/StaffSettingsScreen.tsx` (G2)
- `src/features/employee/__tests__/SettingsScreens.test.tsx` (updated/extended)
- `src/features/employee/utils/__tests__/managerShortcutsContract.test.ts` (new)
- `app.config.ts` (G3, one plugin option)
- `src/lib/platform/__tests__/notificationChannel.test.ts` (new)
- `src/components/layout/bootstrap/usePlanStatusRefresh.ts` (new, G4)
- `src/components/layout/bootstrap/__tests__/usePlanStatusRefresh.test.ts` (new)
- `src/components/layout/Bootstrap.tsx` (additive: mounts `usePlanStatusRefresh`; the `useChatBadgeSeed` line in the same file was added concurrently by another engineer)
- `docs/qa/Q4d-B.md` (this file)

## Verification
- `npx jest src/components src/store src/lib src/hooks src/config src/features/employee src/features/team-rules`: 66 suites / 797 tests pass.
- `npx tsc --noEmit`: clean (whole project at time of run).
- `npx eslint src/features/employee src/components/layout src/lib/platform/__tests__/notificationChannel.test.ts app.config.ts`: clean.
- `npm run check:brand`: my files are clean; it currently FAILS on `docs/qa/Q4d-C.md:24-27` (another auditor's file contains absolute paths with the legacy folder name). Use relative paths in QA docs.

## Needs decision (no behaviour changed)
| # | Item | Evidence | Why it needs a decision |
|---|---|---|---|
| D1 | Manager permissions stay stale until re-login (spec 13(g), states matrix) | `store/auth.ts` session carries the login-time list; `managerShortcuts` reads it reactively. A refresh endpoint exists in the v1 backend (`GET /managers/{userId}/permissions`, shared/api/manager.md fn 5) but it is the admin settings API; it is unknown whether it accepts a manager caller and it returns the whole catalogue map | product/backend: refresh on foreground via that endpoint or a new `me/permissions` route |
| D2 | Push permission prompt timing (spec push 12 "ask in context") | `usePushRegistration.ts` -> `registerForPush()` prompts on sign-in/start, before the onboarding intro appears (1.5 s later), so the onboarding "Enable Notifications" step is mostly a no-op | Moving the prompt into the onboarding means users who Skip never get push; product call |
| D3 | Server-side push-token / device-token revocation at sign-out | no endpoint (B1 Backend needs); the previous user keeps receiving pushes on that device until the token is overwritten | backend endpoint needed |
| D4 | Delete My Account semantics for employees/managers (`DELETE /company/delete-account/{id}`; could remove the organisation) and single confirm | `MoreOptionsScreen.tsx`; B11 Deferred | backend/product (typed confirmation?) |
| D5 | Staff-facing block message for active Core/Prime plans | `config/plans.ts` `MSG_STAFF_TIER` (new copy, not in v1; v1 showed the admin upgrade text to staff) | confirm wording or revert to v1 text |
| D6 | Punch notification list + bell (`STORAGE_KEYS.punchNotifications` unused) | F3b / B2 deferred (v1 UI was dead) | product: keep the feature? |
| D7 | Background ("Always") location request flow for field staff | B11 Known gaps | product / store policy |
| D8 | Plan gating is client-side only; chat/CRM endpoints answer a wrapped 500 on plan block | spec plan_gating s5, F2b2 Backend needs | backend enforcement + real 403 |

Observations (no action): `punch_in/out` taps send a manager (role 2) to the admin home (explicitly tested in `notificationGlue.test.ts`, same as v1 `/home`); the Settings header no longer shows the organisation logo (visual redesign); `STORAGE_KEYS.pushPermissionAsked` is a dead key (candidate for removal).
