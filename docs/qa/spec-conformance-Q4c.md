# Spec-conformance audit Q4c — admin requests / expenses / location, admin comms, CRM

Scope: `pages/07_admin_requests_expenses_location`, `pages/08_admin_comms`, `pages/09_crm`, `shared/components/ChatMessageBubble` (19 live specs; `track_location` is dropped per ROUTES.md).
Method: every §14 acceptance bullet, §7 rule/formula, §8 copy string and the §4 flows of each spec were traced to the implementation (and its tests). Paths are relative to `src/features/` unless they start with `src/`. Change logs read first: `docs/changes/B8.md`, `B9a.md`, `B9b.md`, `B10.md` (+ FIX_POLICY, BUILDER_BRIEF, CONVENTIONS).

## Summary

| Result | Matrix rows | Notes |
|---|---|---|
| PASS | 202 | implemented as specified (rows marked "PASS / DEV-OK" are counted under DEVIATION-OK) |
| DEVIATION-OK (intentional per FIX_POLICY / a change log) | 79 | each row cites the policy item or change log |
| GAP found and FIXED here (with tests) | 8 rows = 5 distinct gaps (G1-G5) | all fixed |
| NEEDS-DECISION (behaviour left unchanged) | 6 rows tagged DECISION; 9 open items D1-D9 (some sit inside DEV-OK rows) | listed at the end |
| Total traced rows | 295 | 19 live specs + the dropped `track_location` |

Gaps fixed in this audit (all additive, in scope features only):

| # | Spec | Gap | Fix | Test |
|---|---|---|---|---|
| G1 | group_chat §4 F2/F11 ("Failed to load staff") + FIX_POLICY B2 (no silent failures) | A failed staff / members load showed "No staff found", "All staff are already members" or "No members found" (misleading, no retry) in Create Group, Add Staff and Members | `StaffPickerList` / `MembersSheet` take `error` + `onRetry` and show an `ErrorState` ("Try again"); `useGroupConversation` exposes `membersError` / `refetchMembers` (`chat/components/{StaffPickerList,CreateGroupSheet,AddStaffSheet,MembersSheet,GroupConversationPane}.tsx`, `chat/hooks/useGroupConversation.ts`) | `chat/__tests__/groupLoadErrors.test.tsx` (3) |
| G2 | emp_crm / enter_leads (category dropdown) + FIX_POLICY B2 | A failed category load looked like "No categories — Add your first category" | `CategoryPicker` shows an `ErrorState` with retry (`crm/components/CategoryPicker.tsx`) | `crm/__tests__/CategoryPickerErrors.test.tsx` (2) |
| G3 | odometer §8 / travel_ticket §8 / other_bills §8 (toast copy) | Approve / reject failure fell back to the generic "Failed to update" instead of "Failed to approve reading / reject ticket / approve bill …" | per-subject v1 fallback wording (server text still wins): `expenses/admin/utils/recordFilter.ts` (`reviewFailureMessage`), `expenses/admin/hooks/useExpenseReview.ts` | `expenses/admin/__tests__/reviewFailures.test.tsx` (5) |
| G4 | crm §4 F1/F2, §14 ("blocked: no leads fetch is made"; body is exactly one of spinner / blocked card / content) | The hub fetched leads + CFRs while the plan status was still loading (a blocked organisation hit the 403 endpoints) and a blocked admin still saw the "Enter Leads / View / Assign Leads" menu cards above the lock card | `AdminCrmScreen`: plan is checked first (skeleton while loading, no fetch until known), menu cards only render when CRM is allowed (`crm/screens/AdminCrmScreen.tsx`) | `crm/__tests__/AdminCrmScreen.test.tsx` (+2 assertions / 1 test) |
| G5 | emp_crm §4 F1 (plan gate before `loadAll`) / crm §9.2 badge | Staff "My Leads" and the CRM tab-badge sync fetched `/api/leads/employee/..` while the plan status was loading | `StaffCrmScreen` and `useCrmBadgeSync` wait for the plan status (`crm/screens/StaffCrmScreen.tsx`, `crm/hooks/useCrmBadgeSync.ts`) | `crm/__tests__/StaffCrmScreen.test.tsx` (+1) |

Needs-decision items are listed in the last section. Verification: `npx jest` for all touched feature folders, `npx tsc --noEmit` (no errors from these files), `npx eslint` on the touched paths, `npm run check:brand` — results at the end.

Status legend: **PASS** = implemented as specified; **DEV-OK** = intentional deviation (cite); **GAP-FIXED** = defect found and fixed here; **DECISION** = see "Needs decision".

---

## 07 — requests.md (hub + badge/seen logic)

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Header: org name title, "Manage Staff Requests" subtitle | PASS | `requests/admin/screens/RequestsHubScreen.tsx:86` (title falls back to "Requests" when org name empty) |
| Four rows in order Leave / Permission / Shift Change / Device Change Request, each opens its list | PASS | `RequestsHubScreen.tsx:21` (`ROWS`, routes from `routes.admin.requests.*`) |
| Category label "REQUESTS" | PASS | `RequestsHubScreen.tsx` (`Text variant="micro"`) |
| Row badge = unread pending, hidden at 0, "99+" above 99 | PASS | `CountBadge` (`src/components/ui/Badge.tsx:150`), `unread` from `utils/badgeLogic.ts:39` |
| `hasPending`: any pending date else request status; one count per request; unknown types ignored | PASS | `src/api/mappers/requests.ts:105`, `badgeLogic.ts:28-36` |
| Pending / unread per type, total = sum | PASS | `badgeLogic.ts:32-47` + `__tests__/badges.test.ts` |
| Live refresh every 10 s while focused; stops when another screen covers the hub | PASS | `useAdminRequests.ts:18,35-41`, `RequestsHubScreen` `usePolling(..., { enabled: focused })` |
| Cached counts shown instantly on focus | PASS | one shared react-query entry `queryKeys.requests.admin(orgId)` (`useAdminRequests.ts:27`) |
| Opening Leave clears its badge; v2 fix: ALL four lists clear theirs | PASS | `useRequestList` marks pending ids seen (`useAdminRequests.ts:80-88`); store `store/seenStore.ts` |
| Seen is a high-water COUNT that hid new requests | DEV-OK | replaced by a per-type id SET scoped org+user (B8 "Fixes applied"; spec §13a) |
| Home tile and hub use different metrics | DEV-OK | one `useRequestBadges` hook (`hooks/useRequestBadges.ts:26`); Home still shows `pending.total` via `usePendingRequests` (B8 "Deferred") |
| Failed poll / `success:false` keeps previous badges, no error shown | PASS | react-query keeps data; hub shows no error UI |
| Header logo fetched (v1 placeholder-only) | DEV-OK | `authApi.getOrgLogoUrl` (spec §13g) |
| Manager with `Requests Management` reaches hub via Settings; without it no row | PASS | `employee/utils/managerShortcuts.ts:78` (permission string exact) |
| Push `request_submitted` tap opens hub | PASS | handled by shell / `lib/realtime/globalRealtime.ts:49` increments badge; navigation owned by Bootstrap (not this scope) |
| Hub extras ("N pending" caption under each row) | DEV-OK | additive UX (B8) |
| Caches cleared on logout / org switch | PASS | store is scoped by `org:user` (`seenScope`) and query keys are org-scoped |

