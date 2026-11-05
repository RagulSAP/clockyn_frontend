# Q3 - End-to-end report (staff / manager app + app-wide behaviour)

Scope: `/staff/*` (punch, calendar, profile, settings, requests, expenses, CRM, chat), manager shortcuts into `/admin/*`, and app-wide
behaviour (session watcher, theme, responsive shell, keyboard, deep links, 404, failure/latency states).
Harness: Playwright on the web export against the stateful mock (`e2e/README.md`). Specs: `e2e/specs/q3-*.spec.ts` (253 tests per project, 506 in total
on `desktop` 1280x800 + `phone` 390x844). Helpers: `e2e/support/q3.ts`. Isolation: `E2E_ARTIFACTS=e2e/.artifacts-q3 MOCK_PORT=8803 E2E_WEB_PORT=8830`.

Result of the final run: see "Final state" at the bottom.

## Journeys covered

| Journey | Spec | Result |
|---|---|---|
| Home first look, quick-action grid navigation | `q3-01-punch` | pass |
| Face registration (4 guided photos, preview, register, persisted; failure + retry; camera permission denied) | `q3-01-punch` | pass |
| Punch-in (permissions -> GPS -> geofence -> camera -> success), outside branch (`Outside Branch Area`), geofence request failure, expired plan (`Feature Unavailable`), no location permission | `q3-01-punch` | pass |
| Two sessions, `LIMIT REACHED`, punch-out, COMPLETE/WORKING chips | `q3-01-punch` | pass |
| Face mismatch -> forced retry ("Sent for admin review"), "no face" retry, holiday, server rejection keeps camera open | `q3-01-punch` | pass |
| 10 s poll picks up admin/other-device punches | `q3-01-punch` | pass |
| Field-staff tracking: `POST /staff-location/log` while punched in, stops after punch-out / on 403 / on sign-out; office staff never upload | `q3-01-punch`, `q3-12-accounts-and-edges` | pass |
| Shift timer: idle, remaining, overtime, two sessions, complete, night shift 21:00-06:00 (frozen/flowing browser clock) | `q3-02-shift-timer`, `q3-12-accounts-and-edges` | pass |
| Request badge (home + hub), birthday popup (once per run), permission onboarding (once per user, not dismissible by Esc), rate-prompt counter | `q3-03-home-overlays` | pass |
| Attendance calendar: statuses/colours/legend, Late caption, day sheet (sessions, photos, viewer), absent/future days, month nav + error/retry, payslip + retry, advances, client half-day, approved-leave overlay | `q3-04-attendance`, `q3-12-accounts-and-edges` | pass |
| Profile: view, edit + save, validation, unsaved-changes guard (Keep editing / Exit / Save), photo upload + failure, load failure; name change on home | `q3-05-profile-settings` | pass |
| Staff Settings: rows, App Permissions, Appearance (dark persists, system follows), logout confirm/cancel, delete account (confirm, failure) | `q3-05-profile-settings` | pass |
| Manager shortcuts: all 10 permission-gated shortcuts (18 destinations) route into `/admin/*` / `/staff/reports`; fewer permissions = fewer; none = no block | `q3-05-profile-settings` | pass |
| Requests hub (badges, pre-load fallback), leave (today ok, Sunday/past/pending/rejected blocked, multi-month chips, sorted payload, month-end range, validation, server error, calendar failure + retry), permission (slots, 6 h, HH:mm, validation order), shift change (tabs, validation, history, empty/error), device change in-app and pre-login (no tab bar/sidebar, warning card, success -> staff login, back without history) | `q3-06-requests` | pass |
| Expenses hub, odometer (photo-before-record, validations, readings table, stop distance, date nav clamp, upload failure), travel tickets + bills (record then photo, rounded total, amount validation, upload failure -> retry banner without duplicate, date nav clamp, list failure) | `q3-07-expenses` | pass |
| Staff CRM: my leads, filters, work-status update/failure, carry-forward request, add lead (validation, success, rejection), new-lead badge (appears, clears on open, returns for a new lead), plan gate (elite opens; core/prime/expired toast + `CRM Unavailable`, no lead fetch) | `q3-08-staff-crm` | pass |
| Chat: hub badges + plan gate, direct list (admin pinned first), send/retry, WS push (hub badge, open conversation), mark-read + badge decrement, group list/send/WS push, broadcast + targeted feeds (seen ids per user, badge counts, WS announcement), per-user seen ids, Chat tab total | `q3-09-staff-chat` | pass |
| Session watcher: forced logout, device takeover on next poll, 5-minute grace (clock), fail-open, admin not watched | `q3-10-app-wide` | pass |
| Theme persistence from first paint, system-follow, sidebar theme switch; responsive shell at 360/767/768/1099/1100/1440 + live resize; no horizontal overflow on 16 staff routes at 360/768/1280; keyboard (Tab/Enter), Escape closes sheets/dialogs, focus trap in a dialog | `q3-10-app-wide` | pass |
| Deep links (signed-out, wrong role, params), back navigation, 404 (signed in/out), latency and API-failure states on home, hub, calendar, profile, offline punch | `q3-10-app-wide` | pass |
| Account switching in one browser (no data of the previous user), manager (role 2) punch-out | `q3-12-accounts-and-edges` | pass |
| Visual sweep: 34 screens x light/dark x desktop/phone (structural checks + screenshots) | `q3-11-visual` | pass |

## Defects found

