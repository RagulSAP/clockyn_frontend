# Backend changes needed for Clockyn

Compiled for the backend owner from the engineers' change logs (`docs/changes/*.md`), the QA matrices (`docs/qa/*.md`), the fix policy (`docs/FIX_POLICY.md`) and the v1 specification set (`../project_complete_context/`, relative to the Clockyn folder, outside this repo). Every item that this review depends on was re-checked against the backend repository snapshot dated 2026-09-05 (read-only). Backend file references below are relative to that repository (for example `router/chat.py:170`); app references are relative to this repository.

## 0. How to read this document

- **Evidence tags.** `[V]` = verified by this review in the snapshot (file and line given). `[L]` = reported by an engineer log or QA matrix only, not re-verified. `[V!]` = verified and it **contradicts or refines** what a log or the v1 notes said.
- **Snapshot caveat.** The snapshot may be older than the deployed server (its schema dump has no `block_attendance` column although the code uses it, and `migrations/` contains only a README). Before building anything marked P0, check the deployed server first: an endpoint that is "absent" here may already exist there.
- **Method for P0.** Every `api.get|post|put|patch|delete|upload` call in `src/api` (about 210 distinct method+path patterns, about 225 concrete routes once the dynamic payroll paths are expanded) was compared with every route decorator found in the backend repository (295 route rows including WebSockets). The report downloads, the invoice download and the three WebSocket paths, which are built outside those calls, were checked by hand and all exist. The comparison found **22 method+path pairs that the app declares and the backend does not mount**: 21 are real dependencies, grouped into P0-1 to P0-7 below; the 22nd is `GET /auth/push-token/{id}`, a dead export that no screen calls (section 7).
- **The mock backend is the executable contract.** `e2e/mock-server/` implements every endpoint the app calls, including all P0 ones, with the envelopes the app expects. Use it as the reference for response shapes (see `e2e/README.md`). File and line pointers are given per item.
- **Priorities.** P0 = a screen cannot work without it. P1 = wrong or missing data or behaviour (the app works around it where noted). P2 = contract and consistency. P3 = security and hardening. "App-config" = values the product owner must supply.
- Legacy-product naming is deliberately absent from this file; where the backend still carries v1 branding it is described generically (item P2-10).

## 1. Summary

| Priority | Items | Meaning |
|---|---|---|
| P0 blockers | 9 (P0-1 to P0-9) | 21 missing method+path pairs the screens depend on, in 7 groups, plus two app-identity items (version check, push delivery) |
| P1 correctness | 17 (P1-1 to P1-17) | wrong, missing or inconsistent data |
| P2 contract / consistency | 15 (P2-1 to P2-15) | status codes, envelopes, time zones, validation, scale, branding |
| P3 security / hardening | 14 (P3-1 to P3-14) | no authentication, price tampering, PII, revocation, destructive endpoints |
| App-config (owner) | 11 (C-1 to C-11) | accounts, keys, URLs, e-mails the owner must supply |

### 1.1 Master table