## 07 — admin_leave_requests.md

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| List newest-first by `created_at`, missing last, stable | PASS | `requestLogic.ts:42` `sortNewestFirst` + test |
| Dates strip `03, 04 Jan 2025 • 01 Feb 2025` (group by month, sort, raw join if unparseable, `—` if empty) | PASS | `requestLogic.ts:60` + `requestLogic.test.ts` |
| Reason fallback "No reason provided" | PASS | `RequestListScreen.tsx:61` |
| Status pill from overall status (all approved / all rejected / any pending / mixed -> first date) | PASS | `requestLogic.ts:27` `overallStatus` + tests |
| Pending: Approve / Reject; decided: "Change to Reject" (approved) / "Change to Approve" (otherwise) | PASS | `components/ApprovalCard.tsx` (`oppositeDecision`) |
| Approve / Reject / Change each confirmed first; Cancel = no call | PASS | `useDecideRequest.ts:69-78` (`useConfirm`, verbatim title/message/confirm text via `decisionCopy`, `requestLogic.ts:149`) |
| Copy: "Approve Leave" / "Reject Leave" / "Change to Approved|Rejected"; "Approve leave for X on {dates}?"; "Change leave status for X on {dates} to {approved|rejected}?" | PASS | `requestLogic.ts:149-170` + test |
| One `update-status` call per date, in parallel, body `{request_id,status,action_by,role_id,leave_date}` | PASS | `decisionTargets` (`requestLogic.ts:128`), `runDecision.ts`, `src/api/requests.ts:102` |
| Manager session sends `role_id=2`, `action_by=user_id` | PASS | `useDecideRequest.ts:40` (`session.roleId`, `session.userId`) |
| Success feedback "Leave Approved" / "Leave Rejected" | DEV-OK | toast instead of 2 s popup (B8 Deviations); text verbatim |
| Optimistic local update + reconcile with next poll | PASS | `applyDecision` + `setQueryData` + invalidate (`useDecideRequest.ts:43-57`) |
| Empty `dates`: no false success; decided with ONE real call | PASS | `decisionTargets` returns `[undefined]`; spec §13(2) |
| `success:false` / HTTP error surfaced as error toast with server detail / "Failed to update" | PASS | `src/api/requests.ts:102` (`assertSuccess`), `failureMessage` (`runDecision.ts:28`) |
| Partial failure (some dates saved): per-date results, patched, message "Updated 2 of 3 dates…" | PASS | `runDecision` `allSettled` (spec §13(4)) |
| Load failure toast "Failed to load requests" (once, not on every poll); old list stays | DEV-OK | `useLoadErrorToast` (B8; spec says repeats, FIX_POLICY B2) |
| 10 s polling, pull-to-refresh | PASS | `useInboxPolling`, `useRequestList.refresh` (`useAdminRequests.ts:90-100`) |
| Header "N Pending" (requests with any pending date; `{}` date_statuses falls back to status); hidden at 0 | PASS | `RequestListScreen.tsx:163`, `pendingRequestCount` (`requestLogic.ts:37`) |
| Per-date chips (read-only) | DEV-OK | addition (B8; spec §13(8) suggests exposing per-date status) |
| Per-date approve/reject UI for leave | DECISION | spec §7.1 / §13(8): v1 applies to ALL dates; kept (see D5) |
| "Processing..." overlay while acting | PASS | `LoadingOverlay` (`RequestListScreen.tsx:167`) |
| Focus marks leave badge seen | PASS | (see requests.md; marked on every refresh while open) |
| org id `current_org_id || user_id` | PASS | `useOrgId()` |

## 07 — admin_permission_requests.md

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Cards grouped by requested date, newest date first; one card per request x date with own status/actions | PASS | `requestLogic.ts:104` `groupPermissionsByDate` + test |
| Time range 12-hour with en dash (`2:30 PM – 4:00 PM`, `12:15 AM`, `12:00 PM`, missing end = `2:30 PM – `) | PASS | `formatPermissionRange` (`requestLogic.ts:84`) + test |
| Row labels Req. Date / Time / Reason | PASS | `RequestListScreen.tsx:55-63` (label rendered upper-case by `InfoRow`: presentational) |
| Reason has no fallback (v1) | DEV-OK | shows "—" when empty (cosmetic) |
| Approve / Reject / Change copy `Approve permission for {name} on {dd Mon yyyy}?`, titles "Approve Request" / "Reject Request" / "Change to …" | PASS | `decisionCopy` + test (`requestLogic.test.ts`) |
| Single call with `leave_date = card date`, `role_id` sent | PASS | `decisionTargets('permission')` |
| Local update stamps only that date; request status unchanged until uniform | PASS | `applyDecision` + test ("permission: one date only") |
| Success "Request Approved" / "Request Rejected" | PASS | `decisionCopy` |
| Header pill counts requests (not cards) | PASS | `pendingRequestCount` |
| Request with empty `dates` shows the empty state, not a blank area | DEV-OK | spec §13 "show empty text" |
| Approving date A leaves date B pending; pill still counts the request once | PASS | test "one entry per request x date" |
| Permission badge cleared by visiting (v1: never) | PASS | spec §13 fix; `useRequestList('permission')` |
| Empty "No permission requests found"; load toast "Failed to load requests" | PASS / DEV-OK | `RequestListScreen.tsx:29`; ErrorState with retry when nothing cached |

## 07 — admin_shift_change_requests.md

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Newest first; staff, pill, Current Shift / Requested Shift / Shift Date / Reason rows, missing = `—` | PASS | `RequestListScreen.tsx:64-72` |
| Created-date badge on the left | DEV-OK | "Submitted {date}" under the name (B8; spec §13 notes the badge was confusing) |
| Decision is whole-request: update call WITHOUT `leave_date`, with `role_id` | PASS | `decisionTargets` -> `[undefined]` (`requestLogic.ts:128`) |
| Copy `Approve shift change for {name}?`, `Change shift change status for {name} to {approved|rejected}?`, "Request Approved/Rejected" | PASS | `decisionCopy` + test |
| "N Pending" counts `status==='pending'` only | PASS | `hasPending` falls back to the status when `date_statuses` empty |
| 10 s polling, pull-to-refresh, empty "No shift change requests found" | PASS | as other lists |
| Returning to the screen resets a stuck "Processing..." overlay | PASS | `useAsyncAction` always clears (`src/hooks/useAsyncAction.ts`) |
| "Change to …" after a decision | PASS | `ApprovalCard` |