| # | Sev | Defect | Evidence | Fix | Regression test |
|---|---|---|---|---|---|
| Q3-D1 | Medium | Stack screens (every `Screen` with a title) hid the Back button whenever the router had no history. After a reload or deep link on a phone there is no tab bar either, so the screen was a dead end (leave, permission, device change, expenses, profile...). | `q3-10` "after a reload / deep link ... still offers Back" failed: no "Go back" button on `/staff/requests/leave`. | `src/components/layout/Screen.tsx`: Back is always offered on stack screens (tab roots keep `hideBack`); `defaultBack` falls back to `/` (root redirect to the role home). | `q3-10-app-wide` (deep-link back), jest `layout.test.tsx` ("without history ... still offered") |
| Q3-D2 | Medium | Attendance calendar "Bonus / Advance" sheet printed the admin's **user id** (`Added by: adm-0001`) instead of the name (spec: `created_by_name`). | `q3-04` advance test. | `src/features/employee/components/RecordSheets.tsx` reads `raw.created_by_name`. | `q3-04-attendance` (advance sheet), jest `AttendanceCalendarScreen.test.tsx` |
| Q3-V1 | Low | Face camera top bar showed an empty dark circle (spacer rendered with the button style) in the preview step of face registration. | screenshot `face-registration-preview` (phone). | `faceCaptureParts.tsx`: transparent `roundSpacer`. | `q3-01-punch` registration test (no empty 40 px circle) |
| Q3-V2 | Low | Home greeting was cut to "Good Evening, Aarav Sh..." next to the status chip on phones. | screenshot `staff-home-working` (phone). | `HomeParts.tsx`: greeting wraps to two lines. | `q3-01-punch` first-look test (not clipped) |
| Q3-V3 | Low | Chat hub card title "Targeted Announcement" truncated on phones. | screenshot `dark-chat-hub`. | `HubMenuCard.tsx`: title may use two lines. | `q3-09-staff-chat` hub test (not clipped) |

No defects were found in: punch pre-check order, geofence, forced retry, 2-session limit, timer/overtime maths, leave rules, expenses retry/no-duplicate, CRM plan gate,
badge persistence per user, manager shortcut routing, session watcher, account switching.

## Observations / open items needing a decision (not changed)

1. **Chat list failure is silent for staff**: when `GET /chat/list` fails the screen still shows the pinned admin row (merged client-side) and no error/retry. Decide whether a banner is wanted (low).
2. **Rate prompt cannot be exercised on web**: no store URL exists for the web platform, so the prompt never opens (the open counter increments correctly: 1 per home mount, not per focus). Cadence is covered by `rateApp.test.ts`.
3. **Notification-tap routing** has no web trigger (no FCM, `showLocalNotification` is unreachable from the UI); `parseNotificationTarget` is covered by `notificationRouting.test.ts`. Real-device check recommended.
4. **Native date inputs** (`<input type=date>`) render `mm/dd/yyyy` regardless of the app locale (en-IN); the expense/odometer date navigator therefore shows US format while the rest of the app uses `dd MMM yyyy`. Browser behaviour; a custom picker would be needed to change it.
5. **Done-state RemainCard** keeps the v1 copy ("SHIFT DURATION" + "Time Remaining") when a day ends early with time left; kept as v1 (deferred in B11).
6. **Add Lead**: the inline "Required" error of a field stays until the next Save even after the user typed a valid value (other forms clear on change). Minor UX.
7. **Harness note**: with Chromium's emulated geolocation, a one-shot `getCurrentPosition` does not resolve while a high-accuracy `watchPosition` is active (field staff). The app falls back to the last fix after its 15 s timeout, so punching as a tracked field-staff member takes 15 s in this harness; real browsers are not affected. The field-staff punch-out test therefore punches out through the API.
8. Frozen browser clocks (`page.clock.setFixedTime`) stop animation-driven sheet closes; specs use `clock.install` (flowing) where interaction follows.
9. `npx tsc --noEmit` is at 0 errors (a transient `ClockynMap.web.tsx` error from another engineer's concurrent edit was gone by the final check).

## Screenshots reviewed

`<artifacts>/screenshots-q3/{desktop,phone}/`: visual sweep `visual-{light,dark}-<screen>.png` for home, home-working, attendance (+day sheet, payslip, advance), profile (+edit), settings, settings-manager,
permissions, more, requests-hub, leave, permission, shift-new, shift-history, device-change (+login), expenses-hub, odometer (+stop), travel, bills, crm (+empty, blocked), chat-hub, chat-direct,
chat-conversation, chat-groups, chat-group-conversation, broadcast, targeted; plus journey shots (face registration guide/preview/success, face punch camera/success/admin review, limit reached,
timer idle/working/overtime/complete, birthday, onboarding, 404, forced-logout welcome). Reviewed by eye: phone dark (all), phone light (attendance, home, leave, expenses), desktop dark (attendance, chat,
CRM, home, leave, odometer, bills), desktop light (CRM, device change, expenses hub, home). Findings: Q3-V1..V3 above; contrast, spacing and dark-mode token use were otherwise consistent.

## Coverage gaps

- Native-only paths (background location, FCM taps, native camera/permission dialogs, haptics) - web build only.
- Face recognition accuracy and the plan-gate matrix beyond CRM/chat/camera punch (other leads cover admin).
- Rate prompt visibility, push-driven badge increments (WS path covered).
- Locale variants of native date/time inputs.

## Mock backend changes (additive)

`e2e/mock-server/index.js`: `POST /__test/state { userPatch: { <userId>: { <row fields> } } }` to set preconditions (e.g. `face_registered: false`, `shift_id: 3`).

## Final state

- Full run of all `q3-*` specs on both projects: **506 passed, 0 failed** (253 tests x desktop + phone, 15.7 min, 4 workers).
- `npm run check:brand` passes; `npm run e2e:typecheck` clean; eslint clean on touched files; jest suites for touched areas green (full jest: only a slow `StaffEditScreen` timeout under load, passes alone).
