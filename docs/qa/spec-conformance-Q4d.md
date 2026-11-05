# Spec-conformance audit Q4d - employee comms, home/profile, requests/expenses, shell systems

Scope: pages 10_employee_comms, 11_employee_home_profile (emp_permission_calendar dropped), 12_employee_requests_expenses; shared components FaceRecognition/FaceRegistration; shared systems location_tracking, permissions_and_onboarding, push_notifications, navigation_and_routing, auth_and_session, badges_and_realtime, plan_gating. Detailed per-spec tables follow (parts A-D, one per sub-audit).

## Summary

| Part | Specs | PASS | DEVIATION-OK | GAP/BUG fixed | Needs decision |
|---|---|---|---|---|---|
| A | emp_home (punch), attendance calendar, personal details, FaceRecognition, FaceRegistration, location_tracking | 73 | 21 | 2 (+4 extra) | 7 (backend/product, behaviour unchanged) |
| B | emp_settings + manager shortcuts, auth_and_session, push, navigation, badges, plan_gating, permissions/onboarding, bottom nav | 131 | 27 | 5 (one shared with D) | 8 |
| C | 9 request/expense specs | 95 | 45 | 7 | 4 |
| D | 5 chat/broadcast specs | 118 | 31 | 2 | 7 |
| Total | | 417 | 124 | 16 | 26 |

Most significant fixes: submit failures with no server message toasted the SUCCESS text (all four request types) now "Failed to submit"; unknown request types inflated the Leave badge; tracking resume stopped tracking during a second session (new `stillWorking`); attendance calendar stale 30 s after a punch; delete-account failure copy and "Profile Settings" copy restored; Android FCM default channel; plan status never refreshed on native while app stayed open (`usePlanStatusRefresh`); chat tab badge not seeded at start (`useChatBadgeSeed`); staff chat hub company logo; odometer/ticket/bill copy and photo labels; personal-details avatar lost after photo upload; Android tracking notification wording.

Verified: manager shortcut permission strings match the admin catalogue char-for-char (new contract test); punch pre-check order, max 2 sessions, IST/midnight math, 10 s poll, session watcher (30 s poll, 5 min grace) conform. `tsc --noEmit` 0 errors; jest on all touched areas green (91 suites / 1176 tests); `npm run check:brand` passes.

Top open decisions: face-punch force_accept makes face/geofence advisory; /attendance/today semantics for second session & midnight; max-2 sessions client-side only; manager permissions stale until re-login; push permission prompt timing; no server-side token revocation at sign-out; delete-account scope for employee/manager; Sunday no-record wording "Weekly Off" vs v1 "Absent"; announcement targeting and unknown-target mapping; chat plan gate only on hubs (deep links bypass); see each part's "Needs decision".

---

# Q4d-A - Spec conformance audit: employee home, attendance calendar, personal details, face components, location tracking

Scope: `emp_home`, `emp_attendance_calendar`, `emp_personal_details`, shared `FaceRecognition`, `FaceRegistration`, system `location_tracking` (`emp_permission_calendar` dropped, `emp_settings` audited elsewhere).
Method: every acceptance bullet (section 14 / 9 / 10 / 12 of the specs) traced to code + tests, plus rules (section 7), flows (section 4), copy (section 8), fix list (section 13). Status: PASS / DEVIATION-OK (change log or FIX_POLICY item cited) / GAP-fixed (fixed in this pass, test added) / Needs-decision.

## Counts (acceptance bullets)

| Spec | Bullets | PASS | DEVIATION-OK | GAP-fixed | Needs-decision |
|---|---|---|---|---|---|
| emp_home | 28 | 20 | 8 | 0 | 0 |
| emp_attendance_calendar | 19 | 16 | 3 | 0 | 0 |
| emp_personal_details | 16 | 11 | 5 | 0 | 0 |
| FaceRecognition | 13 | 12 | 1 | 0 | 0 |
| FaceRegistration | 11 | 7 | 4 | 0 | 0 |
| location_tracking | 9 | 7 | 0 | 2 | 0 |
| **Total** | **96** | **73** | **21** | **2** | **0** |

Additional GAP-fixed items found in rules/flows/tests (not bullets): 4 (see "Fixes"). Needs-decision items are listed separately (all backend/product, none change behaviour here).
No BUG (wrong behaviour in the punch pre-check order, max-2 lock, midnight math, remaining/overtime/done machine, 10 s poll, force_accept handling was found).

## Fixes made in this pass

| # | Finding | Fix | Test |
|---|---|---|---|
| G1 | Android foreground-service notification wording was changed ("Location sharing is on" ...) with no change-log entry and no legacy name involved | Restored v1 wording: title `Location Tracking Active`, body `Your location is being shared for field work` (`src/lib/platform/location.native.ts`) | none possible without exporting native constants (string-only change) |
| G2 | Tracking resume (`useLocationResume`) kept the v1 rule `is_punched_in && !punch_out`; during a SECOND session a server that keeps the first punch-out would stop tracking on every foreground / cold start (Home itself deliberately ignores `punch_out`, so nothing restarted it) | New pure `isStillWorking()` (open last session also counts) used by the resume check (`src/components/layout/bootstrap/stillWorking.ts`, `useLocationResume.ts`) | `components/layout/bootstrap/__tests__/stillWorking.test.ts` (4) |
| G3 | After a punch the attendance calendar month / day-session caches stayed fresh for 30 s (default stale time), so opening Attendance right after punching could show the day as before the punch | `onPunchAccepted` invalidates `queryKeys.attendance.all(userId)` except `today` (`features/employee/hooks/usePunchFlow.ts`) | `EmployeeHomeScreen.test.tsx`: "a punch refreshes today and marks the attendance calendar caches stale" (full capture -> punch flow) |
| G4 | Personal details: v1 kept the photo URL returned by the upload when the details response carries no photo (avatar updated); the new editor dropped the upload response, so the avatar could fall back to initials after a successful upload | Upload URL is merged into the refreshed details when the server sends no `profile_photo_url` (`usePersonalDetailsEditor.ts`) | `PersonalDetailsScreen.test.tsx`: photo upload after save; details saved + toast when only the photo upload fails |
| G5 | Test gaps in the tracking requirements | `features/employee/__tests__/useFieldTracking.test.tsx` (start with org scope / `orgId || userId` fallback, stop on punch-out, nothing for non-field staff, waits for first attendance, unmount does not stop); `lib/platform/__tests__/trackingCore.test.ts` (payload with ISO timestamp, `orgId || userId`, 403 -> `false` so ALL tracking stops, other failures dropped, batch oldest-first + 20 s throttle, sign-out runs the registered teardown) | 6 + 6 |

Files changed:
- `Clockyn/src/lib/platform/location.native.ts` (G1)
- `Clockyn/src/components/layout/bootstrap/stillWorking.ts` (new), `useLocationResume.ts` (G2, shell file, additive)
- `Clockyn/src/features/employee/hooks/usePunchFlow.ts` (G3)
- `Clockyn/src/features/employee/hooks/usePersonalDetailsEditor.ts` (G4)
- Tests: `Clockyn/src/components/layout/bootstrap/__tests__/stillWorking.test.ts` (new), `Clockyn/src/features/employee/__tests__/{EmployeeHomeScreen,PersonalDetailsScreen}.test.tsx` (extended), `Clockyn/src/features/employee/__tests__/useFieldTracking.test.tsx` (new), `Clockyn/src/lib/platform/__tests__/trackingCore.test.ts` (new)
- No other shared code touched.