## 07 — admin_device_change_requests.md

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Optional Device / OS rows (hidden when empty) | PASS | `RequestListScreen.tsx:80-90` |
| Whole-request decision, `role_id`, "Request Approved/Rejected" | PASS | as shift change |
| Copy `Approve device change for {name}?`; "Change device change status for X to rejected?" | PASS | `decisionCopy` + test |
| "N Pending" hidden at 0; subtitle only when org name known | PASS | `RequestListScreen.tsx:163,157` |
| Empty "No device change requests found" | PASS | `RequestListScreen.tsx:31` |
| Unknown request status renders "Rejected" | DEV-OK | mapper maps unknown to `pending` (`mappers/requests.ts:parseStatus`); backend only emits the 3 values |
| Failed poll toast repeats every poll | DEV-OK | once per outage (FIX_POLICY B2) |

## 07 — odometer.md

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Rate card `₹{perKm}` + "per km"; default 3 until server answers; edit prefilled with current rate | PASS | `expenses/admin/components/OdometerParts.tsx` (`RateCard`, `EditRateModal`), `odometerMath.ts:11,31` |
| Amount = distance x CURRENT org rate (re-prices all rows) | PASS / DECISION | `readingAmount` (`odometerMath.ts:24`); frozen amounts need backend (D6) |
| Rate 3, distance 12.5 -> total `12.50 km`, centre `12.5 km`, amount `₹37.50` | PASS | `OdometerParts.tsx` (`formatKm(distance,1)` / `formatKm(distance)`), test `screens.test.tsx` |
| start 100 / stop 150, no `distance_km` -> 50 / `₹150.00` | PASS | `readingDistance` (`odometerMath.ts:17`) + `odometerMath.test.ts` |
| `start_km = 0` counts as 0 (v1 quirk: distance 0) | DEV-OK | treated as a defect; documented in B8 |
| Rate validation numeric and > 0 (`abc`, `0`, `-1` -> "Please enter a valid rate", modal stays) | PASS | `parseRate` (`odometerMath.ts:38`) |
| Decimal rate: v1 sent a float the backend rejected | DEV-OK | rounded to whole rupees + live hint "Saved as ₹4 per km (whole rupees only)" (B8; backend `rate: int`) |
| Save rate: toast "Rate updated successfully" / failure "Failed to save rate"; amounts update immediately | PASS | `useExpenseReview.ts:137`, cache write `setQueryData(rateKey)` |
| Pending: Photos / Reject / Approve; decided: no buttons, status pill | PASS | `ReviewActions` (`components/ReviewParts.tsx`) |
| Approve -> PUT `{status, org_id}`; toast "Reading approved successfully"; reject toast is not an error | PASS | `src/api/expenses.ts:reviewOdometerReading`, `useExpenseReview.ts:153` (info for rejection; spec §13) |
| Confirmation + busy state before approve/reject | DEV-OK | spec §13 asks for it; copy new ("… This cannot be changed later.") |
| Approve / reject failure toast: server text, else "Failed to approve/reject reading" | GAP-FIXED | G3 (`reviewFailureMessage`) |
| Date filter (no future date), `n of m records`, "No Readings Found" + helper text, clear | PASS | `ReviewFrame.tsx:61` `maxDate={todayIST()}`, `recordFilter.ts` |
| Date filter compares IST date strings (v1 UTC bug) | DEV-OK | spec §13 fix |
| Photos modal: "Odometer Photos", Start Reading / Stop Reading, "No photos uploaded", summary name/date/amount | PASS | `OdometerScreen.tsx`, `ReviewParts.tsx:120` |
| Fallback user "Unknown User" | PASS | `OdometerParts.tsx:134` |
| Load failure: toast + empty list | DEV-OK | ErrorState with retry (spec §13) |
| Pull-to-refresh / refetch on focus (v1 none) | DEV-OK | spec §13 |
| Settings preload handoff (route params) | DEV-OK | react-query cache (BUILDER_BRIEF: no JSON in params) |

## 07 — travel_ticket.md / other_bills.md

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| `expense_type=TRAVEL` / `BILL`; org-scoped list; server order kept | PASS | `src/api/expenses.ts:listExpenses`, `useExpenseReview.ts` |
| Card: employee, date, amount, status chip; "Ticket Amount" / "Bill Amount" | PASS | `expenses/admin/components/ExpenseReviewScreen.tsx:20-45` |
| Bills date line `{date} • Bill/Invoice` (card and modal) | PASS | `ExpenseReviewScreen.tsx:42` |
| Amount display `₹1,500.00` (v1 `toLocaleString()` no fixed decimals) | DEV-OK | consistent 2-decimals INR (`formatINR`) |
| Photo modal titles "Travel Ticket" / "Bill Receipt", "No photo uploaded" | PASS | `ExpenseReviewScreen.tsx` + `ReviewParts.tsx` |
| Approve toast "Ticket approved" / "Bill approved"; reject "Ticket rejected" (v1 error colour) | PASS / DEV-OK | info toast for rejection (spec §13) |
| Failure: server message, else "Failed to approve ticket" / "Failed to reject bill" | GAP-FIXED | G3 |
| Empty "No Tickets Found" / "No Bills Found" + helper text; `0 of {m} records` | PASS | `ExpenseReviewScreen.tsx:34-41` |
| Date filter, clear, "Filter by date" | PASS | `ReviewFrame.tsx` |
| "Loading tickets..." text | DEV-OK | skeleton list |
| Load failure silent in v1 | DEV-OK | ErrorState + retry (spec §13) |
| Missing amount -> `₹0.00`; "Unknown" employee | PASS | `mapExpense` (`num`), `ExpenseReviewScreen.tsx` |
| Stale-closure `setTickets(tickets.map…)` | DEV-OK | functional cache patch (spec §13) |