| ID | Pri | Area / endpoint | Problem in one line | Ver. | App behaviour until the backend ships |
|---|---|---|---|---|---|
| P0-1 | P0 | `/api/daily-wages/*` (4 routes) | not mounted; the router file of that name contains a copy of the holiday router | V | Daily Wages screen shows an error state with Retry; nothing can be created |
| P0-2 | P0 | `/api/hourly-charges/*` (4 routes) | not mounted | V | Hourly Charges screen: same as above |
| P0-3 | P0 | `/api/wages/*` (4 routes: assigned, unassigned, assign, unassign) | not mounted | V | Assign dialogs of daily/hourly templates fail with the server error |
| P0-4 | P0 | `/api/attendance-rule/{org}` GET and POST | no route and no table | V | Screen shows the defaults (3 late punch-ins, Half Day) with a "could not load" notice; save fails with the server message; no rule is enforced anywhere |
| P0-5 | P0 | `GET /api/incentive/overtime-report/{org}` | not mounted | V | Overtime report lists all staff with "—" and a warning banner |
| P0-6 | P0 | `GET /salary/monthly-list`, `POST /salary/mark-paid` | not mounted; no table records a paid salary | V | Paid state is session-local (lost on reopen); totals come from the salary breakdown; the Pay buttons fail with the server error |
| P0-7 | P0 | `/shift/assigned_staff`, `/shift/unassigned_staff`, `/shift/assign_staff`, `/shift/unassign_staff` | not mounted | V | Assign Staff sheet says "Staff assignment is not available on this server yet." |
| P0-8 | P0 | `GET /version/check` | one row per platform, shared with the v1 app; the new app (1.0.0) would be told to update or be force-updated to the v1 listing | V | Update prompt appears as the server decides; nothing client-side can tell the two apps apart |
| P0-9 | P0 | FCM sender credentials | one Firebase project is configured; the new bundle id needs its own project | V | Push never reaches Clockyn devices; the app still runs (sockets and polling cover chat and badges) |
| P1-1 | P1 | `GET /requests/employee/{user}/{org}` | no `date_statuses`, no shift ids; leave request-level `status` is never updated | V | Badge uses request status or the request calendar; shift timeline shows less detail |
| P1-2 | P1 | `GET /addstaff/{id}`, `/home/staff-profile`, `/home/staff-detail` | no `branch_id` | V | Geofence data is not preloaded from these; the punch flow asks `/face/check-location` |
| P1-3 | P1 | `GET /home/monthly-attendance` | no shift times, no day types, odd late rule, future days counted absent, errors swallowed into an empty month | V | Late report shows "—" for shift columns and Late By; client infers absent, half-day and weekly off |
| P1-4 | P1 | `PUT /addstaff/{id}` | always writes `role_id = 3`, demoting managers | V | Edit stays reachable for managers (see DD-53); the demotion happens on save |
| P1-5 | P1 | `/api/holidays/*` | three routers share the prefix; `block_attendance` handling depends on mount order; the column is missing from the schema dump | V | Switch is sent; works only if the first-mounted router and column exist on the deployed server |
| P1-6 | P1 | group `read_update` WebSocket event; `POST /group-chat/add-members` | payload lacks `message_id`, `read_count`, `total_members`; no event on add | V | Client refetches history (debounced) to refresh ticks; other members' lists update on next load |
| P1-7 | P1 | push and WebSocket payloads | chat pushes carry no `message_id`; `announcement` WebSocket event is never emitted | V! | Push-versus-socket duplicates are healed by refetch; announcements arrive by push and list refetch |
| P1-8 | P1 | `POST /face/punch` (punch-in, roles 2 and 3) | `img_url` is undefined at the notification call, so the response is `success:false` after the punch row was committed | V | Client re-reads today's attendance after a failed forced punch and shows success only if the punch was recorded |
| P1-9 | P1 | delete endpoints (branch, payslip template, company, account, department, announcement, lead) | unscoped delete, dangling and orphaned rows | V | Client confirms and surfaces failures; cannot repair orphans |
| P1-10 | P1 | `/home/staff-detail`, `/home/staff-profile`, live-status lists | active staff only; 404 wrapped as 500; lists lack `role_id`, `is_active`, photo | V and L | Roster merges with `/home/all-staff`; inactive rows show a friendly message |
| P1-11 | P1 | `/api/leads/*` | duplicate rows per lead, assignment update hits all rows, carry-forward request does not persist status | V | Client merges duplicates, joins `/carry-forward/my`; admin "Carry Fwd" count stays about 0 |
| P1-12 | P1 | `POST /expenses/admin/allowance-rate` and approval stamping | rate save overwrites every reading (including approved), is lost for orgs with no readings | V | Amounts use the current org rate for every row |
| P1-13 | P1 | `POST /payments/verify`, `GET /plans/subscription/{org}` | same-plan renew adds staff and keeps `end_date`; null-state placeholder | V | UI still promises "+12 months" for renewals; state is derived heuristically |
| P1-14 | P1 | `POST /auth/verify-device-token` | never sends `request_pending`; auto-submits a device-change request; copy differs from the v1 flow | V | "Pending..." state can never appear (see DD-31) |
| P1-15 | P1 | `POST /requests/update-status` | leave never updates `requests.status`; date-less leave returns success after updating nothing; `role_id`/`action_by` unchecked | V | One call per date for leave; failures surfaced |
| P1-16 | P1 | `GET /api/salary/preview/{org}/{staff}/{payslip}` | always the current month | L | Sheet header shows the month the response carries |
| P1-17 | P1 | manager scoping | most endpoints ignore manager scope; branch/staff endpoints 404 for a manager's own id | L | Screens send the manager's own user id as the scope (a fragile v1 convention) |
| P2-1 | P2 | all routers | inner `HTTPException`s are re-raised as HTTP 500 (about 90 `status_code=500` handlers) | V | API client unwraps `"403: msg"` style details |
| P2-2 | P2 | `GET /chat/list`, `GET /group-chat/list` | plan block arrives as 500 | V | Client unwraps it to a 403 |
| P2-3 | P2 | `POST /auth/register` | duplicate user (400) becomes 500 "Registration failed" | V | Generic failure text |
| P2-4 | P2 | `rate: int` on allowance rate | decimal rates give 422 | V | Client rounds to whole rupees and says so |
| P2-5 | P2 | date and time fields | `attendance_date`, location and plan checks use the UTC or server date, clocks in UTC | V | Client uses IST everywhere; 00:00 to 05:30 IST punches sit on the previous server date |
| P2-6 | P2 | envelopes | bare arrays, `{success,data}`, `{message}` only, HTTP 200 with `success:false` | V | Per-endpoint mappers |
| P2-7 | P2 | validation and rate limits | duplicates, bounds, resend limits, overlaps are client-side only | V and L | Client validates what it can |
| P2-8 | P2 | `GET /requests/admin/{org}` | whole inbox polled every 10 s; no counts endpoint | V | Polling only while a request screen is focused |
| P2-9 | P2 | N+1 endpoints | per-staff attendance, per-staff shift lookup, all-staff punch locations | V and L | Batches of 5 with progress |
| P2-10 | P2 | server-originated text | OTP messages, e-mails, invoices and a WhatsApp template still carry the v1 brand | V | Users see v1 branding in those messages |
| P2-11 | P2 | staff limit | enforced only when an active subscription exists; trial orgs unlimited | V! | Client banner reads the raw `staff_limit` |
| P2-12 | P2 | `POST /support/submit` | photo upload is best-effort and silently dropped | L | Ticket created without photo |
| P2-13 | P2 | `DELETE /chat/delete/{me}/{other}` | per-side or both-sides unknown | L | Copy says "This cannot be undone" |
| P2-14 | P2 | web reverse geocoding | public OSM Nominatim from the browser | L | Best effort, 8 s timeout |
| P2-15 | P2 | repository hygiene | duplicate routers, schema drift, runtime `CREATE TABLE` | V | none |
| P3-1 | P3 | every endpoint | no authentication or authorisation | V | ids in the URL are trusted |
| P3-2 | P3 | `POST /orders/create` | trusts the client amount | V | Client price is the only price |
| P3-3 | P3 | `POST /face/punch` | `force_accept` from the client skips face verification | V | Client uses it as the v1 fallback |
| P3-4 | P3 | `POST /requests/device-change/submit` | unauthenticated, unvalidated, unlimited | V | none |
| P3-5 | P3 | `GET /auth/check-mobile`, `check-email` | require an operator header the app never sends | V | Duplicate pre-check never flags |
| P3-6 | P3 | PII endpoints | Aadhaar, PAN, bank details and mobile numbers readable by id | V | none |
| P3-7 | P3 | sign-out | push token and device token are not revoked | V | Previous user keeps receiving pushes |
| P3-8 | P3 | photos | no delete endpoints; anyone can overwrite any profile photo | V | Remove only clears the local selection |
| P3-9 | P3 | destructive endpoints | account/company delete, log cleanup, permanent staff delete callable by anyone | V | none |
| P3-10 | P3 | logging and debug endpoints | device tokens logged; push-token debug endpoint | V | none |
| P3-11 | P3 | CORS and transport | wildcard origin for the web build | V | none |
| P3-12 | P3 | `/invoice/*` | unauthenticated, keyed by guessable ids | V and L | none |
| P3-13 | P3 | `/api/reports/*` PDFs | no auth; manager "All Staff" PDF is org-wide | L | none |
| P3-14 | P3 | `DELETE /addstaff/{id}/permanent`, `PUT /addstaff/{id}/status` | role check uses a client-supplied id | V | Client also gates on the session role |
| C-1 to C-11 | Config | owner-supplied values | see section 6 | | |

---

## 2. P0 — blockers

Reference implementation of every P0 response shape: `e2e/mock-server/routes/payroll.js:112-165` (P0-1 to P0-3), `e2e/mock-server/routes/org.js:305-320` (P0-7) and `:376-380` (P0-4), `e2e/mock-server/routes/reports.js:65-100` (P0-5, P0-6).

### P0-1 Daily wages templates `[V]`
- **Endpoints:** `GET /api/daily-wages/templates/{org_id}`, `POST /api/daily-wages/template`, `PUT /api/daily-wages/template/{id}`, `DELETE /api/daily-wages/template/{id}`.
- **Current behaviour:** not mounted. `router/daily_hourly.py` is mislabelled: it declares `APIRouter(prefix="/api/holidays")` and contains a copy of the holiday routes (`router/daily_hourly.py:8-60`). The logic exists but nothing exposes it: `core_functions/daily_hourly_functions.py` (`get_templates_by_org` with `temp_type` `'D'`/`'H'`, `create_template`, `update_template`, `delete_template`, `get_template_by_id`, `get_assigned_staff`, `get_unassigned_staff`, `assign_staff_to_wage`, `unassign_staff_from_wage`) and the tables `daily_hourly_wages` and `assigned_wages` are in the schema dump.
- **Needed:** mount a router over those functions. Envelope the app expects: `{success:true, data:[{id|temp_id, template_name|temp_name, amount|temp_amount, assigned_count}]}` for the list; `{success:true}` for writes; `POST` body `{org_id, amount}`, `PUT` body `{org_id, amount}`; errors as `{detail}`.
- **App impact:** Daily Wages screen (route `/admin/payroll/daily-wages`, B6). App code: `src/api/payroll.ts:348-370`.
- **Source:** `docs/changes/F2b2.md`, `B6.md`; v1 notes section 2.
- **Until it ships:** list loads fail into an error state with Retry.
- **Owner note:** "Re-create the daily-wages router over `daily_hourly_functions.py` with `temp_type='D'`. The existing file of that name is a holiday copy and should be replaced (see P1-5). Make delete remove the template's per-user copy rows and assignments (see P1-9)."

### P0-2 Hourly charges templates `[V]`
- **Endpoints:** `GET /api/hourly-charges/templates/{org_id}`, `POST /api/hourly-charges/template`, `PUT` and `DELETE /api/hourly-charges/template/{id}`.
- **Current behaviour:** not mounted; same functions with `temp_type='H'`.
- **Needed / impact / source:** as P0-1 (screen `/admin/payroll/hourly`, B6; `src/api/payroll.ts:348-370`).
- **Until it ships:** as P0-1.
- **Owner note:** same router, second `temp_type`.

