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