## 07 — staff_location.md

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Freshness: green <= 15 min, red older, no timestamp = red | PASS | `location/utils/freshness.ts:9,17-26` + `freshness.test.ts` |
| Counters: punched-in AND coordinates AND fresh / stale-or-never; tap -> list "Recently Updated Staff (n)" / "Outdated Location Staff (n)" | PASS | `computeStats` (`freshness.ts:58`), `LocationParts.tsx` `TITLES` |
| Counter labels UPDATED WITHIN / BEFORE 15 MINS | PASS | `StaffLocationScreen.tsx:255` |
| List rows `{emp_id} • {branch}`, `Last updated: hh:mm AM/PM`, freshness dot | PASS | `LocationParts.tsx:50-60` |
| All Field Staff panel: Completed / Working / Not Started, "No location data yet", empty "No field staff found for this date" | PASS | `staffStatus` (`freshness.ts:44`), `LocationParts.tsx:112` |
| "View All Staff (n)" | PASS | `LocationParts.tsx:125` |
| Today: positions refresh every ~10 s without a loading indicator; past dates static | PASS | `useStaffLocation.ts:13,70-71` |
| "Today"/fetch date in IST (v1 mixed local / UTC) | DEV-OK | `todayIST`, `isTodayIST` (spec §13(2)) |
| Past date: "Loading data..." + date overlay; none -> "No data available / No staff location data for dd/mm/yyyy" | PASS | `StaffLocationScreen.tsx:229,241` |
| Future dates blocked | PASS | `maxDate={todayStr}` (`StaffLocationScreen.tsx:250`) |
| Marker/tap -> centre on staff; route polyline + Start / End markers (`{name} - Route Start`) | PASS | `StaffLocationScreen.tsx:121-145` |
| Map / Satellite toggle; zoom +/- | PASS / DEV-OK | toggle `StaffLocationScreen.tsx:215`; +/- native only, Leaflet control on web (B8) |
| Branch filter (v1 did nothing): filters markers, counters, lists | DEV-OK | `filterByBranch` applied everywhere (spec §13(1)); "ALL" first option |
| Plan gate: Core / expired blocked, trial never; fetch gated; "Page Unavailable" + "Renew Plan" (iOS "View Plan Status") -> billing | PASS | `useStaffLocation.ts:38-39`, `LocationParts.tsx:18-20` |
| Lock message (v1 always "expired") | DEV-OK | upgrade hint for Core (spec §13(6)) via `useOrgPlan().message` |
| Staff / manager told to contact admin, no Renew button | DEV-OK | `canBuy = plan.audience === 'admin'` |
| Location permission denied / API errors do not crash; lists stay empty | PASS | `getCurrentPosition().catch`, ErrorState |
| Selected staff derived from live list; route refetched on poll | DEV-OK | spec §13(3) |
| Home -> screen AsyncStorage preload | DEV-OK | query cache (B8) |
| Stat list closes when a staff row is tapped | DEV-OK | the open recent/outdated panel stays open beside / under the map (only "all" closes); no loss of function |

## 07 — track_location.md

| Item | Status | Evidence |
|---|---|---|
| Orphan screen not ported | DEV-OK | ROUTES.md "dropped"; FIX_POLICY B7 |

---

## 08 — chat.md (admin hub)

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Header org name + "Team Communication" | PASS | `chat/screens/hub/AdminChatHubScreen.tsx` (`HubHeader`) |
| Hero "Communicate / Stay connected with your team", tiles Messages / Groups / Announce | PASS | `AdminChatHubScreen.tsx:15-19,52-66` |
| Four cards in order with exact titles/descriptions | PASS | `hubLogic.ts:24` `ADMIN_HUB_ITEMS` |
| Badge on Individual and Group (0 hidden, 99+), none on announcement cards | PASS | `badgeFor` (`hubLogic.ts`), `HubMenuCard` `CountBadge` |
| Plan gate: free trial open; expired / no plan blocked ("Feature Unavailable" + message); iOS "View Plan Status", else "Renew Plan"; fail-open | PASS | `decideChatGate` (`hubLogic.ts:63`), `useChatGate` (`hooks/useChatHub.ts`), `hubLogic.test.ts` |
| Menu flashed before the plan check; plan cached forever | DEV-OK | skeleton while loading; react-query 5 min (B9b) |
| Preload chat list / groups / staff into GlobalCache | DEV-OK | react-query cache replaces it |
| Unread refresh on every focus; failed refresh keeps previous counts (v1 wrote 0) | PASS | `useChatUnreadSync` (`hooks/useChatHub.ts`) |
| Org id `current_org_id || user_id` | PASS | `useOrgId()` |
| Child routes plan-gated centrally (spec §13) | DECISION | D2 |
| Dead "coming soon" toast / SOON badge | DEV-OK | not ported |

## 08 — individual_chat.md

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Cached list shown instantly, refreshed in background; skeleton only on first load | PASS | `DirectListPane.tsx` + react-query |
| "No chats yet" + hint; "No matching chats" when searching | PASS | `DirectListPane.tsx:85` |
| Search 300 ms debounce (backend), dropdown only if results, "New" pill when no conversation | PASS | `hooks/useChatSearch.ts:14`, `DirectListPane.tsx` |
| Local fallback search when the backend search fails; roles 2/3 see only admin | PASS | `useChatSearch.ts`, `utils/chatLists.ts` (`filterSearchResults`, `searchStaffLocally`) |
| List also filtered by name / role / dept / branch | PASS | `filterChatContacts` |
| Open chat: unread zeroed immediately, badge lowered by that amount, history asc, mark-read | PASS | `useDirectConversation.ts:150-165` |
| History ascending by server time, deduped by id, duplicate ids not rendered twice | PASS | `normalizeItems` (`messageLog.ts`) + `messageLog.test.ts` |
| Day separators Today / Yesterday / `5 March 2025` | PASS / DEV-OK | `dayLabel` (`format.ts:106`); IST (v1 device zone) |
| Send text: optimistic bubble, input clears, list preview updates, temp id replaced by server id | PASS | `sendText` / `deliver` (`useDirectConversation.ts`), reducer `confirmed` |
| Send failure: bubble kept, no duplicate on refetch; v1 silent forever | DEV-OK | `failed` state + toast + Retry / Discard (spec §13(3)) |
| Photo (camera) / file: optimistic bubble, multipart with sender/receiver ids, progress, camera/attach disabled while uploading | PASS | `sendAttachment`, `usePickAttachment`, `uploading` |
| WS `new_message` from the open partner appends, scrolls, mark-read | PASS | `useDirectConversation.ts:197-212` |
| WS message from another partner never appended to the open conversation | PASS | `directBelongs` guard (`messageLog.ts:280`) — spec §13(1) fixed |
| Other partner's message: row unread +1 / preview, new row if unknown, badge +1 once (global socket dedupe) | PASS | `useDirectChatList.ts:60-75`, `store/badges.ts:incrementChatForMessage` |
| `read_update` marks only my messages of the OPEN conversation | PASS | `readAppliesToDirect` (`frames.ts:91`) — spec §13(2) fixed |
| WS `delivered` sets `isDelivered` | PASS | reducer `delivered` |
| WS down: every 4 s refetch | DEV-OK | managed socket with backoff reconnect + refetch/mark-read on reconnect (`lib/realtime/socketCore.ts`, `useChatSocket` `onReconnect`) |
| Optimistic messages retained during a merge | PASS | reducer `history` keeps `sending/failed` + recent confirmed (`messageLog.ts:181`) |
| Ordering: client clock never mis-orders (pending after confirmed) | PASS | `compareItems` (`messageLog.ts:113`) — spec §13(14) |
| Own message sent from another device appears | PASS | `incoming` fromMe handling |
| In-chat Search, case-insensitive on text, closing clears | PASS | `DirectConversationPane.tsx`, `utils/rows.ts` |
| Delete Chat: confirm "Delete Chat / Are you sure … This cannot be undone." -> API -> list refreshed; failure toast | PASS | `DirectConversationPane.tsx:43` (spec §13(13)) |
| View Contact: Emp ID / Mobile / Email / Department / Branch / Role (Admin / Manager / Staff), "-" for blanks | PASS | `components/ContactSheet.tsx` (spec §13(11)) |
| `sender_name` = user's name (v1 org name) | PASS | `senderName = session.name` |
| Pin chat / mute / chat theme (in-memory only) | DEV-OK | not ported (FIX_POLICY B7, spec §13(5)); B9a "Dead / not ported" |
| Media/Links/Docs sheet, `/test_upload` TEST button, "No staff found" row | DEV-OK | dead code not ported (spec §13(6)-(8)) |
| Android hardware back: conversation -> list (list refreshed) | PASS | route back + `useRefreshOnFocus` |
| Received image does not flicker on refetch | PASS | `useStableUri`, `stableImageKey` |
| Badge drift for the open conversation | PASS | spec §13(15): `incrementChatForMessage` + `markChatRead(1)` net zero (`useDirectConversation.ts:204-207`) |
| Unread badge cap 99+ | DEV-OK | v1 raw number |
| Sockets reconnect, heartbeat, close on sign-out | PASS | `lib/realtime/socketCore.ts` (+ `useChatSocket` rebinding) |