### P0-3 Wage staff assignment `[V]`
- **Endpoints:** `GET /api/wages/assigned/{org}/{template}`, `GET /api/wages/unassigned/{org}/{template}`, `POST /api/wages/assign` (`{org_id, user_ids, temp_id}`), `DELETE /api/wages/unassign/{org}/{user}/{template}`.
- **Current behaviour:** not mounted; `assign_staff_to_wage` and `unassign_staff_from_wage` exist in `core_functions/daily_hourly_functions.py:167` and `:207`.
- **Needed:** expose them. Rows: `{user_id, name, emp_id, branch_name, dept_name}`. Optionally return the template a staff member is currently on (see DD-76).
- **App impact:** Assign dialogs of Daily Wages and Hourly Charges (B6). App code: `src/api/payroll.ts:373-392`.
- **Until it ships:** dialogs show an error state with Retry; assign and remove fail with the server message.
- **Owner note:** "Staff move off their other template of the same type on assign (existing rule); return that in the response if you can."

### P0-4 Attendance rule `[V]`
- **Endpoints:** `GET /api/attendance-rule/{org}`, `POST /api/attendance-rule/{org}`.
- **Current behaviour:** no route, no table (the schema dump has no attendance-rule table; a repository-wide search for it finds nothing).
- **Needed:** store and return `{success, data:{late_punch_in_count:int 1..10, consider_as:'Half Day'|'Leave'}}` (the app also tolerates the bare object); accept the same body on POST. **Enforce it** in attendance and salary computation, otherwise the screen is cosmetic.
- **App impact:** Attendance Rule screen (`/admin/attendance-rule`, B4). App code: `src/api/system.ts:189-205`.
- **Until it ships:** defaults 3 and Half Day with an inline notice; save fails.
- **Owner note:** "Needs a table keyed by org, the two endpoints, and a decision where the rule applies (monthly attendance, salary breakdown). Product to confirm the rule semantics (see DD-60)."

### P0-5 Overtime report `[V]`
- **Endpoint:** `GET /api/incentive/overtime-report/{org}?month&year`.
- **Current behaviour:** not mounted (`router/incentive.py` has CRUD and assignment only).
- **Needed:** `{success, data:[{user_id, ot_days, ot_minutes, ot_amount}]}`.
- **App impact:** Overtime report (`/admin/reports/overtime`, B7). App code: `src/api/reports.ts:88-93`.
- **Until it ships:** every staff row shows "—" and a visible warning banner (the call failing is surfaced, not hidden).
- **Owner note:** "Compute from punch-out beyond shift end against the overtime template assigned to each staff member."

### P0-6 Salary paid state `[V]`
- **Endpoints:** `GET /salary/monthly-list?org_id&month&year`, `POST /salary/mark-paid` (`{org_id, user_ids, month, year}`).
- **Current behaviour:** not mounted; the schema dump has no table recording a paid salary (`payroll` links a staff member to a payslip template only).
- **Needed:** persist paid state per staff, month and year and return `{success, data:[{user_id, name, emp_id, dept_name, branch_name, salary_type, basic_salary, net_salary, paid:boolean, paid_date}]}`; `mark-paid` accepts several user ids and is idempotent.
- **App impact:** Monthly Salary (`/admin/payroll/monthly-salary`, B7). App code: `src/api/salaryReports.ts:108-125`.
- **Until it ships:** paid marks live in memory per period and are lost on reopen; "Total Amt / Unpaid Amt" use the salary breakdown; Pay buttons fail with the server error.
- **Owner note:** "Add a `salary_payments` style table (org, user, month, year, paid_at, paid_by). Return `net_salary` so the app does not need the breakdown call."

### P0-7 Shift staff assignment `[V]`
- **Endpoints:** `GET /shift/assigned_staff/{org}/{shift}`, `GET /shift/unassigned_staff/{org}/{shift}`, `POST /shift/assign_staff` (`{org_id, user_ids, shift_id}`), `DELETE /shift/unassign_staff/{org}/{user}/{shift}`.
- **Current behaviour:** not mounted (`router/shift.py` has create, get, update, delete only; `core_functions/shift_functions.py` has no assignment function). The assignment is `users_additional_info.shift_id`.
- **Needed:** list rows `{user_id, name, emp_id}` inside `{success, data}`; assign sets `shift_id`; unassign clears it.
- **App impact:** Shift Settings assign sheet (`/admin/shifts`, B4); also the Employee Shift report counts. App code: `src/api/shifts.ts:55-85`.
- **Until it ships:** the sheet explains the feature is unavailable; shift CRUD itself works.
- **Owner note:** "Assigning must also keep the 18-hour rule and refresh the staff-detail `shift_id`."

### P0-8 App version control for the new app `[V]`
- **Endpoint:** `GET /version/check?platform&version` (`router/version.py:8-45`).
- **Current behaviour:** reads one row per `platform` from `app_version_control` (a table that is not in the schema dump), shared by every app that calls it. The app sends `platform` (`android` or `ios`) and its own version (`1.0.0`, `src/lib/platform/appUpdate.ts:23-37`). If the row holds the v1 numbers (the v1 notes name 1.0.34), Clockyn 1.0.0 is "older than latest" and probably "older than `min_supported`", so it shows a **forced update** pointing at the v1 `store_url`.
- **Needed:** distinguish the new app (an `app_id` or bundle-id query parameter, or a separate table), and set `latest_version`, `min_supported` and `store_url` for the Clockyn listing.
- **App impact:** the soft/force update modal in the shell (`src/components/layout/bootstrap/UpdatePrompt.tsx`).
- **Until it ships:** the prompt follows whatever the row says; web is not checked.
- **Owner note:** "Check the deployed row now. Before the first store release, either add an `app_id` column or keep Clockyn's version numbers above the stored `min_supported`. The client can send a bundle id the moment you name the parameter."