Verification: `npx jest src/features/employee src/components/layout/bootstrap src/lib/platform/__tests__/{trackingCore,locationLogic}.test.ts src/api/__tests__/employee.test.ts` = 21 suites / 204 tests pass; `npx tsc --noEmit` clean (whole project); `npx eslint src/features/employee src/components/layout/bootstrap src/lib/platform` clean. `npm run check:brand` currently FAILS only on `docs/qa/Q4d-C.md` (another engineer's report contains the legacy path segment in absolute paths, lines 24-27); nothing from this pass. (Unrelated: `src/lib/platform/__tests__/exportFormats.test.ts` had 1 failing test during one run - not an employee file.)

---

## 1. emp_home

### Acceptance (section 14)
| # | Bullet | Status | Evidence |
|---|---|---|---|
| 1 | role 2/3 lands on home with right nav; no auth redirects | PASS | `RoleGuard`/`useRootRedirect` (F3b); `app/staff/(tabs)/home.tsx` -> `EmployeeHomeScreen` |
| 2 | cached `empHomeData` renders instantly | DEVIATION-OK | react-query cache replaces the global cache (B11 / architecture); punch times come only from `getToday` (`useEmployeeHome.ts:72`) |
| 3 | no cache: logo/face/staff/shift (+ list fallback) load, cache written | DEVIATION-OK | independent queries (`useEmployeeHome.ts:47-71`) instead of a sequential chain; shift list fallback kept in `shiftsApi.getShift`; no behaviour lost |
| 4 | greeting 08/13/18/22 | DEVIATION-OK | IST hour via `@/lib/datetime` `greeting()` (FIX_POLICY B1) and icon instead of emoji (B11 deviations); thresholds identical (<12/<17/<21) |
| 5 | SETUP chip / SETUP FACE; registration opens with permissions granted | PASS | `punchState.ts:41-71`; `punchFlow.ts:47-55`; test "asks to set up the face..." |
| 6 | permanently denied -> Permissions Required + Open Settings / Cancel | PASS | `punchFlow.ts:50`, `usePunchFlow.ts:68-77,92-99`; web shows a browser-settings hint (no OS deep link, B11 known gap) |
| 7 | location permission off -> Location Required, camera closed | PASS | `punchFlow.ts:63-73`; copy uses Clockyn instead of the legacy name |
| 8 | GPS unavailable -> Location Error exact text | PASS | `usePunchFlow.ts:106-108`; test "explains a missing GPS fix..." |
| 9 | outside branch -> Outside Branch Area + server message | PASS | `punchFlow.ts:82`; test "tells the user when they are outside..." |
| 10 | inside branch -> recognition with `punch_in` / `punch_out` | PASS | `punchFlow.ts:83`; tests (order + action) |
| 11 | plan expired -> Feature Unavailable | PASS | `usePunchFlow.ts:86-88`, message from `useOrgPlan` = v1 text for staff; plan matrix untouched |
| 12 | shift 09-18 idle -> 09:00:00 / Total Shift Time / SHIFT DURATION | PASS | `shiftTime.ts:109-113,189-201`; test "shows the total shift length before the first punch" |
| 13 | 12:30 -> 05:30:00 blue, 3:30 hrs / 9:00 hrs, ~39 % amber | PASS | `shiftTime.test.ts` "counts down", "reports 3:30 hrs / 9:00 hrs" |
| 14 | 18:10 -> +00:10:00 OVERTIME amber, bar 100 % green | PASS | `shiftTime.test.ts` "turns into overtime", "caps at 100 %" |
| 15 | 22:00-06:00 -> 8:00 hrs | PASS | `shiftTotalSeconds` (`shiftSpanMinutes`), test "night shift" |
| 16 | two sessions 09-13 + 14-open at 16:00 = 6 h | PASS | `shiftTime.test.ts:67` |
| 17 | 2 completed -> COMPLETE + LIMIT REACHED disabled, 50 % style | PASS | `punchState.ts:25-29,83`; Home test "locks the button..."; limit style opacity .7 (token styling) |
| 18 | one completed -> still PUNCH IN | PASS | `punchState.test.ts` |
| 19 | admin edit visible within 10 s | PASS | `useEmployeeHome.ts:14,77` `refetchInterval: 10_000`, also refetch on focus (`useRefreshOnFocus`) |
| 20 | rate modal after punch | DEVIATION-OK | F4 / B11: once per home mount, never over camera/result (v1 race fix) |
| 21 | field staff: fg+bg tracking on punch-in, stop on punch-out, leaving screen stops fg only | PASS | `useFieldTracking.ts`; new hook tests; B11 deviation: leaving the screen stops nothing (v1 stopped fg) which is safer; sign-out stops all (teardown) |
| 22 | request badge counts a request once, 99+ | PASS | `punchState.ts:108-119`, `useRequestBadge.ts`, `CountBadge max=99` |
| 23 | birthdays popup per name, Close | DEVIATION-OK | once per day per app run (B11 fix of v1 re-open on every focus); line text kept (emoji dropped) |
| 24 | soft / force update modal | DEVIATION-OK | shell `UpdatePrompt` (F3b): same titles/buttons, neutral store wording, forced cannot dismiss |
| 25 | onboarding once per user | PASS | `HomeOverlays.tsx`, F4 per-user key |
| 26 | Personal Details "Loading..." overlay then navigate | DEVIATION-OK | silent prefetch of the details query (`EmployeeHomeScreen.tsx:47-54`), profile screen has own skeleton/error (B11) |
| 27 | hardware back exits app | DEVIATION-OK | B11: shell handles back |
| 28 | polling failure silent, previous values stay | PASS | react-query keeps previous data; no toast on poll |

### Rules / flows
| Rule | Status | Evidence |
|---|---|---|
| Pre-check ORDER user -> plan `camera_punch` -> face registered -> permissions -> GPS -> geofence -> camera | PASS | `runPunchChecks` (`punchFlow.ts:57-84`) + 13 order tests; face-status re-check only after user and plan gates (`usePunchFlow.ts:130`) |
| Registration branch: no geofence, no plan re-check; canAskAgain=false on either -> permanent text | PASS | `punchFlow.ts:47-55` |
| Geofence request failure shown (v1 swallowed) | DEVIATION-OK | B11 fix, FIX_POLICY B2 |
| Geofence coordinates reused for the punch | DEVIATION-OK | FaceRecognition spec section 8 fix |
| Max 2 sessions, `isMaxSessionsReached = count >= 2 && !isPunchedIn` | PASS | `punchState.ts:26`; enforced on this screen only (backend unverified - Needs decision 3) |
| `isDone` (not while punched in) | DEVIATION-OK | B11 (v1 section 13 asked to clarify) |
| IST math, 24 h roll-over of shift length; same length in RemainCard / WorkHoursCard | PASS | `shiftTime.ts` (`shiftSpanMinutes`) |
| Midnight-crossing worked time (closed + open session), skew tolerance 300 s | DEVIATION-OK | B11 fix of v1 clamp-to-0; cap 24 h; tests |
| Remaining / overtime / done state machine (remain == 0 -> overtime, done clamps) | PASS | `calcRemaining`, tests |
| Working hours card label/colours (<50 amber, >=50 blue, 100 green) | PASS | `progressTone` |
| 10 s poll + focus refresh + refetch after punch | PASS | `useEmployeeHome.ts`, `usePunchFlow.onPunchAccepted` |
| After punch: `AttendanceMarked` event (checkin/checkout), today refresh | PASS | `usePunchFlow.ts:172-176` |
| After registration: re-check `/face/check` | PASS | `onRegistered` |
| `isFieldStaff` read from fresh staff record; tracking waits for first attendance | PASS | `useEmployeeHome.ts:106`, `trackingAction` |
| Tracking stop on sign-out | PASS | `registerTrackingTeardown` + auth `signOut` teardown (test added) |
| Plan gate reactive (v1 set once, never cleared) | DEVIATION-OK | `useOrgPlan` (FIX_POLICY B5) |
| Request badge rule (leave/permission -> any pending date, else status) with fallback when the endpoint has no per-date statuses | PASS / DEVIATION-OK | `useRequestBadge.ts` (B11 backend need logged) |

### Copy (section 8)
All strings of the table are present verbatim (status chips, punch labels, state labels, time cards, working hours, quick actions, alert titles/bodies, `CHECKING…`). Differences: greeting / `Shift Complete` / birthday emoji removed (B11 "no emoji"); the permission text uses Clockyn instead of the legacy name; soft-update default body drops the store name (F3b); `Loading...` overlay not ported (see #26).

---

## 2. emp_attendance_calendar

| # | Bullet | Status | Evidence |
|---|---|---|---|
| 1 | `Loading...` until bootstrap, then month | DEVIATION-OK | skeleton while no session, per-month overlay `Loading attendance...` (`AttendanceCalendarScreen.tsx:97-104,120`) |
| 2 | colours present/late green, absent red, leave indigo, half purple, Sunday silver | PASS | `STATUS_COLOR` tokens (`attendanceCalendar.ts:17-24`); `statusWeekOff` token for Sunday (B11) |
| 3 | elapsed weekday without record = Absent, tappable | PASS | `deriveDay` `attendanceCalendar.ts:104-115`; tests |
| 4 | today without record white, not tappable | PASS | `elapsed = date < today (IST)`; `displayRecord` undefined |
| 5 | future white, no tap | PASS | same |
| 6 | approved leave without record = Leave | PASS | `mergeApprovedLeave` |
| 7 | late green + `Late`; late + under half = purple `HALF` | PASS | `deriveDay` caption rule |
| 8 | 3:50 on 9:00 = HALF; 4:30 not | PASS | `isHalfDay` (default 540 min, `< shift/2`), tests |
| 9 | Sunday silver, no HALF caption | PASS | `deriveDay` |
| 10 | year list (10) / month list (12), selecting reloads | PASS | `yearRange={[y-5, y+4]}`, query keyed by year/month |
| 11 | Monday first | PASS | `weekStartsOn={1}` |
| 12 | sessions with `SESSION n`, photos, full-screen preview | PASS | `DayDetailSheet.tsx:143-151`, `ImageViewer` |
| 13 | sessions failure -> single pair from monthly record | PASS | `pairs` fallback (`DayDetailSheet.tsx:97-103`) |
| 14 | `Total Hours` row only with data | PASS | `DayDetailSheet.tsx:154`; shown as h/m text (format only) |
| 15 | shift change from date D | PASS | `shiftForDate` (before-first-change uses the previous shift when known - B11 fix of v1 known inaccuracy) |
| 16 | Payslip / `No payslip assigned yet.` | DEVIATION-OK | sheet header shows the month returned by the server (endpoint takes no month; B11 backend need); N+1 replaced by `getAssignedPayslipId` |
| 17 | `Advance Salary` -> `Bonus / Advance` sheet | PASS | `RecordSheets.tsx` |
| 18 | month call fails -> empty month, no message | DEVIATION-OK | error + retry instead of an all-Absent month (spec section 13e, FIX_POLICY B2) |
| 19 | back arrow | PASS | `Screen title` back |

Rules: half-day rule is midnight-safe; sheet status badge uses effective status (spec 13a fixed); unknown statuses never white-on-white; IST dates; sheet badge for a Sunday without record reads `Weekly Off` (see Observations). Dead modal / unused `selectedDate` not ported.

---

## 3. emp_personal_details

| # | Bullet | Status | Evidence |
|---|---|---|---|
| 1 | cached details instantly, then refreshed | PASS | home prefetch (`EmployeeHomeScreen.tsx:47`), `staleTime 30 s`, skeleton only when nothing cached |
| 2 | empty -> `—` | PASS | `InfoRow` |
| 3 | Edit shows inputs; Branch / Employee ID read-only | PASS | `PersonalDetailsScreen.tsx:95-102` |
| 4 | digits-only + length caps | PASS | `sanitizeInput`, `FIELD_RULES`, tests |
| 5 | PAN upper-cased; invalid -> red hint + `Invalid Input` listing the field | DEVIATION-OK | lines use readable labels instead of internal keys (spec 13e); only changed fields validated (B11); shown as toast (no `Alert.alert`) |
| 6 | mobile `5123456789` blocked | PASS | regex `^[6-9]\d{9}$` (when the value was edited) |
| 7 | valid save: PUT with ISO DOB, `Saved!` 2 s, refreshed values | PASS | `toPersonalDetailsBody`, `SAVED_MODAL_MS`, timer cleared on unmount |
| 8 | `success:false` -> `Error` with server message, edits kept | PASS | `useAsyncAction` toast, draft untouched (test) |
| 9 | network failure -> `Network error` | DEVIATION-OK | the shared API client's network message is shown (no per-screen literal) |
| 10 | camera permission denied -> alert | DEVIATION-OK | toast `Camera permission is required.` (`MediaPermissionError`), gallery offered too (spec 13j) |
| 11 | new photo uploaded after the PUT, avatar updates | PASS | G4 fix (+ tests); upload failure reported by toast (13i) |
| 12 | back with edits -> Unsaved Changes (Exit / Save) | DEVIATION-OK | third button `Keep editing` (spec 13c); hardware back guarded on Android |
| 13 | back without edits leaves | PASS | test |
| 14 | Cancel with edits | DEVIATION-OK | Cancel is guarded like Back (spec 13b) |
| 15 | unnamed -> initials `?` | PASS | `Avatar name={shown.name || '?'}` |
| 16 | edited name updates the home greeting | PASS | `staff` cache + `patchSession` (spec 13h), test |

Rules: field list, hints in label parentheses, placeholders `Enter {label lower-case}`, DD/MM/YYYY display and ISO storage via pickers (13d), `1990-01-01` sentinel treated as unset (`api/employee.ts:14,29`), initials, no explicit multipart header (13f), real API module (13g), skeleton while loading (13a), success timer cleared (13l).

---

## 4. FaceRecognition (modal)

| # | Bullet | Status | Evidence |
|---|---|---|---|
| 1 | permission prompt / permanently denied screen (Open Settings, Not now) | PASS | `FaceRecognitionModal.tsx:81-89,193-206`, `faceCaptureParts.tsx:207-214` |
| 2 | capture disabled until ready, `Starting camera…` | PASS | `:254-257` |
| 3 | flash, frozen photo, `Verifying your identity…`, request fields | PASS | `:169-191,221-225`; `api/face.ts:42-62` (user_id, org_id, action, latitude, longitude, face) |
| 4 | success -> `Punched In!` / `Punched Out!` + time, `onSuccess` once | PASS | `:117-123,132-135`; tests |
| 5 | `face_mismatch` -> `Sent for admin review` | PASS | `:133` |
| 6 | "no face" -> shake + hint, camera back, no second request | PASS | `:142-145`; test |
| 7 | other failure -> second request with `force_accept` | PASS | `:147-158` (Deferred policy item C kept) |
| 8 | holiday -> `No Attendance Needed` + message + `Got it` | PASS | `:136-141,270-292` |
| 9 | first-request network failure -> `Connection error — check your network` | DEVIATION-OK | HTTP errors (e.g. plan-block 403) show the server message instead of being retried (B11) |
| 10 | forced network failure -> `Network error — tap to try again` | PASS | `:151-153` |
| 11 | 30 s timeout | PASS | `api/face.ts` `PUNCH_TIMEOUT_MS = 30_000` |
| 12 | flip camera | PASS | `CameraTopBar onFlip` |
| 13 | close resets, reopen starts idle | PASS | session component remounts per open (`:59-62`) |

Fix list of the spec (13): forced response verified + server-side check via `verifyApplied` (DEVIATION-OK, B11); no second GPS fix; late results after close ignored (`generation` guard) while `onSuccess` still fires so the home refreshes; enrol dead code not ported. Deferred (kept): `force_accept` fallback, string match on `no face`.

## 5. FaceRegistration (modal)

| # | Bullet | Status | Evidence |
|---|---|---|---|
| 1 | starts at guide, permission request, denied-forever screen | PASS | `FaceRegistrationModal.tsx:88-95,191-205` |
| 2 | start disabled until ready, `Starting camera…` | PASS | `:264,270` |
| 3 | exactly 4 photos ~0.9 s apart, prompts straight/left/right/straight, dots | PASS | `FACE_PHOTO_COUNT`, `CAPTURE_GAP_MS = 900`, `CAPTURE_INSTRUCTIONS` |
| 4 | preview of last photo with Retake / Register Face | PASS | `:219-223,276-294` (plus all four thumbnails, spec 9 fix) |
| 5 | Retake discards all | PASS | `retake` `:154-162` |
| 6 | uploading overlay, multipart `user_id`, `org_id`, 4 x `faces` | PASS | `api/face.ts` `registerFace`, 60 s timeout |
| 7 | success: first photo as profile photo, `Face Registered` + `Get Started` -> onSuccess | DEVIATION-OK | in-modal success panel instead of `Alert`, emoji dropped, profile-photo call awaited-safe (B11) |
| 8 | "no face" -> lighting message, back to guide | DEVIATION-OK | `registrationFailureMessage` exact text; shown as in-modal pill `Registration Failed — ...` instead of Alert with `Retry` |
| 9 | other failure -> server message / `Please try again.` | DEVIATION-OK | same presentation change |
| 10 | network error/timeout -> message / `Check your connection and try again.` | DEVIATION-OK | same presentation change |
| 11 | close mid-capture stops, nothing uploaded | PASS | `shouldStop` + `generation` |

Fix list: capture retry capped at 3 attempts with message (`Camera error — please try again`, new copy, B11); closing during upload drops the result.

---

## 6. location_tracking

| # | Bullet | Status | Evidence |
|---|---|---|---|
| 1 | Android punch-in with Always permission: foreground service, 20 s uploads incl. background | GAP-fixed | behaviour PASS (`location.native.ts:197-215`); notification wording restored to v1 text (G1) |
| 2 | iOS: no background task | PASS | `startBackgroundTracking` returns false off Android |
| 3 | Android without Always: false without prompt, foreground still works | PASS | `hasBackgroundLocationPermission` gate; fg `startForeground` |
| 4 | punch-out stops fg and bg, intent cleared | PASS | `stopAllTracking`, `trackingAction`; hook tests |
| 5 | relaunch while punched in resumes; already punched out -> stop + clear | GAP-fixed | `useLocationResume` + `resumeTrackingIfNeeded`; second-session rule fixed (G2) |
| 6 | 403 stops tracking (v2: fg AND bg) | PASS | `isForbiddenError` -> `uploadFixes` false -> `stopAllTracking` (fixes v1 fg leak); test |
| 7 | non field staff: nothing | PASS | `trackingAction` |
| 8 | logout stops tracking (v2 requirement) | PASS | teardown registered at module load (`location.native.ts:271`, `location.ts`), run by `signOut` (FIX_POLICY B4); test |
| 9 | payload user_id, org_id (`|| user_id`), lat, lng, ISO timestamp | PASS | `buildLocationPayload`, `api/location.ts logLocation`; test |

Constants: 20 s interval + 0.9 tolerance throttle shared by fg watcher and bg task; whole bg batch delivered (v1 sent the first fix only); persisted intent in `STORAGE_KEYS.locationTrackingEnabled`; web = foreground only.

---

## Needs decision (no behaviour changed)

1. **Face punch `force_accept` fallback** (FIX_POLICY C, B11 Deferred): any non-"no face" failure is retried with `force_accept=true` and shown as "Sent for admin review"; face matching and branch radius are effectively advisory. Evidence: `FaceRecognitionModal.tsx:147-158`. Needs product answer + backend error codes (`/face/punch` returns HTTP 200 `{success:false}` for business failures).
2. **`/attendance/today` semantics** (backend): what `punch_out` holds while a second session is open, `sessions[]` shape and post-midnight behaviour. The client is defensive (isPunchedIn drives UI/tracking; G2) but a confirmed contract would remove the heuristics.
3. **Max 2 sessions/day** is enforced on this screen only; server enforcement unverified (button lock `punchState.ts:26`).
4. **Background "Always allow" request flow for field staff on Android**: v1 never asked (only an admin page did); without it only foreground tracking works. Spec lists it as a v2 improvement; not built (B11 known gap).
5. **Delete My Account scope for employees/managers** (B11 Deferred; belongs to the settings audit) - noted only.
6. **Sunday without a record**: calendar cell is silver (v1) but the day sheet status now reads `Weekly Off` (`DayDetailSheet.tsx:17-18`) whereas v1 showed `Absent`. Product to confirm which wording/rule is intended (not logged in any change log).
7. **Weekly offs other than Sunday and holidays** are not modelled on this calendar (B11 Deferred; needs `/home/monthly-attendance` to send day types).

## Observations (not changed, low risk)
- Shift card (`ShiftCards.tsx:92`) shows 12-hour times (`09:00 AM – 06:00 PM`) where v1 printed the raw API strings (v1 spec section 7.12 flags this inconsistency); `Total Hours` is shown as h/m text instead of the raw number. Cosmetic, not in a change log.
- Day sheet hides the empty punch pair on days with no punches (v1 showed `--:--` / `No Photo` cards).
- Closing the face-registration modal while the upload is in flight drops the success callback; the home keeps `SETUP FACE` until its next face-status refetch (5 min stale time) although the server registered the face. Edge case (v1 would call `onSuccess` after the alert); a refetch on registration close would remove it.
- Punch times are mapped to `HH:mm` (`toHHmm` drops seconds); the documented server format has none, so no effect today.

---

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

---

# Q4d-C - Spec-conformance audit: employee requests and expenses (staff side)

Scope: `pages/12_employee_requests_expenses/*` (9 specs) against `src/features/requests/staff/**`, `src/features/expenses/staff/**`, `src/api/{requests,expenses}.ts`, `src/app/staff/{requests,expenses}/*`, `src/app/device-change-request.tsx`, `src/config/routes.ts`.
Status key: PASS (file:line) / DEV-OK (FIX_POLICY item or B12 change log) / GAP-FIXED (found and fixed here) / DECISION (needs product/backend decision, behaviour unchanged).

## Counts

| PASS | DEV-OK | GAP-FIXED | DECISION |
|---|---|---|---|
| 95 | 45 | 7 | 4 |

(Rows below; each row is one acceptance bullet or business rule / copy group.)

## Gaps found and fixed

1. BUG (all four request submits): `submitResult()` passed the SUCCESS text ("Leave request submitted successfully", ...) as the failure fallback of `assertSuccess`, so a `{success:false}` reply without a message toasted a success sentence. Spec: `res.message || 'Failed to submit'`. Fixed in `src/api/requests.ts` (failure fallback `Failed to submit`; success text only used as message fallback). Tests: `src/api/__tests__/staffRequestsExpensesContract.test.ts` (4 submit types).
2. GAP (hub badge): the API mapper files an unknown `request_type` under `leave`, so a pending row of an unknown type inflated the Leave badge. Spec (emp_request s.14): an unknown type contributes to no card. Fixed in `requestRules.ts` `countPendingByType` (checks the raw `request_type`). Tests: `requestRules.test.ts`, hub test in `screens.test.tsx`.
3. GAP (odometer copy): when the server answered `{success:false}` with no `detail`, v1 showed "Failed to submit" (start/stop) and "Failed to upload photo" (photo); the API module said "Failed to save start/stop reading" and "Failed to upload odometer photo". Aligned in `src/api/expenses.ts`. Tests: contract test file.
4. GAP (copy): field labels "Ticket Photo" / "Bill Photo" (spec s.8) were missing above the photo box. Added `photoLabel` to the shared `ExpenseUploadScreen` config. Tests: `expenses/staff/__tests__/screens.test.tsx`.
5. Tests added for previously uncovered acceptance bullets: hub 99+ badge, shift-change pre-load fetches shifts exactly once, all endpoint paths / query params / payload field names / casing of the nine screens' API calls.

## Files changed

- `src/api/requests.ts` (submit failure fallback)
- `src/api/expenses.ts` (3 odometer failure strings)
- `src/features/requests/staff/utils/requestRules.ts` (unknown type not counted)
- `src/features/expenses/staff/screens/ExpenseUploadScreen.tsx`, `TravelTicketsScreen.tsx`, `OtherBillsScreen.tsx` (photo label)
- Tests: `src\features\requests\staff\__tests__\requestRules.test.ts`, `src\features\requests\staff\__tests__\screens.test.tsx`, `src\features\expenses\staff\__tests__\screens.test.tsx`, NEW `src\api\__tests__\staffRequestsExpensesContract.test.ts`
- Shared-code touches: only `src/api/{requests,expenses}.ts` (in scope, string-level). No `components/ui`, `lib`, `store`, `hooks`, mapper edits.

Verification: `npx jest src/features/requests/staff src/features/expenses/staff src/api` 19 suites / 339 tests pass; `npx tsc --noEmit` clean (whole project); `npx eslint` clean on all touched paths and route files; `npm run check:brand` passes.

---

## 1. emp_request (hub) - `RequestsHubScreen.tsx`

| Bullet / rule | Status | Evidence |
|---|---|---|
| 4 cards in order Leave Request, Permission, Shift Change, Device Change + footer text | PASS | RequestsHubScreen.tsx:20-32, :95-100 |
| Titles / descriptions / header "Requests" / sub "Choose a request type" verbatim | PASS | RequestsHubScreen.tsx:28-31, :72-73 |
| Pending counts per type (2 leave, 1 shift) | PASS | requestRules.ts `countPendingByType`; test screens.test.tsx hub case |
| Badge text `99+` above 99, hidden at 0 | PASS | HubCard.tsx:41 + `CountBadge` max 99; GAP-FIXED coverage: new hub 99+ test |
| approved / rejected not counted | PASS | requestRules.ts:172-176 (`isPendingRequest`) |
| Unknown request_type contributes to no badge | GAP-FIXED | requestRules.ts `countPendingByType` (raw type check) |
| Badge rule (v1 hub used `status`, home used per-date statuses) | DEV-OK | FIX_POLICY B8/B6; B12 "Hub badge rule": one rule, any pending `date_statuses` else status |
| Badges refreshed on focus (v1 once on mount) | DEV-OK | spec s.13 "consider refresh on focus"; RequestsHubScreen.tsx:45 `useRefreshOnFocus` |
| Tap Leave/Permission: "Loading..." overlay, current-month calendar pre-loaded, then navigate | DEV-OK | RequestsHubScreen.tsx:54-65, :102; react-query `prefetchQuery` replaces AsyncStorage/global caches (B12 "Hub caches") |
| Prefetch failure / offline still navigates | PASS | `settleWithin` never rejects (prefetch.ts); test "still opens ... fails" |
| No auth: no calls, still navigates | PASS | RequestsHubScreen.tsx:50 (`!userId` pushes) |
| Tap Shift Change: org shifts fetched once, shift screen reuses without 2nd fetch | PASS | RequestsHubScreen.tsx:60; staleTime 30 s; NEW test asserts `listShifts` called once with orgId |
| Shift prefetch org id `current_org_id || user_id` | PASS | `useOrgId()` = `orgId ?? userId` (store/auth.ts:70) |
| Device Change opens immediately, no overlay, in-app mode (no params) | PASS | RequestsHubScreen.tsx:50-53 |
| UTC month-range bug (Oct 2026 -> 09-30..10-30) | DEV-OK | FIX_POLICY B1; `calendarRange` -> `monthRange`; test expects `2026-10-01..2026-10-31` |
| Back returns to previous screen | PASS | foundation `Screen` back |
| Push `request_updated` opens this screen | PASS | `lib/platform/notificationRouting.ts:101-102` -> `routes.staff.requests.hub` |
| `request_update_badge` removal, `requestBadge` total, `companyLogo` caches | DEV-OK | dead (spec s.13 / FIX_POLICY B7); logo not shown (B12 Deviations) |
| Footer "All requests are sent to your manager for approval" / overlay "Loading..." | PASS | RequestsHubScreen.tsx:98, :102 |
| Pull-to-refresh (none in v1) | DEV-OK | added UI affordance; refetch only |

## 2. emp_leave_request - `LeaveRequestScreen.tsx`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Monday-first grid, Sundays grey, past faded | PASS | RequestCalendarCard.tsx:66-81 (`weekStartsOn={1}`, `disabledDates`, `minDate`) |
| Tap future weekday selects + chip; tap again deselects | PASS | requestRules.ts:57 `toggleDate`; test screens.test.tsx leave case |
| Sunday / past / any-status (Approved, Rejected, Pending) date not selectable | PASS | requestRules.ts:35-40 `dateBlockReason`; RequestCalendarCard.tsx:78 |
| Today selectable | PASS | requestRules.ts:36 (`date < today` only) |
| Multi-month selection, chips ascending, all submitted sorted | PASS | LeaveRequestScreen.tsx:58; DateChips.tsx:50; chip removes its own date (v1 other-month chip bug fixed, B12) |
| Validation order: dates -> reason -> auth; copy "Select at least one date" / "Enter a reason for leave" / "Please login again" | PASS | requestRules.ts:122-126; LeaveRequestScreen.tsx:47-57 |
| Payload `POST /requests/leave/submit {user_id, org_id, leave_dates[YYYY-MM-DD], reason(trim)}` | PASS | requests.ts:32-40; contract test |
| Success: selection + reason cleared, calendar shows Pending, modal "Submitted!", back after 2 s | PASS | LeaveRequestScreen.tsx:62-71 (`markRequested` + invalidate; SUCCESS_MS 2000) |
| `{success:false, message}` toast message, none -> "Failed to submit" | GAP-FIXED | requests.ts:26-30 (was showing the success sentence when no message) |
| Network failure toast "Failed to submit" (server `detail` surfaced when present) | DEV-OK | FIX_POLICY B2; useApiMutation `getErrorMessage` (v1 lost the detail) |
| Month/year switch shows overlay and loads new month's statuses; year range cur-5..+5 | PASS | RequestCalendarCard.tsx:71, :82-101 |
| Dropdown closes on outside tap | PASS | design-system `Calendar` pickers (foundation) |
| Cached statuses shown before refresh | DEV-OK | react-query cache per month (B12) replaces `leave_calendar_cache` |
| Last day of month status shown | DEV-OK | FIX_POLICY B1; test hub IST range |
| Reason placeholder / button / modal / legend / weekday copy | PASS | LeaveRequestScreen.tsx:95,111,139; RequestCalendarCard.tsx:55-61 |
| Status labels `Appr/Rej/Pend` on cells; logo fallback; "Reason" label | DEV-OK | B12 Deviations |
| Leave rules (today allowed, rejected date blocked, no balance check, only Sunday weekly-off) | DECISION | FIX_POLICY C; listed in "Needs decision" |
| Past picking while month data unresolved blocked | DEV-OK | B12 (one query per month; replaces concurrent-fetch guard) |

## 3. emp_permission_request - `PermissionRequestScreen.tsx`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Calendar current month, Sundays grey | PASS | RequestCalendarCard.tsx |
| Future weekday without permission highlights + date chip (x clears), chip text `EEE, dd MMM yyyy` | PASS | PermissionRequestScreen.tsx:105-108 |
| Sunday / past / any-status date not selectable | PASS | requestRules.ts:35-40 |
| End tapped before Start -> toast "Select start time first", no sheet | PASS | PermissionRequestScreen.tsx:52-58 |
| Today 14:10 -> start list begins 2:30 PM (strictly later than now, minute resolution) | PASS | requestRules.ts:108-111 (`> nowMinutes`); test "11:30 IST" |
| Future date -> all 48 slots; "no date selected" treated as today | PASS | requestRules.ts:91, :108-111 |
| Start 9:00 AM -> end 9:30 AM..3:00 PM; start 6:00 PM -> 6:30..11:30 PM (no midnight cross) | PASS | requestRules.ts:114-118; requestRules.test.ts slot cases |
| Changing start clears end | PASS | PermissionRequestScreen.tsx:61-64 |
| Validation order (date, start, end, same, start>now today, >6 h, reason) + verbatim copy | PASS | requestRules.ts:139-150 |
| Today & start <= now at submit -> "Start time must be greater than the current time" | PASS | requestRules.ts:146 |
| Payload `{user_id, org_id, permission_date, start_time 'HH:mm', end_time 'HH:mm', reason(trim)}` | PASS | requests.ts:43-56 (`toHHmm`); contract test |
| Success: date turns Pending immediately, modal, back after 2 s, fields cleared | PASS | PermissionRequestScreen.tsx:85-96 |
| Server `detail` toast; `{success:false,message}`; else "Failed to submit" | GAP-FIXED | requests.ts:26-30 (no-message case) ; detail via useApiMutation (PASS) |
| Sheet titles, empty-state messages, "Select" placeholder, 12-h slot labels (`9:30 AM`, `12:00 AM`) | PASS | PermissionRequestScreen.tsx:172-175; TimeSlotSheet.tsx:56-84; `minutesToTime12` |
| Selection kept across months | PASS | RequestCalendarCard `selected` prop (not tied to month) |
| Submit button disabled with spinner while in flight | PASS | PermissionRequestScreen.tsx:145-146 |
| Submit copy / placeholder / success copy / header | PASS | :126, :142, :179, :137 |
| Concurrent-fetch guard side effect, UTC range bug, optimistic Pending | DEV-OK | B12 fixes table (per-month queries; IST range; `useMarkRequested`) |
| 6 h cap, no midnight cross, start-slot "today" assumption | DECISION | FIX_POLICY C (listed) |
| Holiday status honoured | DEV-OK | spec: practically unreachable; not ported (calendar API never returns it) |

## 4. emp_shift_change_request - `ShiftChangeRequestScreen.tsx`

| Bullet / rule | Status | Evidence |
|---|---|---|
| New Request tab default; shifts from cache or fetch | PASS | ShiftChangeRequestScreen.tsx:63; `useOrgShifts` (prefetched by hub) |
| No shifts -> selector disabled "No shifts available" | PASS | :154-155; test |
| Validation order reason -> shift -> date, verbatim copy | PASS | requestRules.ts:152-157; :87-97 |
| Selector text `{name}  ({start} - {end})`, "Select preferred shift..." | DEV-OK | :74 (12-h times `09:00 AM`, B12 Deviations) |
| Picker disallows dates before today; "Select date..." | PASS | :160-170 (`minDate={todayIST()}`) |
| Payload `{user_id, org_id, reason(trim), requested_shift_id:number, shift_change_date YYYY-MM-DD}` | PASS | requests.ts:59-68; contract test |
| IST date (v1 UTC `toISOString` off-by-one 00:00-05:30) | DEV-OK | FIX_POLICY B1; `DateField` value sent as is |
| "Submitting..." overlay while sending | PASS | :229 |
| Success: form cleared, "Submitted!" modal, history reloads, after 1.5 s My Requests tab | PASS | :106-115 (SUCCESS_MS 1500); invalidate `requests.all` |
| History card: status pill, created date, requested timing, shift date, reason; "—" for missing | PASS | :186-199 (`DASH`) |
| History empty "No shift change requests yet"; loading "Loading requests..." | PASS | :176-183 (skeleton with a11y label) |
| Only shift_change rows listed | PASS | :77-80 |
| Unknown status shows Pending | PASS | mappers/requests.ts:15-17, :37-45 |
| Refresh on focus | PASS | :71 |
| Server error toast message or "Failed to submit"; form not cleared on failure | PASS | useApiMutation + :104-116 (clears only in onSuccess) |
| Form state kept across tabs | PASS | state held in screen (:64-67) |
| Banner, card labels, placeholders, submit label, modal title copy | PASS | :125-127, :133,146,161, :139,154, :213, :230 |
| Own current shift not excluded; no Sunday/holiday/duplicate rule | DECISION | FIX_POLICY C / B12 Deferred |

## 5. emp_device_change_request - `DeviceChangeRequestScreen.tsx` (+ `src/app/device-change-request.tsx`)

| Bullet / rule | Status | Evidence |
|---|---|---|
| Login mode (user id param): warning card + login description, no logo | PASS | :36-38, :98-115; test |
| In-app mode (no params): in-app description, no warning, ids from session | PASS | :39-41, :99-101; test |
| Mode rule = `userId` param present (spec `user_id`) | DEV-OK | route params renamed `userId` / `orgId`; login passes the same names (`useLoginFlow.ts:182`, `routes.ts:16`); `mobile` ignored as in v1 |
| Whitespace reason -> "Please enter a reason", no request | PASS | requestRules.ts:159-161; :55-60 |
| Payload `POST /requests/device-change/submit {user_id, org_id, reason(trim)}` | PASS | requests.ts:71-78; contract test |
| Success: modal, reason cleared; after 2 s replace to staff login (login mode) / back (in-app) | PASS | :69-77 (`routes.staffLogin`, SUCCESS_MS 2000) |
| `{success:false,message}` -> message, none -> "Failed to submit"; form not cleared | GAP-FIXED | requests.ts:26-30 (no-message case) |
| Server `detail` surfaced (v1 ignored it) | DEV-OK | FIX_POLICY B2/B3 |
| Back chevron returns without submitting (also with no history) | PASS | :52, :86 (`backOr`) |
| Bottom nav hidden for logged-out users | DEV-OK | route outside the staff shell (B12; spec s.13) |
| Empty ids guard (v1 posted empty ids) | DEV-OK | :62-65 toast "Please login again" |
| Pre-login orgId fallback (`paramOrgId || session.orgId || userId`) | DECISION | :41; v1 posted `''`; see Needs decision |
| Submit disabled + spinner while in flight; copy (title, label, placeholder, modal) | PASS | :88, :84, :119-125, :133 |
| Route is reachable unauthenticated | PASS | `src/app/device-change-request.tsx` lives outside `/staff` guard (`lib/routeGuard.ts` only guards area layouts) |

## 6. emp_expenses_add (hub) - `ExpensesHubScreen.tsx`

| Bullet / rule | Status | Evidence |
|---|---|---|
| 3 cards (ODO Meter Reading, Travel Tickets, Other Bills) + footer; header "Expenses" / "Track & submit your expenses" | PASS | ExpensesHubScreen.tsx:18-22, :53, :63 |
| Card tap: "Loading..." overlay while today's records pre-load, then open | DEV-OK | :31-50, :67; query prefetch replaces AsyncStorage/global caches (B12) |
| ODO: readings of today via `GET /expenses/odometer/readings?user_id&reading_date` | PASS | :40 -> `getOdometerReadings(userId, today)` (expenses.ts:27-33); contract test |
| Travel / Bills: TRAVEL / BILL lists, only today's rows | PASS | :41; useExpenseData.ts:22-27 (date param + client filter); API upper-cases the type (expenses.ts:108) |
| Network down / `success:false`: still navigates | PASS | `settleWithin` (never rejects); test |
| No auth / userId race: v1 sent empty id | DEV-OK | :34 (no prefetch without a user; always navigates) |
| IST today (v1 UTC date 00:00-05:30 off) | DEV-OK | FIX_POLICY B1 (`todayIST`) |
| `clear_expenses_loading`, `odo_cache_date` | DEV-OK | dead (FIX_POLICY B7) |
| Whole-history list call | DEV-OK | spec s.13; list call carries `expense_date`, rows re-filtered |
| Back to home; staff shell decides chrome | DEV-OK | B12 (no `roleId` nav on screens) |

## 7. emp_odo_meter_reading - `OdometerScreen.tsx`

| Bullet / rule | Status | Evidence |
|---|---|---|
| No readings: empty state "No readings yet" / "Submit your start reading below to begin tracking"; Start mode, step 1 active | PASS | OdometerParts.tsx:30; OdometerScreen.tsx:45 |
| "Add First Reading" no-op button | DEV-OK | dead UI (spec s.13; B12) |
| Submit disabled until photo AND km | PASS | OdometerScreen.tsx:157 |
| Camera denied -> "Camera permission is required" | DEV-OK | PhotoCapture.tsx:30 (toast instead of Alert: FIX_POLICY / conventions no `Alert.alert`; title "Permission needed" dropped) |
| Photo preview + Retake / Remove | PASS | PhotoCapture.tsx:77-87 |
| Start: photo upload (photo_type=start) BEFORE `POST /expenses/odometer/start {user_id, reading_date, start_km:number}` | PASS | expenseRules.ts:123-130; OdometerScreen.tsx:73-79; expenses.ts:36-71; tests (order asserted) |
| Start success: list refreshed, mode -> Stop, form cleared, modal "Start Recorded!" copy + "Got it" | PASS | OdometerScreen.tsx:85-91, :168-176 |
| Stop: upload (stop) then `POST /odometer/stop {user_id, reading_date, stop_km}`; modal "Trip Complete!" + server distance; mode -> Start | PASS | :74-95, :177-186; test |
| Upload failure -> error, no record created | PASS | expenseRules.ts:126-128; test; copy "Failed to upload photo" GAP-FIXED for the no-detail case (expenses.ts:70) |
| Server `detail` shown; `{success:false}` without detail -> "Failed to submit" | GAP-FIXED | expenses.ts:43, :56 (was "Failed to save ... reading") |
| Prev / next / picker load that date, clear image and km | PASS | OdometerScreen.tsx:47-54 |
| Future dates not selectable (picker AND arrow) | DEV-OK | v1 arrow reached the future; clamped (B12 / spec s.13) |
| Reading with distance 0 or missing -> "—" | PASS | OdometerParts.tsx:61 (`r.distanceKm ?` falsy) |
| Mode from any open trip of the day; start 0 counts as recorded | DEV-OK | expenseRules.ts:73-79 (spec s.13 first-match bug fix) |
| Title "Today's Readings" only for today, else "Readings for {date}" | DEV-OK | :102 (spec s.13) |
| km validation (numeric >= 0, 2 decimals, stop >= start) | DEV-OK | FIX_POLICY B10; expenseRules.ts:44-49 |
| Single fetch per date change; overlay never sticks | DEV-OK | FIX_POLICY B2/B8 (react-query) |
| No bottom nav on this screen | PASS | no nav rendered by the screen |
| Titles without emoji / pin glyph in distance line | DEV-OK | B12 Deviations |
| Labels / placeholders / step labels / button labels | PASS | OdometerScreen.tsx:128,134,153; OdometerParts.tsx:34,104,113 |
| Multiple trips per day; photo-before-record orphans | DECISION | B12 Deferred / Backend needs |

## 8. emp_travel_tickets - `TravelTicketsScreen.tsx` / `ExpenseUploadScreen.tsx`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Cached/pre-loaded list renders immediately then refreshes | DEV-OK | react-query prefetch by hub (same key) |
| Submit disabled without photo or amount | PASS | ExpenseUploadScreen.tsx:187; test |
| Camera permission denied -> toast "Camera permission is required" | PASS | PhotoCapture.tsx:30 |
| Photo preview + Retake / Remove; cancel keeps state | PASS | PhotoCapture.tsx:28-31, :77-87 |
| Sequence: `POST /expenses/travel-bill/submit {user_id, expense_date, expense_type:'travel', amount}` THEN upload `?user_id&expense_id` with returned id | PASS | expenseRules.ts:100-112; ExpenseUploadScreen.tsx:85-91; expenses.ts:79-98; contract + screen tests |
| After success: list reload, form reset, modal "Ticket Submitted!" copy + Done, date kept | PASS | :102-108, :198-205 |
| Upload failure: error shown, record kept, retry w/o duplicate | DEV-OK | FIX_POLICY B2; B12 (orphan fix `photo_failed` + retry banner) |
| Create failure: toast, nothing uploaded, form kept; copy `e.message` or "Failed to submit travel ticket" | PASS | :100-101; test |
| `expense_id` missing handled | DEV-OK | expenseRules.ts:104 (v1 uploaded to `undefined`) |
| Rows: thumbnail / placeholder + amount; "Total ₹N" rounded (150.5 -> 151) | PASS | ExpenseListCard.tsx:61-77, :87; expenseRules.ts:62 |
| Row amount format (v1 `₹50.5`) | DEV-OK | `formatINR` (CONVENTIONS money rule); matches `₹100`, `₹50.5` |
| Empty "No tickets yet" / "Submitted tickets for {dd Mon yyyy} will appear here" | PASS | TravelTicketsScreen.tsx:10-11; test |
| Date nav prev/next/picker, picker and next capped at today | DEV-OK | v1 arrow future; B12 |
| `expense_type`: submit `travel`, list `TRAVEL` | PASS | TravelTicketsScreen.tsx:6; expenses.ts:108; contract test |
| Labels "Ticket Photo", "Amount", upload box copy, "Add Travel Ticket", "Submit Ticket" | GAP-FIXED / PASS | "Ticket Photo" label added (ExpenseUploadScreen.tsx photo label); other copy TravelTicketsScreen.tsx:13-17 |
| Amount validation (positive, <= 2 decimals) | DEV-OK | FIX_POLICY B10; expenseRules.ts:33-39 |
| 60 s upload timeout, `content://` normalisation | PASS | shared `api.upload` (`DEFAULT_UPLOAD_TIMEOUT_MS`, platform layer) |
| "Camera" / "Open Camera" chip text in upload box | DEV-OK | cosmetic; box itself is the target (B12 UI rebuild) |

## 9. emp_other_bills - `OtherBillsScreen.tsx` / `ExpenseUploadScreen.tsx`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Pre-loaded BILL list, submit disabled without photo+amount, preview, Remove re-disables | PASS | ExpenseUploadScreen.tsx:187; tests |
| `POST submit` with `expense_type:'bill'` then upload with returned expense_id | PASS | OtherBillsScreen.tsx:6; test "submits type bill" |
| Success: list reload, form clear, "Bill Submitted!" + Done | PASS | OtherBillsScreen.tsx:18-19; ExpenseUploadScreen.tsx:102-108 |
| Failure toast "Failed to submit bill" (v1 generic, hid cause) | DEV-OK | FIX_POLICY B2: server detail shown first, fallback `Failed to submit bill` (OtherBillsScreen.tsx:20) |
| Total "₹151" for 100 + 50.5, rows raw | PASS | same list card as travel; test |
| Empty "No bills yet" / "Submitted bills for {date} will appear here" | PASS | OtherBillsScreen.tsx:10-11; test |
| Camera permission handling (v1 none) | DEV-OK | spec s.13 "add camera permission handling" |
| Labels "Bill Photo", "Add Bill / Invoice", "Upload Bill Photo", "Tap to take a photo of your bill", "Submit Bill" | GAP-FIXED / PASS | "Bill Photo" label added; OtherBillsScreen.tsx:13-17 |
| Network failure on date change recovers (no stuck overlay) | DEV-OK | FIX_POLICY B2 |
| Date capped at today; `expense_date` = selected date (IST) | DEV-OK | FIX_POLICY B1 |
| Photo mime/name captured (v1 bills used defaults) | DEV-OK | shared `PhotoCapture`; harmless improvement |

## Route / config conformance

| Item | Status | Evidence |
|---|---|---|
| Staff routes `/staff/requests{,/leave,/permission,/shift-change,/device-change}`, `/staff/expenses{,/odometer,/travel,/bills}`, pre-login `/device-change-request` | PASS | `src/config/routes.ts:16, 111-122`; docs/ROUTES.md rows 16, 68-69 |
| Route files thin re-exports | PASS | all 10 files under `src/app/staff/{requests,expenses}` and `src/app/device-change-request.tsx` |
| Navigation only via `routes` / `useAppRouter`; no `Alert.alert`; no `fetch`; dates via `@/lib/datetime` | PASS | grep of both feature folders |

## Needs decision (behaviour unchanged)

1. Pre-login device change, `org_id` fallback: when the `orgId` route param is missing, the screen posts `session.orgId`, else the user id (DeviceChangeRequestScreen.tsx:41). v1 posted `''`. The login flow always passes the mismatch org id, so this only matters for hand-built deep links; the backend answer for a non-org id (`Could not determine organization`) decides whether the fallback is harmful. Options: keep, or require both ids (toast "Please login again").
2. Calendar mapper (`src/api/mappers/requests.ts:95-102`, B-owned elsewhere): a calendar row without `type` is treated as `leave`, and v1's alias fallbacks (`permission_date`, `request_type`) are not read. The documented API shape is `{date, status, type}`, so no live defect; confirm the backend never uses the aliases.
3. Rules the policy defers (FIX_POLICY C), still v1 behaviour: leave today-selectable, rejected date not re-requestable, no balance check, only Sunday as weekly-off; permission 6 h cap and no midnight crossing, "no date picked" treated as today; shift change does not exclude the current shift / no duplicate check; odometer multi-trip per day.
4. Backend items already logged in `docs/changes/B12.md` (no `date_statuses` on `/requests/employee`, holiday dates absent in calendar, unauthenticated device-change submit, orphan odometer photo / photo-less expense record, date filter on `/expenses/travel-bill/expenses`, `stop_km < start_km` validation).
5. Employees see no approval status on the ticket / bill lists although the hub footer promises manager approval (spec s.13; B12 Deferred).

---

# Q4d-D - spec conformance audit: employee communications (staff / manager)

Specs: `<spec-root>/pages/10_employee_comms/{emp_chat, emp_personal_chat, emp_group_chat, emp_broadcast, emp_broadcast_targeted}.md`
plus `shared/components/ChatMessageBubble.md`, `shared/api/{chat,group_chat}.md`.
Implementation audited: `src/features/chat/**`, `src/features/announcements/**`, `src/api/{chat,groupChat,announcements}.ts`,
`src/lib/realtime/**`, `src/lib/platform/notificationRouting.ts` (deep links), `src/app/staff/chat/*`, `src/config/routes.ts`.
Known deviations are taken from `docs/changes/B9a.md` and `B9b.md` (cited as B9a / B9b) and `docs/FIX_POLICY.md` (FP).

## Totals

| Status | Count |
|---|---|
| PASS | 116 (incl. rows marked PASS / DEVIATION-OK) |
| DEVIATION-OK | 23 |
| GAP-fixed | 2 |
| Needs-decision | 7 items (section below) |
| Open BUG | 0 |

Baseline before this audit: 15 suites / 193 tests green. After: all green (see Verification).

## GAPs found and fixed

1. **emp_chat: company logo missing in the staff hub header** (spec 3.1 header: logo if known, else chat icon; v1 read the cached company logo). The staff hub always rendered the icon. Fix: `useStaffOrgLogo()` in `src/features/chat/screens/hub/hooks/useChatHub.ts` (same cache entry as the staff home logo, `queryKeys.company.logo(orgId)`, silent on failure), wired in `StaffChatHubScreen.tsx`. Tests: two cases in `hub/__tests__/hubScreens.test.tsx` (icon without logo, logo when present).
2. **emp_chat / badges: Chat tab badge not seeded at app start** (spec F1 B / systems spec: the chat badge services fetch on first subscription at app start; B9b "Known gaps" admitted individual/group counts only loaded after visiting the hub, so a user who restarts with unread messages saw no badge). Fix: `useChatBadgeSeed()` (`src/features/chat/hooks/useChatBadgeSeed.ts`, exported by new `src/features/chat/index.ts`), mounted in `src/components/layout/Bootstrap.tsx` (additive, 2 lines). It shares the hub's query keys (no extra request when the hub opens), is silent on failure (plan-blocked org keeps previous counts) and is healed on socket reconnect because the global socket already invalidates `queryKeys.chat.all/groupChat.all`. Tests: `src/features/chat/hooks/__tests__/useChatBadgeSeed.test.tsx` (seed, failure keeps counts, no session).
   NOTE: another engineer appeared to be adding a `useChatBadgeSync` to Bootstrap at the same time (the file `bootstrap/useChatBadgeSync.ts` did not exist when I finished and Bootstrap did not import it). If it lands, both write the same absolute totals; one of the two should be dropped.

Extra test added (no code change needed): staff notification-tap deep link (`userId` param) opens the admin conversation although no chat exists yet and names the header from the org admin (`directChat.test.tsx`, "a notification tap ...").

## 1. emp_chat (hub) - `src/features/chat/screens/hub/StaffChatHubScreen.tsx`

| Bullet / rule | Status | Evidence |
|---|---|---|
| 14.1 header "Chat" / "Team Communication", eyebrow "Choose a channel", 4 cards in order Individual, Group, Broadcast, Targeted | PASS | StaffChatHubScreen.tsx:28,42-48; hubLogic.ts:32-37; hubScreens.test "shows the four channels" |
| Card titles/descriptions verbatim (Individual Chat / One-to-one conversation ... Targeted Announcement / Branch / Department) | PASS | hubLogic.ts:33-36 |
| 14.2 Individual badge = server unread total re-synced on focus; Group badge = group unread total | PASS | useChatHub.ts:32-60 (`useRefreshOnFocus`, org_id scoped totals via api/chat.ts:133, api/groupChat.ts:95) |
| 14.3 badge `99+` over 99, none at 0 | PASS | HubMenuCard.tsx (`CountBadge`, label 99+), hubLogic.ts:42-46; admin hub test asserts "99+" |
| 14.4 WS group message increments Group badge live | PASS | realtime/events.ts:56-91 -> globalRealtime badgeSink -> store -> `useHubCounts` (useChatHub.ts:63-68); events.test |
| 14.5 Broadcast/Targeted badge = unseen count; cleared after opening the feed | PASS | announcements/seenIds.ts:134-162; feedScreens.test |
| 14.6 uncached plan: spinner then blocked card "Chat Unavailable / Your plan has expired. Please contact your admin.", no cards, no buttons | PASS | hubLogic.ts:63-75; StaffChatHubScreen.tsx:29-38 (skeleton instead of spinner = DEVIATION-OK below); test "plan-blocked" |
| 14.7 cached plan: no spinner / no plan call on later focus | PASS | useOrgPlan.ts (react-query, 5 min stale, `isLoading` only on first load) |
| 14.8 plan call fails -> menu shown (fail open) | PASS | config/plans.ts:55 (`!status` -> false); hubLogic.ts:65 |
| 14.9 free trial never blocked | PASS | config/plans `isPlanFeatureBlocked` (foundation, matrix unchanged per FP A) |
| 14.10 card taps go to personal / group / broadcast / targeted and back returns to hub | PASS | hubLogic.ts routes; `router.push` in StaffChatHubScreen.tsx:47; test asserts the four routes |
| 14.11 header back / hardware back = back one screen | DEVIATION-OK | hub is a tab root (`hideBack`), shell handles back; B9b "Known gaps" (no per-screen handlers) |
| 14.12 cached company logo in header else chat icon | GAP-fixed | see GAP 1 |
| 14.13 mount prefetch of groups + staff into caches; failures silent | DEVIATION-OK | B9b Deferred: GlobalCache preload replaced by react-query (screens fetch themselves, cached 5 min); not user-visible |
| 14.14 individual list opens instantly from cache | DEVIATION-OK | react-query cache (`useDirectChatList`) shows cached list immediately, then refetches |
| Menu flash before plan check (v1 defect 10) | PASS | skeleton while `isLoading` (StaffChatHubScreen.tsx:29), test "does not flash the menu" (admin) |
| Blocked card has no action for staff | PASS | StaffChatHubScreen.tsx:38 `cta={null}`; test asserts no `chat-gate-cta` |
| Plan cache never invalidated after renewal (v1 defect) | PASS | react-query staleTime + invalidation (B9b) |
| Dead "SOON"/coming-soon branch | PASS (not ported, FP B7) | - |
| 8 copy table | PASS | all strings present; "Loading" spinner has no text in spec |
| Spinner during plan check | DEVIATION-OK | `Skeleton` x4 instead of spinner (design-system policy, BUILDER_BRIEF 3) |

## 2. emp_personal_chat (staff direct chat) - `DirectChatScreen variant="staff"`

| Bullet / rule | Status | Evidence |
|---|---|---|
| 14.1 cached list shown at once, refreshed in background | PASS | useDirectChatList.ts:45-53 (react-query cache + `useRefreshOnFocus`) |
| 14.2 no cache: loading indicator; failure -> list stays empty with "No chats yet" (+ admin card if known) | PASS | DirectListPane.tsx:68-87; staff `contacts` still contains the synthesised admin on error (useDirectChatList.ts:79-84). "Loading chats…" text replaced by `SkeletonList`, failure additionally shows ErrorState when nothing at all is known = FP B2 (DEVIATION-OK) |
| 14.3 org admin first even without messages; existing admin entry moved to top | PASS | chatLists.ts:131-136 `mergeAdminFirst`; test "pins the admin conversation first" |
| 14.4 search: list filters by name/role/dept (NOT branch); dropdown lists staff with name, branch, dept, role + "New" pill for people without a chat | PASS | DirectListPane.tsx:26-31 (`matchBranch: variant==='admin'`), :47-64; chatLists.ts:146-165; test "searches the staff directory locally" |
| Search placeholder `Search by name, branch, department…`, subline `role · dept · branch`, role labels Admin/Manager/Staff from role id | PASS | DirectListPane.tsx:47,56; chatLists.ts:82-87 |
| Local search, no debounce, no role filter, self excluded, admin searchable | PASS | useChatSearch.ts:25-58 (staff: debounce 0, local pool incl. admin), chatLists.ts:158-165 |
| Inactive staff excluded from search | DEVIATION-OK | B9a Deviations ("pickers and local search skip inactive staff") |
| 14.5 tap search result opens conversation, search clears | PASS | DirectListPane.tsx:33-40 |
| 14.6 open chat with 3 unread: badge disappears, hub drops by 3, history oldest->newest, mark-read sent | PASS | useDirectConversation.ts:152-163 (zero row, `markChatRead('individual', previous)`, `markChatRead(peer, me)` per api/chat.ts:197); messageLog.ts:113-128 ordering; directChat.test "loads history ..." |
| Opening an EXISTING chat via search with unread (v1 quirk: badge not decremented) | PASS (fixed vs v1) | unread is read from the cached list row at open, not from the synthesised search item (useDirectConversation.ts:155) |
| 14.7 history API fails -> empty conversation without error message | DEVIATION-OK | error state with Retry (FP B2 "no silent failures"), MessageList.tsx:122-124 |
| 14.8 send "hello": bubble at once with single tick, preview updates, exactly one bubble after response/echo | PASS | useDirectConversation.ts:264-274, messageLog.ts:205-239; test "sends optimistically, then shows the server message exactly once" |
| 14.9 send fails: v1 bubble stays silently | DEVIATION-OK | failed marker + toast + Retry/Discard (spec 13 fix 2; FP B2); test "a failed send ..." |
| 14.10 attach file: optimistic bubble, spinner, camera+attach disabled; success gets server URL; failure undelivered | PASS | Composer.tsx:70-78 (camera disabled, attach shows Spinner), useDirectConversation.ts:276-292,319; failure = failed/Retry (DEVIATION-OK as above) |
| 14.11 camera permission denied | DEVIATION-OK | toast instead of silent (FP B2; B9a) |
| 14.12 photo uploaded as image, preview "Photo" | PASS | usePickAttachment.ts:23-31, format.ts:64-75 (icon instead of emoji = B9a deviation) |
| 14.13 incoming message in open chat: appended at bottom, scrolls, marked read | PASS | useDirectConversation.ts:196-214, MessageList.tsx:51-63; test "only appends incoming messages of THIS conversation" |
| 14.14 incoming while on list: card badge + preview/time update, hub badge +1 once (no double count) | PASS | useDirectChatList.ts:59-77, chatLists.ts:36-57, badges store id de-dup (store/badges.ts:130+) |
| 14.15 message from someone not in my list -> new card at top with unread 1 | DEVIATION-OK | list is refetched for an unknown partner (real name/role) instead of inventing an "Admin" row (spec 13 fix 4); chatLists.ts:36-45 |
| 14.16 `read_update` -> double tick | PASS | frames.ts `readAppliesToDirect` (scoped fix, spec 13 fix 3), messageLog.ts:241; test "read receipts only mark my messages when the open peer is the reader" |
| 14.17 header back in conversation -> list (no app navigation) + list refreshed; on list back leaves | DEVIATION-OK | conversation is a route (`userId` param); `router.backOr`, list refetches on focus (B9a Deviations) |
| 14.18 WS drop: v1 no updates; v2 must reconnect + resync | PASS | socketCore.ts:83-227 (backoff reconnect, foreground reconnect), `onReconnect` refetch list/history + mark-read (useDirectChatList.ts:77, useDirectConversation.ts:228-233), global socket invalidates chat caches (socket.ts:44-66); socketCore.test |
| 14.19 any staff can chat with any colleague (no role filter) | PASS | useChatSearch.ts:25-30 (`adminOnly` only for the ADMIN screens used by non-admins) |
| Empty/whitespace message ignored; no max length | PASS | Composer.tsx:33-38, useDirectConversation.ts:266-267 |
| Optimistic ids / echo reconciliation, dedupe by id, items without id dropped, duplicate ids | PASS | messageLog.ts:120-128,226-239 (client ids `c...` replace the `m`/`t` convention, spec 13 fix 9) |
| Message type resolution (image stays image; derive from extension) | PASS | format.ts:26-36 |
| List preview rules (image/file by type then extension, `http` + `/` -> Attachment) | PASS | format.ts:57-70 |
| formatTime list (Just now / Nm ago / Nh ago / Yesterday / short date) | PASS | format.ts:73-75 -> datetime `formatRelativeTime(hoursAgo)` |
| Bubble time IST HH:MM | DEVIATION-OK | B9a: IST via `@/lib/datetime` instead of device zone (FP B1) |
| Avatar colour hash / stable photo uri | PASS | `Avatar` + `stableImageKey` (design system) |
| No date separators / contact sheet / menu in v1 staff conversation | DEVIATION-OK | separators added for both roles (B9a); staff has no menu (`full` flag, DirectConversationPane.tsx:38-39,100-110) as spec 13 table |
| Dead reconnect / ignored poll_refresh (spec 13 fix 1) | PASS | replaced by managed sockets (see 14.18); 4 s `poll_refresh` fallback intentionally not ported (see Needs decision 6) |
| Swallowed send failures (fix 2), `read_update` scoping (3), unknown sender (4), sender_name = org name (5), unscoped `chatList` cache write (7), `getAllStaff` param naming (8) | PASS | B9a Fixes; `sender_name` = session name (useDirectConversation.ts:126); keys `queryKeys.chat.*` scoped to user/org |
| Deep link: notification tap -> `/staff/chat/direct?userId=` (admin screens for role 1) | PASS | notificationRouting.ts:84-91 (session role wins, `sender_id`/`from_user_id`/`sender_user_id`), DirectChatScreen.tsx:25-27; peer lookup falls back to org admin (useDirectConversation.ts:56-58); new test |
| Unread/read-state on open: zero row, subtract held count, mark-read, settle incoming of the open chat (net zero, id-deduped) | PASS | useDirectConversation.ts:152-163,202-208 |
| `/chat/list` org_id, mark-read argument order (sender = other, receiver = me) | PASS | api/chat.ts:127-130,197-200 |
| `getReceiverPushToken` before every send | DEVIATION-OK | not called (route does not exist, backend resolves token; B9a Backend needs) |
| Copy: Individual Chat, No chats yet, No matching chats, Search for someone to start chatting, Type a message..., New, Admin/Manager/Staff | PASS | DirectChatScreen.tsx:61; DirectListPane.tsx:42,47,58,85; Composer.tsx:81 |
| Copy: `Loading chats…`, `Loading messages...` | DEVIATION-OK | skeletons |
| Emoji previews (camera / file / clip glyphs) | DEVIATION-OK | icons + words "Photo / File / Attachment" (B9a) |

## 3. emp_group_chat (staff group chat) - `GroupChatScreen variant="staff"`

| Bullet / rule | Status | Evidence |
|---|---|---|
| 14.1 3 groups -> 3 cards: name, `Sender: preview` or "Tap to start chatting", time, member count | PASS | GroupListPane.tsx:49-71, ConversationRow.tsx; test "lists only the groups returned for the user" (list = server list of groups the user belongs to, `org_id` param) |
| 14.2 no groups: "No groups yet / You'll see groups here when added by admin", no create button | PASS | GroupListPane.tsx:57-60 (`admin && onCreate`), GroupChatScreen.tsx:33-36 (createButton/sheet admin only); same test |
| 14.3 search groups by name, case-insensitive; no match -> empty state | PASS | chatLists.ts:205-207, GroupListPane.tsx:20 |
| 14.4 open group with 4 unread: badge clears, hub Group badge -4, history + members load, mark-read | PASS | useGroupConversation.ts:98-110, queries :70-86 |
| 14.5 message from member in open group: appended with sender name, scroll, marked read | PASS | useGroupConversation.ts:115-127 (`groupBelongs` guard), MessageBubble.tsx:60-64; test "only appends messages of THIS group" |
| 14.6 message for another group: card unread +1, preview/sender/time update, hub badge +1 once | PASS | useGroupChatList.ts:46-77, chatLists.ts:170-188, store id de-dup |
| 14.7 admin creates group including me -> list reloads | PASS | `group_created` -> invalidate list (useGroupChatList.ts:48-52) |
| 14.8 send "hi": one bubble after echo/response | PASS | useGroupConversation.ts:155-199, messageLog.ts (single bubble, key kept) |
| 14.9 send fails: v1 silent | DEVIATION-OK | failed marker + toast + Retry (spec 13 fix 6; FP B2) |
| 14.10 attach file: spinner, camera+attach disabled, bubble on success | PASS (better) | optimistic bubble with progress in groups (v1 had none) - spec 13 fix 6 |
| 14.11 camera permission denied | DEVIATION-OK | toast |
| 14.12 members sheet: Admin pill, dept, branch, role, "You" for me, `{n} members`, "No members found" | PASS | MembersSheet.tsx:25-78 |
| 14.13 Add Staff: excludes self + members; search name/dept/branch; no Add button with 0 selected; fallback "Staff"; "All staff are already members" | PASS | chatLists.ts:210-218, AddStaffSheet.tsx:34-65, StaffPickerList.tsx:73-75; test "adds staff who are not members yet" |
| 14.14 add 2 staff: added, sheet closes, count updates, toast "2 staff added!" visible in conversation | PASS | useGroupConversation.ts:244-258 (member count + list count updated, spec 13 QA note fixed); toast host global |
| 14.15 add fails: toast "Failed to add staff", sheet stays open | PASS | useGroupConversation.ts:254-257, AddStaffSheet.tsx:41-46 (server detail shown when present, FP B2); test "a failed add" |
| 14.16 header back in conversation -> list; list back -> previous screen | DEVIATION-OK | route-based (`groupId` param, B9a) |
| 14.17 Android back on list -> `/emp_chat` replace + `emp_home_loading` flag | DEVIATION-OK / not ported | flag is dead (spec 13 fix 8, FP B7); plain back |
| 14.18 `read_update` with `read_count >= total_members-1` -> read tick | DEVIATION-OK | `readCount >= totalMembers` because `total_members` already excludes the sender (B9a Fixes; Backend needs row 2); messageLog.ts:19-22,250-257 |
| Group list: unread raw number, no 99+ cap in v1 | DEVIATION-OK | capped at 99+ (spec 13 fix 11) |
| Staff cannot create / rename / delete / mute / theme groups | PASS | menu = View Members + Add Staff only (GroupConversationPane.tsx:34-46), themes admin only (:33) |
| Cached list hidden behind spinner (fix 2) | PASS | GroupListPane.tsx:36 (`isLoading && groups.length === 0`) |
| `members` stale closure for `total_members` fallback (fix 3) | PASS | `membersRef` + `fallbackTotal` (useGroupConversation.ts:87,132-138) |
| Reconnect leak / once only (fix 4) | PASS | managed sockets + `onReconnect` refetch (useGroupConversation.ts:148-153) |
| Own text echo forced `is_read:true` (fix 5) | PASS | `chatItemFromGroup` (messageLog.ts:58) |
| Open-group messages unsorted / not deduped (fix 9) | PASS | `normalizeItems` |
| Any member may add staff (fix 10) | Needs-decision #3 | kept v1; B9a Deferred |
| Group send for non-members | PASS | server 403 text surfaced via error toast (B9a Backend needs) |
| Sub-title `{n} members · Tap to view`, tap -> members sheet | PASS | GroupConversationPane.tsx:57-58 |
| Unknown sender label `Unknown`, self `You` (members sheet) | PASS | MessageBubble.tsx:62 (uses `sender_name` of the message instead of the member lookup; equivalent data), MembersSheet.tsx:49 |
| Empty conversation "No messages yet / Send the first message!" | PASS | MessageList.tsx:128 |
| Header initials tile / `getColor` per-sender name colour / default bubble colours | DEVIATION-OK | design tokens (`Avatar`, `color="primary"` sender label) |
| Staff groups = groups the user belongs to (server filter) | PASS | api/groupChat.ts:88-92 |
| Deep link `?groupId=` (notification tap) | PASS | notificationRouting.ts:92-98; GroupChatScreen.tsx:22-24; useGroupConversation reads the group from the list query |
| Copy: Group Chat, Search groups…, Tap to start chatting, members, No groups yet, View Members, Add Staff, Search staff…, All staff are already members, Add {n} Staff, {n} staff added!, Failed to add staff, No members found, Admin, You, Unknown | PASS | GroupChatScreen.tsx:55,62; GroupListPane.tsx; GroupConversationPane.tsx; AddStaffSheet.tsx; MembersSheet.tsx |
| `Loading messages...` LoadingModal, emoji members glyph | DEVIATION-OK | skeleton, `Icon` |

## 4. emp_broadcast (staff broadcast feed) - `BroadcastFeedScreen`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Feed is read-only for staff (no compose / delete / picker) | PASS | AnnouncementFeed.tsx has no write actions; `onDelete` only passed by admin history |
| 14.1 3 broadcast (2 all + 1 selected) + 1 branch -> exactly the 3 show | PASS | api/announcements.ts:50-52 `filterBroadcast`; seenIds.ts:44-46; feedScreens.test |
| 14.2 pill "All Staff" / "Selected Staff" | PASS | targets.ts:195-204 (`feed:'broadcast'`) |
| 14.3 `by {sent_by}` only when present | PASS | AnnouncementCard.tsx:71-75 |
| 14.4 search title/message case-insensitive; "No results / Try a different search term"; clear restores | PASS | targets.ts:175-182 (query trimmed, fix 7), AnnouncementFeed.tsx:54-58, SearchBar clear |
| 14.5 empty: "No announcements yet / Announcements from your admin will appear here" | PASS | AnnouncementFeed.tsx:15-18,54-58 |
| 14.6 hub Broadcast card + Chat tab badge include unseen; opening clears Broadcast only | PASS | seenIds.ts:134-162 (`markFeedRead`), shellNav.ts:109 (tab badge = chat + announcements) |
| 14.7 re-launch: seen ids persisted, new one counted | PASS | `getJSON/setJSON` per-user keys (seenIds.ts:41-44,95-108) |
| 14.8 WS `announcement` target all -> Broadcast badge +1 immediately, reconciled by refetch | PASS | events.ts:77-78,47-50; globalRealtime.ts:35-43 (optimistic +1 and `mine` invalidate); useAnnouncementUnreadSync.ts:31-34 recompute after every fetch; events.test |
| 14.9 API `success:false` / network failure: badge not reset, no crash | PASS (better) | ErrorState with Retry (FP B2) instead of looking empty; marking only after a successful load (AnnouncementFeed.tsx:36-40); test "a failed load ..." |
| 14.10 back -> hub | PASS | `Screen` back (stack) |
| 14.11 admin (role 1) never counted | PASS | useEmployeeAnnouncements.ts:8-12, globalRealtime.ts:35-39 |
| Redundant second GET / overwrite of seen ids / race (fix 1) | PASS | ids from the displayed list, merged (seenIds.ts:112-126) |
| Seen ids device-global, never cleared (fix 2) | PASS | `storageKeyFor(key, userId)`, wiped on sign-out |
| No live refresh / pull-to-refresh / focus refetch (fix 3) | PASS | AnnouncementFeed.tsx:31-33, useEmployeeAnnouncements.ts staleTime 30 s + `mine` invalidation |
| Error state (fix 4), numeric `id` safe (fix 5) | PASS | mapAnnouncement `str(id)` (api/announcements.ts:34) |
| Order as the server returns, no client sort | PASS | AnnouncementFeed.tsx (no sort) |
| Relative time (Just now / Nm ago / HH:MM / Yesterday / short date) | PASS | AnnouncementCard.tsx:46 -> `formatRelativeTime` (IST, FP B1) |
| Card accent hash `sum(charCodes) % 8`, megaphone tile, full message text | PASS / DEVIATION-OK | targets.ts:211-221 (theme tokens instead of raw hex, B9b) |
| Header "Broadcast", placeholder `Search announcements…` | PASS | AnnouncementFeed.tsx:15,76 |
| Foreground push + socket both count (v1 double count; inverse default mapping) | PASS | unified `classifyAnnouncementTarget` and healed by refetch (B9b) |
| Unknown `target` value | Needs-decision #1b | mapper turns unknown into `all` (api/announcements.ts:20-23, test-locked) so it lands in Broadcast; v1 excluded it from both feeds |
| Notification tap (`announcement` push) opens the home screen, not the feed | PASS | notificationRouting.ts:80-83 (verbatim v1) |

## 5. emp_broadcast_targeted (staff targeted feed) - `TargetedFeedScreen`

| Bullet / rule | Status | Evidence |
|---|---|---|
| 14.1 only `branch` and `dept` show (not `all`) | PASS | `filterTargeted` (api/announcements.ts:55-57); feedScreens.test |
| 14.2 branch pill: building icon + branch name, fallback "Branch" | PASS | targets.ts:190-192 |
| 14.3 dept pill: layers icon + dept name, fallback "Department" | PASS | targets.ts:193-194 |
| 14.4 search matches title, message, branch name, dept name | PASS | targets.ts:175-182 (`withNames` = targeted feed); test "search also matches the branch / department name" |
| 14.5 empty "No announcements yet / Branch or department announcements will appear here" | PASS | AnnouncementFeed.tsx:17 |
| 14.6 2 unseen targeted -> hub Targeted badge 2; cleared after opening; Broadcast badge unaffected | PASS | per-feed seen ids (seenIds.ts:45-47,134-146); hub test counts 7 targeted / 2 broadcast |
| 14.7 WS target `branch` -> Targeted +1, reconciled by refetch | PASS | events.ts:47-50 (anything not all/selected/broadcast = targeted) |
| 14.8 request fails: badge not reset | PASS | as emp_broadcast 14.9 |
| 14.9 back -> hub | PASS | stack back |
| 14.10 `by {sent_by}` only when non-empty; clear button restores | PASS | AnnouncementCard.tsx:71-75, SearchBar |
| Header "Targeted", violet fixed left border, branch vs dept icon | PASS | AnnouncementFeed.tsx:14,69-72 (`statusHalfDay` token) |
| Which branch/department announcements a staff member receives (server-side recipient filtering) | Needs-decision #1 | client does no filtering by the user's own branch/dept, exactly like v1 (spec 6 "UNVERIFIED"; FP C "announcement targeting rules"); B9b Backend needs |

## Cross-cutting: realtime, deep links, rules

| Item | Status | Evidence |
|---|---|---|
| Sockets reconnect with backoff + jitter, ping, foreground reconnect, close on sign-out, rebind on user change | PASS | socketCore.ts:83-227, socket.ts:36-66,72-100; socketCore.test (273 lines) |
| Resync after reconnect (history, lists, mark-read, badge totals, announcements) | PASS | `onReconnect` in the 3 chat hooks; global `invalidateQueries` + `socket_reconnected` bus (socket.ts:56-61) |
| One count per message across global socket, push and open conversation | PASS | globalMessageDeduper + store `registerMessageId` + open-conversation net-zero settle |
| Polling intervals | PASS (n/a) | spec has none besides the dropped 4 s `poll_refresh` fallback (Needs-decision 6) |
| Chat WS frames of other conversations never leak into the open one | PASS | `directBelongs` / `groupBelongs` (messageLog.ts:280-289) |
| Tap targets: `userId` (direct) / `groupId` (group) route params, role from session | PASS | notificationRouting.ts:84-98; routes.ts:124-129; thin route files `src/app/staff/chat/*.tsx`, hub tab `src/app/staff/(tabs)/chat.tsx` |
| Staff vs admin differences honoured (pinned admin, local search w/o branch in list filter, no menu, no create group, no theme, read-only feeds, hub copy/cards, no purchase CTA) | PASS | rows above |
| Message send validation (trim, empty ignored, no max length), optimistic retry/discard | PASS | Composer.tsx, hooks above |
| Attachments (camera, library, document, 60 s upload via `api.upload`, mime fallback, progress) | PASS | usePickAttachment.ts, api/chat.ts:173-191, api/groupChat.ts:134-148 (`resolveMimeType`) |
| Image "Tap to view" gate per session, lightbox/ImageViewer, file card statuses, long-press menu (Copy / Download) | PASS / DEVIATION-OK | MessageBubble.tsx:151-229, :253-311; Google-Docs WebView viewer not ported, empty menu for text replaced by Copy (B9a Deviations, ChatMessageBubble 13) |
| `sender_name` | PASS | session name, not the org name |
| Dates via `@/lib/datetime`, no `Alert.alert`, no `fetch` outside `src/lib/api`, no legacy names | PASS | grep clean; `npm run check:brand` clean for my files |

## Needs decision (no behaviour changed)

1. **Announcement targeting (FP C).** (a) The employee endpoint `/api/announcements/employee/{uid}` decides which branch / department / selected items a staff member receives; the client does not filter by the user's own branch/department (v1 identical, spec 6 "UNVERIFIED"). Evidence: AnnouncementFeed.tsx uses `filterBroadcast/filterTargeted` only. Needs backend confirmation (also ordering and `id` type, B9b Backend needs). (b) `mapAnnouncementTarget` (api/announcements.ts:20-23, locked by `api/__tests__/announcementsLeads.test.ts:61`) maps an unknown/missing `target` to `all`, so such an item would show in Broadcast as "All Staff" and be counted; v1 excluded it from both feeds. Edge case only; decide whether unknown targets should be dropped.
2. **Chat plan gate only on hubs.** Deep links (notification tap, shared URL) to `/staff/chat/direct|groups|broadcast|targeted` of a plan-blocked organisation bypass the hub gate (v1 same, spec personal chat 1). Spec 13 of the hub recommends gating centrally; needs a decision to add a layout-level gate in `src/app/staff/chat` (route group owned elsewhere). The server already returns the plan error on the list calls (shown as an error state).
3. **Any group member may add staff** (no admin check, v1). Confirm server-side authorisation of `POST /group-chat/add-members`.
4. **Staff may chat with every colleague** (no role restriction; admin pinned) and `/chat/list` membership semantics (staff added under a manager are missing from the server list per `shared/api/chat.md` gotcha) - confirm product intent / backend fix.
5. **Backend contract confirmations already logged by B9a/B9b** and re-confirmed by this audit: WS `read_update` for groups lacks `message_id/read_count/total_members` (client refetches the history, debounced); `total_members` semantics (client uses `>= total_members`); `add-members` emits no WS event; plan block = HTTP 500 wrapping 403; announcement WS/push payload lacks id + target.
6. **Socket fallback polling.** v1 emitted a synthetic `poll_refresh` every 4 s while the socket was down (ignored by the staff screens, used only by admin). v2 relies on backoff reconnect + resync. If the backend socket can stay unreachable for long periods (proxies), a visible-screen fallback poll (e.g. 15-30 s list/history refetch while the socket is closed) would be a product decision; not added.
7. **Observation (not a spec item):** a notification deep link into a conversation before the chat list is cached cannot subtract that chat's unread count from the badge at open (count unknown), and a list fetched in the same instant as `mark-read` can still carry it; the next focus/reconnect refresh (and the new start-up seed) corrects it. A server-driven fix (derive counts from the list after mark-read) would need agreement on ordering.

## Files changed

- `src\features\chat\screens\hub\hooks\useChatHub.ts` (+`useStaffOrgLogo`)
- `src\features\chat\screens\hub\StaffChatHubScreen.tsx` (logo)
- `src\features\chat\hooks\useChatBadgeSeed.ts` (new)
- `src\features\chat\index.ts` (new, exports `useChatBadgeSeed`)
- `src\components\layout\Bootstrap.tsx` (shared, additive: mounts `useChatBadgeSeed`; see note on a concurrent `useChatBadgeSync`)
- Tests: `src\features\chat\screens\hub\__tests__\hubScreens.test.tsx` (logo cases, `@/api/auth` mock), `src\features\chat\hooks\__tests__\useChatBadgeSeed.test.tsx` (new), `src\features\chat\__tests__\directChat.test.tsx` (staff deep link)
- Doc: `docs\qa\Q4d-D.md`

## Verification

- `npx jest src/features/chat src/features/announcements src/lib/realtime`: green (193 existing + 4 new tests).
- `npx tsc --noEmit`: clean (whole project).
- `npx eslint src/features/chat src/features/announcements src/lib/realtime src/components/layout/Bootstrap.tsx`: clean.
- `npm run check:routes`: passed. `npm run check:brand`: fails ONLY on `docs/qa/Q4d-C.md` lines 24-27 (another engineer's report quotes legacy-looking tokens); nothing from files touched here.
- Note: chat screen tests now load `@/components/layout` -> `Bootstrap` -> `expo-notifications` (warning, "Jest did not exit" notice); this comes from the layout index exporting `Bootstrap`, not from the changes above.