## 08 — group_chat.md

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Cached groups render instantly; "Search groups…" filters by name; empty "No groups yet / Create a group to chat with your team" + Create Group | PASS | `chat/components/GroupListPane.tsx` |
| Card: initials colour, `Sender: preview`, time (`Just now`/`m ago`/HH:MM/Yesterday), `{n} members`, unread | PASS | `GroupListPane.tsx`, `format.ts:groupListTime` |
| List uses `org_id` (v1 `organization_id`) | PASS | `src/api/groupChat.ts:listGroups` |
| Create: needs name (max 50) and >=1 member; creator prepended to `member_ids`; "Group created!" / "Failed to create group" | PASS | `CreateGroupSheet.tsx:16,42-43`, `src/api/groupChat.ts:createGroup` |
| "{n} member(s) selected" chips | PASS | `CreateGroupSheet.tsx` |
| Staff load failure "Failed to load staff" (toast in v1) | GAP-FIXED | G1 (inline error + retry) |
| Open group: unread zeroed, badge lowered, messages + members loaded, mark-read | PASS | `useGroupConversation.ts:114-130` |
| Text send optimistic, WS echo does not duplicate; file/photo has optimistic bubble + progress (v1 none) | PASS / DEV-OK | reducer `incoming` echo matching + `confirmed` duplicate removal |
| Send failure retry / discard; toasts visible in conversation (v1 invisible) | DEV-OK | spec §13(2),(5),(6) |
| Only this group's messages append; other group row unread +1 + preview + badge once | PASS | `groupBelongs` guard, `useGroupChatList.ts:44-60` |
| Read ticks: own message double tick only when ALL other members read | DEV-OK / DECISION | `groupAllRead` uses `read_count >= total_members` because `total_members` already excludes the sender (B9a; spec formula `>= total_members - 1`) — D1 |
| `read_update` of another group / a 1:1 receipt ignored; no counts -> debounced history refresh | PASS | `readAppliesToGroup` (`frames.ts:100`), `useGroupConversation.ts:134-146` |
| Members: "You", Admin tag, dept / branch / role, "No members found" | PASS | `components/MembersSheet.tsx` |
| Members load failure shown (not "No members found") | GAP-FIXED | G1 |
| Add Staff: only non-members, "Add {n} Staff", toast "{n} staff added!", header count updates; failure "Failed to add staff" | PASS | `AddStaffSheet.tsx`, `useGroupConversation.ts:247-262` |
| Add Staff staff-load failure not shown as "All staff are already members" | GAP-FIXED | G1 |
| In-chat search "Search messages..." filters, closing clears | PASS | `GroupConversationPane.tsx` |
| 8 themes persisted per group on this device (survives restart) | PASS | `hooks/useGroupThemes.ts`, `utils/chatThemes.ts:32` (palette values verbatim) |
| Menu entries Mute Notifications / Admin Only Messages / Delete Chat (toast-only stubs) | DEV-OK | not ported (B9a; spec §13(1)); "View Contact" labelled "View Members" |
| Group socket with reconnect; own messages read only on receipts | PASS | `useGroupSocket`, `messageLog.ts:groupAllRead` |
| Date separators / sorted history (v1 none) | DEV-OK | spec §13(8) |

## 08 — ChatMessageBubble.md (shared)

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Kind resolution: type first, then URL extension (jpg jpeg png gif webp heic / mp4 mov avi mkv); query stripped | PASS | `chat/utils/format.ts:resolveMessageKind` + `format.test.ts` |
| Text bubble with time; own: single tick, double (accent) when read | PASS | `components/MessageStatus.tsx`, `MessageBubble.tsx` |
| Pending / failed visual states (v1 ignored `isDelivered`) | DEV-OK | spec v2 note: clock / alert states |
| Image: square thumbnail with time + own-only ticks overlaid, no footer | PASS | `MessageBubble.tsx:ImageContent` (232 px vs 220) |
| Incoming image "Tap to view" reveal gate, persisted per URL for the session, then lightbox; own image opens lightbox | PASS | `isImageRevealed` / `markImageRevealed` (`utils/chatSession.ts`), `ImageViewer` |
| First URL locked (optimistic `file://` -> server URL never flickers) | PASS | `hooks/useStableUri.ts` |
| File card: name without 32-hex prefix, `EXT · Tap to download` / `Downloading…` / `Downloaded · Tap to view` / own `Tap to open` | PASS | `MessageBubble.tsx:FileContent`, `format.ts:displayFileName` |
| Download failure -> Google Docs WebView viewer | DEV-OK | not ported (native-only dependency); error toast "Could not open the file" (B9a Deviations) |
| Video tile "Tap to play" opens externally | PASS | `MessageBubble.tsx:VideoContent` |
| Long-press menu: "Download" for files / images (text: Copy) | PASS | `MessageBubble.tsx` BottomSheet |
| Theme colour overrides (group themes) | PASS | `theme` prop (`ChatThemeColors`) |
| `showTicks`, `isDelivered`, `senderName` props | DEV-OK | single component takes a `ChatItem`; ticks always for own messages; sender name above incoming group bubbles |
| `message` null-safe | PASS | `ChatItem.text` is always a string (mapper) |
| Session memory (revealed / downloaded) cleared on sign-out | PASS | `registerTeardown(resetChatSessionMemory)` |