### P0-9 Push delivery credentials for the new Firebase project `[V]`
- **Where:** `core_functions/auth_function.py:61-100` (`get_fcm_access_token`) uses a single service account taken from `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, `FCM_PRIVATE_KEY_ID`, `FCM_CLIENT_ID` (or a JSON file path); `router/chat.py:28-72` and `core_functions/auth_function.py:204` send through it.
- **Current behaviour:** an FCM token issued by the new app's Firebase project cannot be used with the old project's credentials, so every push to Clockyn would fail (warning only, nothing breaks).
- **Needed:** use the new project's service account, or support both projects during migration (store which project issued each token, or send to both). Keep the Android channel id `attendance_notifications` (the app creates it, `app.config.ts` sets it as the FCM default).
- **App impact:** chat, announcement, request and punch notifications (shell: `src/components/layout/bootstrap/usePushRegistration.ts`).
- **Until it ships:** no push; badges still update through the global socket while the app is open.
- **Owner note:** "Create the Firebase project for the new bundle id (see C-2), upload the iOS APNs key there, then change the five `FCM_*` variables. Plan a cut-over or dual-send if v1 and Clockyn run side by side on the same backend."

---

## 3. P1 — correctness

### P1-1 Employee requests lack per-date status and shift ids `[V]`
- **Endpoint:** `GET /requests/employee/{user}/{org}` (`core_functions/requests_functions.py:271-312`).
- **Current behaviour:** returns `dates` but no `date_statuses`, and only `requested_shift_timing` (no `requested_shift_id`, no `current_shift_id`). The admin endpoint does return them (`:340-402`). Because `update_request_status` never writes `requests.status` for **leave** (P1-15), the request-level `status` of a leave request stays `pending` after the admin decides.
- **Needed:** add `date_statuses` (same shape as the admin endpoint), `requested_shift_id`, `current_shift_id` (the app reads `new_shift_id` in v1 terms), and keep a meaningful request-level status for leave.
- **App impact:** Employee home request badge (B11), requests hub badge (B12), shift timeline in the attendance calendar (B11). App code: `src/api/requests.ts:86-100`, `src/features/requests/staff/utils/requestRules.ts`.
- **Until it ships:** the badge uses `date_statuses` when present, else request status; for leave it consults `GET /requests/calendar/{user}/{org}`. Shift timeline before the first change uses the current shift.
- **Owner note:** "Reuse the admin query's date join. This fixes the always-pending leave badge."

### P1-2 `branch_id` missing on staff detail endpoints `[V]`
- **Endpoints:** `GET /addstaff/{id}` (`core_functions/add_staff_function.py:464-500`), `GET /home/staff-profile` (`core_functions/home_functions.py:1151-1229`), `GET /home/staff-detail` (`:1095-1149`).
- **Current behaviour:** only `branch_name`; none selects `u.branch_id`.
- **Needed:** add `branch_id` (and `branch_address` where missing).
- **App impact:** edit-staff pre-selection and any geofence preload by branch id (B3b, B11).
- **Until it ships:** branch is matched by name; the punch flow uses `POST /face/check-location`, which resolves the branch itself.
- **Owner note:** "Additive field, no client change needed once present."

### P1-3 `GET /home/monthly-attendance` is too thin `[V]`
- **Where:** `core_functions/attendance_functions.py:154-247`.
- **Current behaviour:** per day it returns date, status (`late` if `punch_in.time() > shift start`, else `present`), punch times, `total_hours` (decimal string), photos, location. No `shift_start_time` or `shift_end_time`, no holiday, weekly-off or leave day types; days without a row are simply missing. `absent_days = days in month - rows` counts future days and weekly offs. Any exception returns an **empty month with HTTP 200** (`:241-251`). The late test compares a stored UTC timestamp's `.time()` with a local shift time and should be re-checked for the 5 h 30 m offset `[unverified]`.
- **Needed:** add `shift_start_time` and `shift_end_time` per day (or `late_by_minutes`), a `type` (`working`, `holiday`, `weekly_off`, `leave`), consistent decimal hours, correct absent counting, and a real error status.
- **App impact:** Late report "Late By" and shift columns (B7), attendance calendar half-day rule and weekly offs (B11), staff detail calendar (B3a).
- **Until it ships:** Late report shows "—" and a note when shift times are missing, and lists only server-flagged `late` days; calendars infer late, half, leave and absent on the client and model Sunday only.
- **Owner note:** "Compute day types once, server-side; the app then drops its inference."

### P1-4 Staff update demotes managers `[V]`
- **Endpoint:** `PUT /addstaff/{id}` (`core_functions/add_staff_function.py:578-585`: `role_id = %s` is set to the literal `3`).
- **Current behaviour:** editing a manager through the staff form silently turns the manager into staff. The roster has a "Manager" chip and the detail screen allows Edit for them (same as v1).
- **Needed:** keep the stored `role_id` (and `parent_id`) on update.
- **App impact:** staff edit (`/admin/staff/edit`, B3b). Product call in DD-53 (hide Edit for role 2 instead).
- **Until it ships:** the demotion happens on save.
- **Owner note:** "One-line change: do not touch `role_id` in the UPDATE."

### P1-5 Holiday routes and `block_attendance` `[V!]`
- **Where:** `app.py:48` mounts `router/daily_hourly.py` (a holiday router that **accepts** `block_attendance` on add and update, `router/daily_hourly.py:11-47`) before `router/holiday.py` (mounted at `app.py:65`; its models have **no** `block_attendance`, `router/holiday.py:11-19`). `router/report.py:25-47` declares a third copy (get, add, delete, working-days). Starlette serves the first match, so add, update, get and delete use the `daily_hourly.py` handlers, and only `off-days` come from `holiday.py`. The persistence code uses the column (`core_functions/holiday_functions.py:47-76,106-121,140-170`), but the schema dump has no `block_attendance` column on `org_holidays` and `migrations/` is empty.
- **Current behaviour:** QA matrix item ND1 ("the router drops `block_attendance`") is true for `holiday.py` but that file's holiday handlers are shadowed; whether the switch works depends on the deployed mount order and column. `check_holiday_block` uses the database `CURRENT_DATE` rather than the IST date (`:160`).
- **Needed:** keep one holiday router that declares `block_attendance`, add the column through a migration, return `{success, detail}` consistently, reject duplicate (date, name, scope), and ideally add a bulk endpoint.
- **App impact:** Holidays (`/admin/holidays`, B4). App code: `src/api/system.ts:111-175`. The client treats a missing or null flag as "blocking" and sends the flag on every write.
- **Until it ships:** "Punch Allowed" can be saved only if the deployed server accepts the field.
- **Owner note:** "Delete `router/daily_hourly.py` as it is (it becomes the wages router, P0-1) and `router/report.py`'s holiday copy; keep `holiday.py` and add the field there."

### P1-6 Group `read_update` payload and add-members event `[V]`
- **Where:** `router/chat.py:299-310` sends `{"type":"read_update","data":{"reader_id","group_id"}}` to every member including the reader.
- **Current behaviour:** the v1 client expected `message_id`, `read_count`, `total_members`. `GET /group-chat/messages` sets `total_members = active members - 1` (`core_functions/chat_functions.py:423-469`) and `read_count` = rows in `chat_activity` with `seen_at` set, so `read_count >= total_members` is the correct "everyone has read" test (this settles DD-80). `POST /group-chat/add-members` (`router/chat.py:314`) emits no event.
- **Needed:** add `message_id`, `read_count`, `total_members` to the group `read_update`; do not send it to the reader; emit `group_updated` (or `group_created`) to existing and new members on add.
- **App impact:** group ticks and member counts (B9a). App code: `src/features/chat/utils/frames.ts`.
- **Until it ships:** a payload without counts triggers a debounced history refetch; counts of other members update on next load.
- **Owner note:** "Include the numbers in the event; the client already handles both shapes."

### P1-7 Push and WebSocket payloads `[V!]`
- **Current behaviour:** announcement **push** already includes `announcement_id`, `org_id`, `target` (`core_functions/announcement_functions.py:104-118`), contrary to the B9b log. Gaps that remain: (a) `send_announcement` never publishes a WebSocket `announcement` event, although the app listens for one; (b) chat and group **pushes** carry `type` and sender, receiver or group ids but no `message_id` (`router/chat.py:198,286,411,478`), so a foreground push cannot be de-duplicated against the socket frame by id.
- **Needed:** include `message_id` in chat/group push data; publish `{type:'announcement', data:{announcement_id, target, org_id}}` on the user sockets of the recipients.
- **App impact:** unread badges for Chat and announcements (B9b, shell). App code: `src/lib/realtime/events.ts`.
- **Until it ships:** counts are recomputed from the list after every fetch (heals double counts); announcements badge updates from the push and the next refetch.
- **Owner note:** "Both are additive fields or events."

### P1-8 Staff punch-in returns `success:false` after committing `[V]`
- **Where:** `core_functions/face_attendance_functions.py:255-266`: for roles 2 and 3 the punch-in notification passes `image_url=img_url`, a name that is never assigned in that function (the only other uses are `punch_out_img_url`, `:347`, `:360`). The `INSERT ... RETURNING` and `conn.commit()` happened at `:227-231`, so the punch row exists, but the inner handler returns `{"success": false, "message": "Database error: name 'img_url' is not defined"}` (`:375-380`). By code reading; **confirm at runtime**, the deployed server may already be patched.
- **Needed:** define `img_url` (or pass `None`) and move the notification after the response is built.
- **App impact:** the primary punch flow (`/staff/home`, B11). The app retries a failed punch once with `force_accept` (v1 behaviour); the second call then answers "Already punched in", so the client re-reads `GET /attendance/today/{user}` and shows success only when the punch was recorded (`src/features/employee/components/FaceRecognitionModal.tsx`).
- **Until it ships:** the workaround above; the user sees "Sent for admin review" copy only when the server really recorded the punch.
- **Owner note:** "Highest-severity P1: fix and add a regression test for the notification branch."

### P1-9 Delete semantics `[V]`
- **Branch:** `core_functions/branch_functions.py:208-248` counts only active staff (`status = 1`) and then runs `DELETE FROM branch_info WHERE branch_id = %s` **without `org_id`**; ids are allocated per organisation in `add_staff_function.py:342,545` and globally in `branch_functions.py:83`, so equal ids can exist in several organisations. Inactive staff keep a dangling `branch_id`.
- **Payslip template:** `core_functions/salary_structure.py:286-331` deletes earnings, deductions and the template but leaves `payroll` rows (assignments).
- **Company:** `core_functions/company_functions.py:175-210` deletes users, branches, departments, shifts but not attendance, payroll, requests, leads rows of those users.
- **Account:** `delete_user_account` (`:408-470`) for an employee or manager id removes only that user's rows (it iterates organisations owned by the id, so an employee cannot remove the organisation) and leaves their attendance and request rows.
- **Department:** `core_functions/dept_functions.py:132` un-assigns staff silently (`dept_id = NULL`).
- **Announcement and lead:** `DELETE /api/announcements/{id}`, `DELETE /api/leads/{id}` check nothing about the caller or organisation.
- **Needed:** scope every delete by organisation, refuse or cascade when children exist, soft-delete or cascade user data, and null out inactive staff on branch delete.
- **App impact:** branch delete and reassign (B3b), payslip delete (B6), company delete (B4), delete my account (B5, B11), announcements (B9b), leads (B10). The app confirms first and surfaces failures; it cannot clean orphans.
- **Until it ships:** orphaned assignments and numbering gaps (daily/hourly numbering skips deleted numbers).
- **Owner note:** "Branch delete without `org_id` is the one to fix first."

### P1-10 Staff detail and live-status endpoints `[V and L]`
- **Current behaviour `[V]`:** `/home/staff-detail` and `/home/staff-profile` return 404 for inactive staff, and `get_staff_profile` wraps its own 404 as HTTP 500 `"Failed to get staff profile: 404: ..."` (`core_functions/home_functions.py:1112,1172,1224-1225`). `[L]`: `/home/{absent,late-punched-in,punched-in,working,punched-out}-staff` return no `role_id`, no real `is_active`, no photo.
- **Needed:** return inactive staff (with a flag) or a real 404; add `role_id`, `is_active`, photo to the live lists; honour a `staff_id` filter on `GET /home/staff-punch-locations`.
- **App impact:** roster chips and rows (B3a), employee details report (B7).
- **Until it ships:** the roster merges live lists with `/home/all-staff`; inactive staff show a friendly message.
- **Owner note:** "Removes the client-side merge and the all-staff pin download."

### P1-11 Leads `[V]`
- **Current behaviour:** `GET /api/leads/{org}` is `SELECT DISTINCT` per lead x assignment (`core_functions/leads_functions.py:53`); `PUT /api/leads/assignment/{id}` updates all assignment rows of the lead (`:218-225`); `POST /api/leads/carry-forward/request` writes only `description` and `request_date` on the assignment, never the status (`:268-310`); approved carry-forward requests stay listed forever; `CREATE TABLE IF NOT EXISTS` runs inside request handlers (`:274`). `[L]`: no duplicate-assign guard; `branch_id` typed int while v1 sent `""`.
- **Needed:** one row per lead with aggregated assignees; update one assignment; persist `carry_forward` (restore on reject) or return `has_pending_cfr`; upsert on assign; move DDL to a migration.
- **App impact:** CRM hub counts, assign and My Leads (B10). The leads table keeps the customer **required** date in the column named `created_date` (naming only).
- **Until it ships:** the app merges duplicate rows, picks the pending-or-newest request, and joins `/carry-forward/my`; the admin "Carry Fwd" count is about 0 (see DD-94).
- **Owner note:** "Carry-forward lifecycle needs a product answer first (DD-94)."

### P1-12 Odometer allowance rate storage and stamping `[V!]`
- **Where:** `core_functions/emp_expenses_functions.py:425-500`. Approval **does** stamp the current rate onto the reading (`:429-446`) and the admin list returns `allowance_rate` per reading (`:383`), but `save_allowance_rate` runs `UPDATE odometer_readings SET allowance_rate = %s WHERE org_id = %s` for **every** reading, ignoring its own "don't have one yet" comment (`:477-483`). A rate change therefore re-stamps approved rows, and an org with no readings persists nothing while the API answers success; `GET` reads the rate of the latest reading.
- **Needed:** store the org rate in its own table; on save update only pending readings (or none), keep stamped rates of approved rows, and return the stamp.
- **App impact:** Odometer allowance (`/admin/expenses/odometer`, B8). The app maps `allowance_rate` (`src/api/mappers/expenses.ts:49`) but still prices every row at the current org rate (`src/features/expenses/admin/utils/odometerMath.ts`), see DD-92.
- **Until it ships:** a rate edit re-prices every row, including approved ones.
- **Owner note:** "Once stamps survive, the app can show approved rows at their frozen rate (small client change)."

### P1-13 Renew semantics and subscription state `[V]`
- **Where:** `core_functions/gen_payment_functions.py:69-92`: an active plan with the **same `plan_id`** is treated as a staff top-up (`staff_limit` added, `end_date` kept). `GET /plans/subscription/{org}` returns a placeholder `data` object without the paid-plan fields when no subscription row exists (`core_functions/gen_plans_functions.py:27-88`): trial flags only inside `data`, `staff_limit: null`, `plan_name` "Free Trial" or null.
- **Needed:** an explicit renew intent (flag or endpoint) that extends `end_date`; an explicit state field (`paid_active`, `paid_expired`, `trial`, `none`) and the trial staff limit.
- **App impact:** Renew in Subscription and Upgrade (B5): the UI promises "Valid till +12 months" (see DD-16). The app derives state heuristically (`src/features/billing/utils/planState.ts`).
- **Until it ships:** a renewal with the same plan adds capacity and does not extend validity.
- **Owner note:** "Decide first whether renew means extend (DD-16), then add the flag; the client already sends the current plan id."

### P1-14 Device-mismatch contract `[V]`
- **Where:** `core_functions/auth_function.py:772-900`. On a mismatch the server auto-submits a device-change request (`:882-883`) and answers `device_mismatch:true` without `request_pending`; its message says to "log in again with OTP to take over", while the v1 flow (kept in the app) allows only "Request Access". `device_change_approved`, `session_expired`, `deleted`, `inactive` flags are sent.
- **Needed:** send `request_pending` when a pending request exists; confirm the intended take-over semantics (DD-31).
- **App impact:** staff login (`/staff-login`, B1). App code: `src/features/auth/utils/loginMachine.ts`.
- **Until it ships:** the "Pending..." state never appears; the user can press Request Access again (the server now creates another request).
- **Owner note:** "Also dedupe device-change requests per user (P3-4)."

### P1-15 `POST /requests/update-status` `[V]`
- **Where:** `core_functions/requests_functions.py:429-499`.
- **Current behaviour:** for leave only `leave_dates` rows are updated (never `requests.status`); permission updates the request status only when all dates agree; a call **without** `leave_date` updates every date of the request (a usable bulk), but for a request without date rows it affects nothing and still answers success; `role_id` and `action_by` are accepted and ignored; device approval clears `device_token` **and** `push_token` of the requester (`:487-492`). Failures are HTTP 200 `{success:false, "Date not found"}`.
- **Needed:** validate the caller's role and organisation, update the leave request status, return `404` for a request without dates, and document the "all dates" call.
- **App impact:** admin leave, permission, shift and device lists (B8): leave decisions are one call per date today; the client could switch to the single all-dates call (`src/api/requests.ts:102-125`).
- **Until it ships:** partial failure is possible and reported as "Updated 2 of 3 dates".
- **Owner note:** "Confirm the all-dates call is intended, then the app can use it."

### P1-16 Payslip preview month `[L]`
- **Endpoint:** `GET /api/salary/preview/{org}/{staff}/{payslip}` always returns the current month.
- **Needed:** accept `month` and `year`.
- **App impact:** payslip sheet in the employee attendance calendar (B11).
- **Until it ships:** the header shows the month the response carries, not the picked month.

### P1-17 Manager scoping `[L]`
- **Current behaviour:** `get_manager_scope` narrows only some `/home/*` routes, `/requests/admin/{id}` and the manager report endpoints; the app sends the manager's own user id where an organisation id is expected, so branch delete, reassign and staff lists answer 404 `Branch not found or access denied` for managers (B3b, B3a). Reports are org-wide for managers (B7).
- **Needed:** derive the scope from the caller on the server (see P3-1) and apply it to staff, branch, department, report and salary endpoints.
- **App impact:** manager shortcuts into admin screens (B11, B3a, B3b, B7); see DD-50.
- **Until it ships:** managers see org-wide report data; branch delete does not work for them.

---

## 4. P2 — contract and consistency

### P2-1 Inner `HTTPException` wrapped as HTTP 500 `[V]`
- **Where:** about 90 handlers of the form `except Exception as e: raise HTTPException(500, str(e))`, for example `router/chat.py` (20 of them), `router/incentive.py` (25), `router/requests.py`, `router/support.py`; none has `except HTTPException: raise` (`router/chat.py:168-175`). `str()` of an `HTTPException` is `"<status>: <detail>"`.
- **Needed:** re-raise `HTTPException` untouched; reserve 500 for real server faults.
- **App impact:** every error message path; the API client already unwraps `"403: msg"` into status 403 (`src/lib/api/errors.ts`, `wrapped` flag), so the app does not depend on this fix.
- **Until it ships:** unwrapping heuristic.

### P2-2 Plan-block as a real 403 `[V]`
- **Where:** `GET /chat/list/{user}` and `GET /group-chat/list/{user}` call `check_plan_feature` inside the `try` (`router/chat.py:168-175`, `:226-232`), so the 403 becomes 500. `check_plan_feature` itself (`core_functions/gen_plans_functions.py:174-196`) raises 403 correctly and its docstring is stale (it lists chat, salary and camera punch as blocked for Core; the matrix `PLAN_BLOCKED_FEATURES` blocks only `staff_location` and `crm`, and everything when expired).
- **Needed:** move the check out of the `try`; fix the docstring.
- **App impact:** chat hubs, CRM screens (B9a, B9b, B10); the client unwraps it.

### P2-3 Registration errors `[V]`
- **Where:** `core_functions/auth_function.py:376-379` raises 400 "User already registered" inside a `try` whose handler turns everything into `HTTPException(500, "Registration failed")` (`:473-478`).
- **Needed:** `except HTTPException: raise` so the real reason reaches the user.
- **App impact:** Register (B1): the app shows the generic server text.

### P2-4 `int` allowance rate `[V]`
- **Where:** `router/emp_expenses.py:33-36` (`rate: int`), `core_functions/emp_expenses_functions.py:470`.
- **Needed:** accept decimals (a rate such as 3.5 per km is plausible) or document whole rupees.
- **App impact:** the editor rounds to whole rupees and shows "Saved as ₹4 per km (whole rupees only)" (B8, `src/features/expenses/admin/utils/odometerMath.ts`).

### P2-5 UTC versus IST fields `[V]`
- **Attendance date:** `attendance_date` is the **UTC** date (`core_functions/face_attendance_functions.py:180-181` and `:394` for `/attendance/today`), so a punch between 00:00 and 05:30 IST is stored under the previous date while `/home/*` dashboards use IST (`datetime.now(IST)`).
- **Location:** `/staff-location/*` default and "today" use `get_utc_now().date()` (`core_functions/staff_location_functions.py:56,106,184-186,262`); `punch_in` and `punch_out` are UTC clock strings; `location_updated_at` may carry no zone.
- **Other:** holiday block uses `CURRENT_DATE` (`core_functions/holiday_functions.py:160`), plan and trial checks use `date.today()` (`core_functions/gen_plans_functions.py:57,77,134,147`), shift-lateness compares UTC time with local shift time (P1-3).
- **Needed:** use IST business dates in all of these, always send timestamps with an offset, return IST clock strings (the app treats zone-less timestamps as UTC).
- **App impact:** staff location "today" and freshness (B8), attendance, plan expiry (B2, B5). The app sends IST dates and reads timestamps through `src/lib/datetime.ts`.
- **Until it ships:** wrong "today" between 00:00 and 05:30 IST for those endpoints.

### P2-6 Envelope inconsistencies `[V]`
- Bare arrays (`/home/*` lists, `/chat/*`, `/addstaff/branches`), `{success, data}` (shift, requests, expenses, leads, salary, announcements), `{message}` without `success` (branch routes), HTTP 200 with `{success:false, message}` for business failures (face punch, update-status, odometer, leads) and `detail` as a string or an object (`auth_function.py:138` sends a dict). `GET /api/salary/templates/{org}` returns a bare `[]` for an empty org (`[L]`, B6). `GET /attendance/sessions/{id}` answers 200 `{success:false, sessions:[]}` on a database error (`[L]`, B2).
- **Needed:** one envelope (`{success, data}` or plain data) and real error statuses.
- **App impact:** the app keeps one tolerant mapper per endpoint (`src/api/mappers/`, `src/lib/api/envelope.ts`).

### P2-7 Validation and rate limits `[V and L]`
- No length, range or format validation on most inputs (staff phone and e-mail, amounts, counts); duplicates (holiday date+name+scope, shift overlap beyond the 18 h rule, department and branch names, wage amounts, count values) are client-side only; manager assignments have no server overlap check; no OTP resend or send limits visible in the routes; support, suggestions, device-change and deletion requests are unlimited.
- **Needed:** server-side validation and a per-user/IP rate limit on OTP, support, suggestion and request endpoints.
- **App impact:** client validators exist (see `docs/FIXES_APPLIED.md`); server rules are the authority.

### P2-8 Admin requests inbox and counts `[V]`
- `GET /requests/admin/{org}` returns every request of every type and status and is polled every 10 s by each open admin request screen (`core_functions/requests_functions.py:340-402`).
- **Needed:** `GET /requests/admin/{org}/counts` and a working `status` filter and pagination.
- **App impact:** badges and the four lists (B8); performance only.

### P2-9 N+1 and bulk endpoints `[V and L]`
- Per-staff `GET /home/monthly-attendance` (batches of 5) and `GET /addstaff/{id}` for the shift id (reports, B7); `GET /home/staff-punch-locations` returns every staff member's pins (B3a); bonus assignment lookups; holiday adds are one request per date; leave decisions are one request per date (P1-15).
- **Needed:** bulk attendance or late-report endpoint, `shift_id` on the staff list, `staff_id` filter on punch locations, bulk holiday add.
- **App impact:** load time for large organisations.

### P2-10 Server-originated branding `[V]`
- OTP SMS and e-mail text, invoice PDF and e-mail, the WhatsApp invitation template (its name and the app link it embeds) and some notification titles still carry the v1 product name (found in `core_functions/auth_function.py`, `utils/email.py`, `core_functions/whatsapp_service.py` and others; 15 files in total, a few of them only comments or the schema dump).
- **Needed:** move the product name, links and template names to configuration and rebrand.
- **App impact:** users of the new app will see v1 branding in OTP and invoice messages.
- **Owner note:** "The WhatsApp template name is registered with the provider; plan the template approval lead time."

### P2-11 Staff limit enforcement `[V!]`
- **Where:** `core_functions/add_staff_function.py:292-312` rejects adds beyond `staff_limit` with 403 when an **active subscription** exists (contrary to the B3b log). Trial organisations have no subscription row and no limit; `/plans/subscription` returns `staff_limit: null` for them.
- **Needed:** decide the trial limit and enforce it; return it in the subscription payload.
- **App impact:** the Add Staff limit banner reads the raw field (missing means no banner).

### P2-12 Support ticket photo `[L]`
- `POST /support/submit` creates the ticket and answers `success:true` even if the photo upload failed (B5).
- **Needed:** report the photo failure. **App impact:** silent photo loss.

### P2-13 Chat delete semantics `[L]`
- `DELETE /chat/delete/{me}/{other}`: removes for one side or both is unknown; the app copy says "This cannot be undone" (B9a).
- **Needed:** confirm and document.

### P2-14 Web reverse geocoding `[L]`
- On the web the app calls the public OpenStreetMap Nominatim service from the browser for the branch address suggestion (`src/lib/platform/geocode.ts`, B3b), subject to its usage policy.
- **Needed:** an own geocoding proxy or key for production volume.

### P2-15 Repository hygiene `[V]`
- Duplicate routers on one prefix (P1-5); a router file whose name does not match its content (P0-1); schema dump older than the code; `migrations/` holds only a README; DDL executed inside request handlers (P1-11); the root `GET /` and `chat.py` at the repository root define unused routes (`POST /send`, `POST /upload`).
- **Needed:** one source of truth for schema (migrations), remove dead routers, add a route test that fails when a router file mounts the wrong prefix.

---

## 5. P3 — security and hardening

### P3-1 No authentication or authorisation `[V]`
- No route uses a dependency, bearer token, cookie or session check (searching `router/` for `Depends(`, `Authorization`, `x-admin-id` finds only the operator-header helper in `router/auth.py:148-170`, an outbound FCM header in `router/chat.py` and CORS header names in `app.py`). Identity is whatever id the client puts in the URL, query or body (`user_id`, `org_id`, `staff_id`, `created_by`, `action_by`, `role_id`). `role_id` is client-supplied on several writes.
- **Needed:** issue a token at login (the device-token and session machinery already exists), verify it on every route, derive `user_id`, `org_id` and role from it, and enforce roles and manager scope server-side.
- **App impact:** the HTTP client has one place to add the header (`src/lib/api/client.ts`); nothing else in the app changes.
- **App side: done (FE-4, WP12).** The app keeps the opaque `access_token` from `POST /auth/validate-otp`, `POST /auth/verify-device-token` (`skip_otp: true`) and `POST /auth/register` in the persisted session and sends `Authorization: Bearer <token>` on every non-public path (`?token=` on the WebSockets). A `401` on a protected path signs the user out once (toast "Your session expired. Please sign in again.", welcome screen, trusted-device token kept). It works against a server that issues no token (no header sent) and against `REQUIRE_AUTH=1`. Details: `docs/changes/security-token.md`.

### P3-2 Server-side price recompute for orders `[V]`
- `POST /orders/create` passes the client `amount` straight to the payment provider (the docstring says so, `core_functions/gen_orders_functions.py:12-18`); only `amount > 0` is checked.
- **Needed:** recompute from `plan_id`, `staff_limit`, `coupon_code` and the org's subscription (apply credit and GST), and ignore the client amount.
- **App impact:** none visible; the client price becomes display-only (B5). Razorpay amounts are rupees in the response and paise internally (`utils/razorpay.py:22`), matching the client's x100.

### P3-3 `force_accept` bypasses face verification `[V]`
- `core_functions/face_attendance_functions.py:132-136`: with `force_accept=true` the server skips matching and only sets `face_mismatch = true` for review. Any API caller can punch in as any user with a non-matching or empty photo. Geofence is **still enforced** for non-field staff when the branch has coordinates (`:166-178`, so the "advisory geofence" statement in the v1 notes does not hold on the server).
- **Needed:** honour the flag only for an admin-approved override (short-lived token) or after N failed matches; otherwise return a clear error code.
- **App impact:** face-punch fallback (B11, DD-01).

### P3-4 Device-change submit abuse `[V]`
- `POST /requests/device-change/submit` (`core_functions/requests_functions.py:129-167`) accepts any `user_id` and `org_id`, never validates the pair, never deduplicates and has no rate limit; each call notifies the admins.
- **Needed:** validate user and org, require a pending mismatch, reject duplicates, rate-limit.

### P3-5 `check-mobile` and `check-email` need an operator header `[V]`
- `router/auth.py:303-326` first runs the operator-check helper defined at `router/auth.py:148-170` (an `x-admin-id` header looked up in an internal operator table); the app never sends it, so both answer 403 and the duplicate pre-check on Register never flags a duplicate.
- **Needed:** allow unauthenticated use returning only `{exists}` (rate-limited), or drop the pre-check.
- **App impact:** Register (B1): duplicates are caught at Get OTP (400 "already registered") or at `/auth/register`.

### P3-6 PII exposure `[V]`
- Readable by id with no authentication: `GET /home/staff-profile` (Aadhaar, PAN, UAN, PF, ESI, bank details, DOB; `core_functions/home_functions.py:1161-1167`), `GET /addstaff/{id}` and `GET /addstaff/all-staff/{org}`, `GET /employee/personal-details/{id}`, `GET /auth/user-mobile/{id}`, `GET /auth/employee-profile/{id}`, `GET /invoice/*`, `GET /auth/push-token-status/{id}` (token preview).
- **Needed:** authorisation per route and field-level minimisation (the staff list does not need government ids).
- **App impact:** exported employee profile PDFs and DOCs contain these fields and persist in the app's saved-files folder until deleted (B7; see DD-64).

### P3-7 Token revocation at sign-out `[V]`
- There is no logout endpoint: sign-out leaves `users.push_token` and `device_token` in place, so the previous user keeps receiving pushes on that device until the token is overwritten. `POST /auth/update-push-token` rejects an empty token (`core_functions/auth_function.py:136-138`) so the client cannot clear it. Device-change approval clears both tokens (`core_functions/requests_functions.py:492-498`).
- **Needed:** `POST /auth/logout {user_id, device_token}` that clears the push token (and optionally the device token) of that session.
- **App impact:** sign-out in shell and Settings (F3b, B1; DD-34). The app calls nothing today.
- **App side: done (FE-4, WP12).** An explicit sign-out calls `POST /auth/logout {user_id, device_token?, push_token?}` best-effort (2.5 s timeout, errors ignored, never blocks the sign-out) BEFORE the local session is cleared, so the bearer token is still attached. It is not called after a forced / expired / deleted sign-out. The mock server implements the endpoint (`e2e/mock-server/routes/auth.js`).

### P3-8 Photos `[V]`
- No delete endpoint for the profile photo, company logo or expense photos (`router/profile_photo.py` has GET and POST only), so Remove in the staff form and company logo only clears the local selection (B3b, B4); `POST /profile-photo/{user_id}` and the upload routes let anyone overwrite any user's photo.
- **Needed:** `DELETE` endpoints, authorisation, and a size and type limit on uploads.

### P3-9 Destructive endpoints without authentication `[V]`
- `DELETE /company/delete-account/{user_id}` (deletes an account and, for an admin, every organisation and staff record they own, `core_functions/company_functions.py:408-470`), `DELETE /company/delete/{org}/{user}`, `DELETE /staff-location/cleanup` (`router/staff_location.py:40`), `DELETE /addstaff/{id}` and `/permanent`, `DELETE /api/announcements/{id}`, `DELETE /api/leads/{id}`.
- The operator console routes on the same backend (`/gen-dashboard/*`, `router/gen_dashboard.py`) are also open: they list every organisation and user and can delete, activate or deactivate organisations, identified only by a `phone_number` query parameter. Clockyn does not call them; they widen the blast radius of the same gap.
- **Needed:** authentication, ownership checks, and confirmation tokens for account and company deletion; operator routes behind the operator authentication.

### P3-10 Logging and debug endpoints `[V]`
- Device tokens (stored and provided) are logged at info level (`core_functions/auth_function.py:817-818`); `GET /auth/push-token-status/{id}` is a debug endpoint left in production; `app.py` debug paths.
- **Needed:** remove token logging and the debug endpoint.

### P3-11 CORS and transport `[V]`
- `app.py:20-34` answers every origin with `*`, all methods and headers. The web build of Clockyn makes browser calls from its own origin.
- **Needed:** once the web portal URL is known (C-8), restrict origins; keep HTTPS only.

### P3-12 Invoice endpoints `[V and L]`
- `GET /invoice/history`, `/download`, `/details`, `/bulk-download` (`utils/email.py:768-1096`, mounted by `app.py:63`) are keyed by `user_id`, `org_id`, `invoice_number` with no authentication (IDOR) and return 404 `{detail}` for unknown numbers.
- **Needed:** token or signed URL; stable field names.
- **App impact:** Invoices screen (B5); the download helper accepts headers once a token exists.

### P3-13 Report PDFs `[L]`
- `GET /api/reports/*monthly-attendance*` need no authentication; the manager "All Staff" endpoint merges every active manager and staff member of the organisation although the picker shows the team; the single-staff endpoint has no permission check (B7).
- **Needed:** authentication and scope.

### P3-14 Role checks that trust the client `[V]`
- `DELETE /addstaff/{id}/permanent` gates on `requested_by_role_id` from the query (`core_functions/add_staff_function.py:664-700`), `PUT /addstaff/{id}/status` has no check, announcements check `sent_by_id`'s role in the database (the only real server check, `core_functions/announcement_functions.py:32-38`).
- **Needed:** derive the role from the authenticated caller.
- **App impact:** the delete button is shown for role 1 only and the typed-name confirmation is client-side (B3a).

---

## 6. App-config items the product owner must supply

All variables are in `.env.example`; configuration is read only through `src/config/env.ts` and `app.config.ts`. Nothing below is a secret except the Firebase files, the maps key and signing credentials, which must never be committed (they are git-ignored).

| ID | Item | Variable / file | Used by | If missing |
|---|---|---|---|---|
| C-1 | Android package and iOS bundle id, and the store listings | `APP_ID` (default `com.clockyn.app`) | `app.config.ts`; must match the Firebase apps (C-2) and the store consoles | build uses the default id |
| C-2 | New Firebase project for the bundle id: Android `google-services.json`, iOS `GoogleService-Info.plist`, an APNs auth key uploaded to Firebase; plus the backend service account (P0-9) | `GOOGLE_SERVICES_JSON`, `GOOGLE_SERVICE_INFO_PLIST` | push registration and delivery | push is disabled gracefully; the app runs |
| C-3 | Native maps key for Android, restricted to the package name and signing certificate (SHA-1) | `GOOGLE_MAPS_API_KEY` | Android maps in branch picker, staff location (`app.config.ts` sets it for Android only; no iOS key is configured, and the web map is Leaflet and needs none) | Android map tiles do not render |
| C-4 | Expo project for builds and the signing credentials | `EAS_PROJECT_ID` | EAS build and updates | cannot run EAS builds |
| C-5 | Support e-mail | `EXPO_PUBLIC_SUPPORT_EMAIL` | iOS subscription note "contact support", help links | link hidden |
| C-6 | Sales e-mail | `EXPO_PUBLIC_SALES_EMAIL` | "Contact sales" for discounts in Payment Summary | link hidden |
| C-7 | Privacy policy URL, and a hosted account-deletion information page for the store data-safety forms | `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Settings, More Options, Privacy Policy (iframe on web, WebView on native) | "not configured" state; the deletion button stays available |
| C-8 | Web portal URL | `EXPO_PUBLIC_WEB_PORTAL_URL` | "Also available on web / manage billing" row on Android only | row hidden |
| C-9 | Store listing URLs | `EXPO_PUBLIC_ANDROID_STORE_URL`, `EXPO_PUBLIC_IOS_STORE_URL` | update prompt fallback when the version row has no `store_url`; the rate prompt | the rate prompt never shows; the update prompt relies on the backend URL (also see P0-8) |
| C-10 | Backend base URL | `EXPO_PUBLIC_API_BASE_URL` (required, no default since the old host was removed from the code) | all API and WebSocket traffic | must be set for every build; decide whether Clockyn shares the existing deployment (then P0-8 and P0-9 apply) |
| C-12 | Sign-in mode | backend env `USER_AUTH` = `otp` (default, mobile + SMS) or `email` (email + SES code, no SMS cost); with `email` also `EMAIL_USER` (SES-verified sender) and AWS credentials | login, registration and company edit screens (read from `GET /auth/config`) | `otp`; staff need an email on record to sign in under `email` |
| C-11 | Payment account and branding | held by the backend: the key id arrives in the `POST /orders/create` response (`core_functions/gen_orders_functions.py:114-141`) | checkout descriptor shows the organisation or app name | no app variable |

---

## 7. Cross-check of the v1 "absent routes" list against the snapshot

The v1 notes list routes as absent from the snapshot. Result of checking each one this review:

| Route in the v1 list | Snapshot status | Called by Clockyn? | Classified |
|---|---|---|---|
| `/api/daily-wages`, `/api/hourly-charges`, `/api/wages` | absent | yes | P0-1 to P0-3 |
| `/api/attendance-rule` | absent | yes | P0-4 |
| shift assign and unassign (4) | absent | yes | P0-7 |
| `/api/incentive/overtime-report` | absent | yes | P0-5 |
| `/salary/monthly-list`, `/salary/mark-paid` | absent | yes | P0-6 |
| `/auth/push-token/{id}` | absent | declared in `src/api/chat.ts:150` but **no screen calls it** (dead export; a search of `src/` finds no caller. `docs/qa/Q0-findings.md` recorded a request on every chat open from an earlier build, which is why `e2e/support/allowlist.json` still tolerates the 404) | none; remove the export or add the route later |
| `/api/holidays/working-days` | **present** (`router/holiday.py:57`, `router/daily_hourly.py:54`, `router/report.py:42`) | yes (reports) | none |
| `/api/company/details`, `/api/leads/{id}/request`, `/face/enroll`, `/payslip/template*` | absent | **no** (v1 dead or orphan calls, not ported) | none |
| `/invoice/history`, `/invoice/download` | **present** in `utils/email.py:863,921`, mounted at `app.py:63` | yes | none (security in P3-12) |
| `/auth/register` requires `gst_number` | **outdated**: `gst_number` defaults to `''` (`core_functions/auth_function.py:347`); the app also sends `org_gst` | yes | none |
| `/addstaff/{id}` returns no `branch_id` | confirmed | yes | P1-2 |
| `date_statuses` / `new_shift_id` missing on employee requests | confirmed | yes | P1-1 |
| plan-block 500 on chat lists | confirmed | yes | P2-2 |
| possible `img_url` punch bug | confirmed by code reading | yes | P1-8 |

Run `node e2e/mock-server/selfcheck.js` against the mock to see every endpoint family and shape the app depends on.
