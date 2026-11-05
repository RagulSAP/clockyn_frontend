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