## 08 — announcement.md (All / Selected)

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Title <= 100, message <= 1000, counters `{n}/100`, `{n}/1000`, warning above 80 / 900 | PASS | `announcements/components/ComposeFields.tsx`, `targets.ts` constants |
| Placeholders "What's the announcement about?" / "Write your announcement details here..." | PASS | `ComposeFields.tsx` |
| Send To: "All Staff" / "Select Staff"; picks cleared when switching to All; picker opens on Select | PASS | `screens/AnnouncementsScreen.tsx:41-46` |
| Chips "{n} member(s) selected" + Edit; removable chips | PASS | `AnnouncementsScreen.tsx:116-130` |
| Send label "Send to All Staff" / "Send to {n} Staff"; disabled until title+message(+ staff) | PASS | `sendLabel`, `isSendDisabled` (`targets.ts:78`) |
| Validation order and toasts "Title is required" / "Message is required" / "Select at least 1 staff member" | PASS | `validateCompose` (`targets.ts:28`) |
| Payload `{org_id, sent_by_id, title, message, target, selected_user_ids?}` trimmed; `all` omits ids | PASS | `src/api/announcements.ts:56` `buildAnnouncementBody` + `api/__tests__` |
| Success: form resets, target resets to All, "Announcement Sent!" ~2.2 s / tap dismiss; subtitle shows the real count | PASS / DEV-OK | `SuccessDialog.tsx`, `successSubtitle` captured before reset (spec §13(1)) |
| Backend failure message as error toast, else "Failed to send announcement" | PASS | `useSendAnnouncement` (`hooks/useAdminAnnouncements.ts`) |
| History loads for the org, reloads on every tab entry and after send; count pill from mount | PASS / DEV-OK | `AnnouncementsScreen.tsx:48`, invalidate on send |
| History search title/message; "No results"; badge "All Staff" / "{n} Staff" / "by {sent_by}" | PASS | `targets.ts:164,180`, `AnnouncementHistory.tsx` |
| Delete: confirm "Delete Announcement?" + body; toast "Announcement deleted"; Cancel keeps; `success:false` surfaced | PASS | `AnnouncementHistory.tsx`, `useDeleteAnnouncement` |
| Select All over filtered rows (keeps picks outside the filter), label shows filtered count | DEV-OK | spec §13(5) |
| Picker: search, Select All, "Done / Done (n)", "No staff found", staff-load failure toast | PASS | `StaffPickerModal.tsx` (ErrorState + retry) |
| Self included in picker | DECISION | D8 |

## 08 — announcement_branch_dept.md

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Branch mode default; "Target Type" Branch / Department; other selection cleared when toggling | PASS | `screens/AnnouncementsTargetedScreen.tsx:67-72,201` |
| Pills with icon, single select; "Sending to: {name}"; "No branches found" / "No departments found" | PASS | `OptionPills`, `AnnouncementsTargetedScreen.tsx` |
| Tap a chosen pill again deselects | DEV-OK | spec §13(3) |
| Payload `target:'branch'` + numeric `branch_id` / `target:'dept'` + `dept_id` string; trimmed title/message | PASS | `buildAnnouncementBody` (`src/api/announcements.ts:56-67`) |
| Validation order "Title is required" / "Message is required" / "Select a branch" / "Select a department" | PASS | `validateCompose` |
| Send label `Send to {branch or "Branch"}` / `Send to {dept or "Department"}` | PASS | `sendLabel` |
| Success "Announcement Sent!" + `{name} staff notified` (v1 always fallback) | DEV-OK | spec §13(1) |
| History only branch/dept; search matches title, message, branch, dept names; badge = name; delete "This announcement will be permanently removed." | PASS | `filterTargeted`, `filterAnnouncements(withNames)` |
| Branch / dept list failures not silent | DEV-OK | ErrorState + retry (spec §13(2)) |
| Departments not scoped to the chosen branch | DECISION | targeting rules kept (FIX_POLICY C) |

---

## 09 — crm.md (admin hub)

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Menu cards "Enter Leads / Add new client leads" and "View / Assign Leads / {n} lead(s) today" (`1 lead today`, `0 leads today`) | PASS | `crm/screens/AdminCrmScreen.tsx:112-118`, `utils/leads.ts:80` |
| Header org name + "CRM & To-Do" | PASS | `AdminCrmScreen.tsx` |
| Plan gate: Core / Prime / expired blocked, trial & Elite allowed; fail-open; "CRM Unavailable" + message, "Renew Plan" (iOS "View Plan Status") -> billing; NO leads fetch when blocked | PASS | `PlanBlockedCard.tsx`, `config/plans.ts` |
| Plan checked BEFORE fetching; blocked org sees only the lock card (no menu) | GAP-FIXED | G4 |
| Tab switcher only when leads or CFRs exist; badge = pending CFR count (all) | PASS | `AdminCrmScreen.tsx:60,87-99` |
| Overview date chips Yesterday / Today / Tomorrow / Pick Date (`dd/MM` + clear -> Today) | PASS | `components/DateChipBar.tsx`, `utils/dates.ts:11` |
| Date rule: required date, else creation day; custom with no date = no filter | PASS | `matchesLeadDate` (`dates.ts:30`) + `leads.test.ts` |
| Overview counts / list filter (unassigned excludes carry_forward; one `bucketOf` for counts AND list) | PASS / DEV-OK | `utils/leads.ts:48-62`; v1 disagreement fixed (B10) |
| Stat cells Total / Unassigned / Pending / Working / Completed / Carry Fwd, tap filters, active filled | PASS | `components/hub/StatsGrid.tsx` |
| "Lead-wise Status" list; absent when empty (v1) | DEV-OK | compact "No leads here" message (B10) |
| Lead row: name, `CFR Assigned|Approved|Pending • Prev: X`, assignee, date; pill Unassigned / Assign / status / CFR; pill jumps to assign view; row opens Lead Details | PASS | `components/hub/LeadRow.tsx`, `utils/carryForward.ts:66` |
| Lead Details sheet: Mobile / Location / Category / Assigned To / Date / Remarks, fallbacks `Unassigned` / `N/A` | PASS | `components/hub/LeadDetailSheet.tsx` (unassigned pill instead of work status: DEV-OK, spec §13(14)) |
| CFR card: EMPLOYEE / REASON / REQUESTED FOR DATE / SUBMITTED ON, `N/A`; pending first; de-duplicated by request id | PASS | `CfrCard.tsx`, `orderCfrRequests` (`carryForward.ts:105`) |
| CFR date filter by SUBMITTED day; All / Yesterday / Today / Tomorrow / Pick Date; Clear -> All | PASS | `matchesSubmittedDate` (`dates.ts:35`), `CfrSection.tsx` |
| Approve confirms ("Approve Request?" / "Confirm approval…" / "Yes, Approve", shows requested date), flips card, reloads leads, toast "CFR approved successfully"; Reject immediate, no toast; buttons disabled while acting; errors toast | PASS | `CfrSection.tsx:30`, `hooks/useAdminLeads.ts:69-88` |
| CFR attached to a lead: pending wins, else NEWEST approved (v1 oldest) | DEV-OK | `indexCarryForward` (`carryForward.ts:31`) + test (spec §13(6)) |
| CFRs fetched once (v1 twice); multi-assignee rows merged | DEV-OK | `useAdminLeads`, `dedupeLeads` (`leads.ts:14`) |
| Pull-to-refresh reloads leads + CFRs | PASS | `usePullRefresh(refetchAll)` |
| `leads_need_refresh` flag, GlobalCache shapes, go-home prefetch | DEV-OK | query invalidation / shell navigation |
| Plan-status failure treated as allowed | PASS | `useOrgPlan` fails open |
| Carry-forward status never persisted by the backend (admin "Carry Fwd" ~0) | DECISION | D4 |

## 09 — assign_leads.md

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Subtitle "View & Assign Leads"; chips Yesterday / Today / Tomorrow + calendar (`dd/MM`, x -> Today) | PASS | `crm/screens/AssignLeadsScreen.tsx`, `DateChipBar` |
| Date filter by required date else creation day | PASS | `filterByDate` -> `effectiveDate` (`src/api/leads.ts:65`) |
| Empty "No Leads / No leads found for this date" | PASS | `AssignLeadsScreen.tsx:151` |
| Completed last, 60 % opacity, "Completed" badge, Edit/Delete/Done disabled and no-op | PASS | `sortCompletedLast` (`leads.ts`), `LeadCard.tsx:35-37,55`, handler guards |
| Third button: Done / Reassign / Assign (CFR violet, plain green) | PASS | `LeadCard.tsx:35-37` + `assignActionFor` |
| CFR banner `CFR Assigned` / `CFR Approved — Assign New Staff` / `Carry Forward Requested`, `Previously: X`, pill approved / pending, `Now Assigned To`, `Lead Created Date` | PASS | `LeadCard.tsx:42-52,66-71`, `cfrBannerTitle` |
| Green "Assigned to: X" + "Date: dd MMM yyyy" (non-CFR) | PASS | `LeadCard.tsx:75-87` |
| Assign view title `Assign Lead (CFR)` / `Reassign Lead` / `Assign Lead`; CFR banner; "Lead Details" rows; filters "All Branches" / "All Departments"; "Select Employee" | PASS | `assignViewTitle`, `components/assign/AssignView.tsx` |
| Employee list: de-duplicated, current assignee excluded, server-side branch/dept filter, chips `N/A` | PASS | `uniqueByUserId` (`leads.ts`), `useAssignOptions.ts` |
| Assign vs reassign decided by assignee id (v1 by name) | DEV-OK | `assignActionFor` (spec §7 item 4 risk) |
| POST `/assign` with employee branch/dept; PUT `/assignment/{id}`; popup "Lead Assigned!" / "Lead Reassigned!" 2 s, then list; errors "Failed to assign/reassign lead" | PASS | `AssignLeadsScreen.tsx:107-124`, `hooks/useLeadWrites.ts:25-37` |
| Delete: confirm "Delete Lead / Are you sure you want to delete this lead?", toast "Lead deleted successfully" / "Failed to delete lead" | PASS | `AssignLeadsScreen.tsx:99`, `useDeleteLead` |
| Edit opens Enter/Edit Lead (id only); list back -> hub; assign-view back -> list; hardware back closes the assign view first | PASS / DEV-OK | `AssignLeadsScreen.tsx:62-75,181` |
| `leadId` deep link opens the assign view (completed / missing handled with a toast) | PASS | `AssignLeadsScreen.tsx:44-60` |
| Branch/department filters reset every open (v1 persisted) | DEV-OK | spec §13(5) |
| "Loading leads..." text / error state | DEV-OK | skeleton + ErrorState + retry (spec §13(2)) |
| Required date format `yyyy / mm / dd` | DEV-OK | `dd MMM yyyy` everywhere (B10 Deviations) |

## 09 — enter_leads.md

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Titles "Enter New Lead" / "Edit Lead"; buttons "Save Lead" / "Update Lead" | PASS | `crm/screens/EnterLeadScreen.tsx:80-84` |
| Fields Name / Mobile / Address / Category / Remarks / Customer Required Date + placeholders | PASS | `components/LeadForm.tsx` |
| Validation order: required (trimmed) then 10-digit mobile; messages "Please fill all required fields" / "Mobile number must be exactly 10 digits"; field cannot exceed 10; digits only | PASS / DEV-OK | `utils/leadForm.ts:20,36,42` (digits-only + trim: spec §13(2)) |
| Create `POST /api/leads/create` (`required_date:null` when empty) / edit `PUT /api/leads/{id}` | PASS | `src/api/leads.ts:buildLeadBody` |
| Edit prefills INCLUDING the required date; save never wipes it | DEV-OK | spec §13(1): `leadToFormValues` + `toUpdateInput` + tests |
| Success popup "Lead Saved!" / "Lead Updated!" ~1 s then back; failure "Failed to save lead" / "Failed to update lead" | PASS | `EnterLeadScreen.tsx:60,63`, `useLeadWrites.ts:59` |
| Save is only the write (follow-up refresh cannot fake a failure) | DEV-OK | spec §13(5) |
| Category dropdown with search "Search categories...", select closes + clears, "Select Category" | PASS | `components/CategoryPicker.tsx` |
| Add category: empty -> "Please enter category name"; success "Category added successfully", auto-selected | PASS / DEV-OK | `CategoryPicker.tsx:42`, `useLeadCategories.ts` (spec §13(4)) |
| Delete category: toast "Category deleted successfully" / "Failed to delete category"; now with confirmation and clears a stale selection | DEV-OK | spec §13(3) |
| Category load failure shown (not "No categories") | GAP-FIXED | G2 |
| Required-date calendar: Clear / Today / Cancel, tap day sets + closes, month arrows wrap | PASS | `DatePickerModal.tsx`, `LeadForm.tsx:87` |
| Keyboard open: first tap on Save registers | PASS | `Screen keyboardAware` footer button |
| Unguarded `JSON.parse(leadData)` / JSON blobs in params | DEV-OK | id-only param (BUILDER_BRIEF) |

## 09 — emp_crm.md (staff / manager "My Leads")

| Bullet / rule / copy | Status | Evidence / note |
|---|---|---|
| Header "My Leads" / "Assigned to you" / "Add Lead" | PASS | `crm/screens/StaffCrmScreen.tsx:107-110` |
| Chips All / Pending / Working / Completed (no Carry Forward chip) | PASS | `StaffCrmScreen.tsx:24-29`, `utils/employeeLeads.ts:filterEmployeeLeads` |
| Plan gate from plan-status for every role; blocked "CRM Unavailable / Your plan has expired. Please contact your admin." no button; no fetch while blocked or loading | PASS / GAP-FIXED | `StaffCrmScreen.tsx`; G5 for the loading window |
| Empty #1 "No Leads Assigned / Admin hasn't assigned any leads to you yet.\nPull down to refresh." | PASS | `StaffCrmScreen.tsx:88` |
| Empty #2 | DEV-OK | "No Leads Found / No leads match the selected status." (v1 "No Leads on This Date" no longer true) |
| Card: avatar, name, Work Status control, Phone / Category / Location / Remarks (`-` fallback) | PASS | `components/staff/EmpLeadCard.tsx` |
| Work-status picker Pending / Working / Completed / Carry Forward (current ticked); same-status = no-op; Completed -> Pending allowed | PASS / DEV-OK | `WorkStatusSheet`, `resolveStatusChange` (`workStatus.ts:35`) |
| Status change: `PUT …/work-status?work_status&user_id`, list re-synced, failure toast (v1 silent) | PASS | `useEmployeeLeads.ts:useUpdateWorkStatus` |
| Carry Forward opens the request dialog (no API yet); Send disabled until reason; trimmed description; forward date only when chosen; "Request Sent!" 2.5 s; duplicate request error shown | PASS | `components/staff/CfrModal.tsx`, `StaffCrmScreen.tsx:69-77,126` |
| CFR-pending violet card ("Carry Forward Requested / Awaiting admin approval / PENDING / CFR Reason / Requested For") driven by `/carry-forward/my`, so it survives a refresh | DEV-OK | `buildEmployeeLeads`, `EmpLeadCard.tsx:43-72` (spec §13(5)) |
| Forward-date and required-date calendars independent; forward date cleared on close | DEV-OK | spec §13(1),(10) |
| Add Lead sheet: inline errors "Please fill all required fields." / "Mobile number must be 10 digits." / "Failed to save lead."; confirmation says it was sent to the admin | PASS / DEV-OK | `components/staff/AddLeadSheet.tsx`, `LEAD_MESSAGES.staff` (spec §13(8)) |
| Inline category add (staff cannot delete) | PASS | `CategoryPicker allowDelete` false |
| List visibility: client "assigned today" filter (assignment `updated_at` == today) | DECISION | D3 |
| Opening the screen marks all fetched leads seen (overwrite) and clears the CRM badge | PASS | `StaffCrmScreen.tsx:55-61`, `seenLeads.ts:53` |
| Pull-to-refresh reloads leads and CFRs | PASS | `useEmployeeLeads.refetchAll` |
| Header back -> staff home | PASS | shell back / tab root |

## 09 — CRM badge / seen-leads logic (crm.md §9.2)

| Rule | Status | Evidence |
|---|---|---|
| Roles 2/3 only; admins never | PASS | `seenLeads.ts:tracksCrmBadge` |
| Badge = server employee list ids not in the stored seen list; scoped per user, wiped on sign-out | PASS | `countUnseen` / `seenStorageKey` (`seenLeads.ts`), `STORAGE_KEYS.crmSeenLeadIds` + `__tests__/seenLeads.test.ts` |
| Opening the CRM tab marks everything seen and clears the badge | PASS | `markCrmSeen`, `useCrmBadgeSync.ts` (`onCrmTab`) |
| v1 computed once per launch | DEV-OK | refresh every 5 min while foregrounded (`CRM_BADGE_REFRESH_MS`) |

---

## Other observations (not defects; no change made)

- Opening a conversation whose list row is not yet cached (deep link on desktop split view) cannot lower the badge for that conversation's unread until the next list sync; the hub sync (`useChatUnreadSync`) and list refresh on focus reconcile it.
- `leave` decisions are applied to every date incl. already-decided ones when a request is partly pending (v1 §7.2 behaviour, kept).

## Needs decision (behaviour unchanged)

| # | Item | Evidence | Why it needs a decision |
|---|---|---|---|
| D1 | Group read tick formula | spec group_chat §7/§14: `read_count >= total_members - 1`; shared/api/group_chat.md: `total_members` = active members minus 1 (sender excluded). Code: `groupAllRead` (`chat/utils/messageLog.ts:20`) uses `>= total_members` (B9a "off-by-one" fix; backend need logged) | If the backend really excludes the sender the v1 rule shows a tick one reader too early (2-person group: always read); if it includes the sender the new rule would never tick. Confirm the field semantics, then keep or revert |
| D2 | Plan gate on the chat child routes | chat.md §13 "gate centrally"; B9b "Deferred" (only the hubs gate; direct/group/announcement routes reachable by deep link) | adding a layout-level gate touches the app shell and the plan matrix is a product rule (FIX_POLICY C) |
| D3 | Staff "My Leads" list rule | emp_crm §7.3/§14 (v1 hides leads whose assignment was not updated today); §13(6) "decide and align". Code removed the filter (B10 "Fixes applied") | changes which leads a staff member sees (undated leads would stay visible indefinitely); confirm "due today or no date" as the intended rule, or restore the assigned-today filter |
| D4 | Carry-forward lifecycle | crm.md §7.2/§7.3 + B10 Deferred: request does not persist `carry_forward`, approved CFR stays forever, reject has no confirmation / toast | backend persistence + product rules (FIX_POLICY C); admin "Carry Fwd" count is effectively 0 |
| D5 | Per-date leave approve / reject UI | admin_leave_requests §7.1 / §13(8); B8 Deferred | v1 decides all dates at once; per-date UI needs a product decision and a bulk / date-aware `update-status` (B8 Backend needs) |
| D6 | Odometer approved amounts re-price with the current rate | odometer §7/§13; B8 Deferred | needs the rate stamped at approval by the backend (`allowance-rate` stored per org, int vs decimal) |
| D7 | Individual-chat pin / mute / theme, group Mute / Admin-only / Delete stubs | individual_chat §13(5), group_chat §13(1); FIX_POLICY B7 + B9a | policy drops them; if product wants them they must be persisted / enforced (server) |
| D8 | Announcement recipients | announcement §13(6): admin picker includes the sender and inactive users; branch / dept targeting rules unverified | targeting rules are FIX_POLICY C (server decides recipients) |
| D9 | Staff-visible chat timestamps | B9a Backend needs: zone-less timestamps are read as UTC; bubble times / day separators are IST | confirm the server timestamp format, otherwise times can be off by 5 h 30 m |

## Verification

- `npx jest src/features/{requests/admin,expenses/admin,location,chat,announcements,crm}`: 35 suites, 309 tests passing (incl. the 5 new / extended test files above; the three new test files raise the per-file timeout because the first render of a file is slow when the whole suite runs in parallel).
- `npx tsc --noEmit`: 0 errors for the whole project.
- `npx eslint` on every touched path: clean.
- `npm run check:brand`: passed.
