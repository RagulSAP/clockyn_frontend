# Spec-conformance audit Q4a: entry/auth, admin dashboard + staff, org structure, company + team rules

Scope: spec folders `00_entry_auth`, `01_admin_dashboard_staff`, `02_admin_org_structure`, `03_admin_company_team_rules` (21 specs, 251 traced rows below; `add_department` is a dropped orphan).
Method: every acceptance bullet (section 14), rule/formula (section 7), copy item (section 8), flow (section 4) and fix/don't-port item (section 13) was traced to the implementing code; an automated copy diff (all backticked strings of every section 8 against the feature sources) was used for strings; contracts were cross-checked against the backend snapshot (backend repo, read-only) where a rule depends on it.

## Summary

| Result | Count |
|---|---|
| PASS | 207 |
| DEVIATION-OK (documented in a change log / FIX_POLICY, or a design-system equivalent; rows marked "PASS / DEVIATION-OK" are counted here) | 36 |
| GAP / BUG found and FIXED | 4 |
| NEEDS-DECISION (no behaviour change made; table below, 4 also flagged inline in the matrix) | 7 |

Fixed here: (1) holiday `block_attendance: null` was mapped to "Punch Allowed" (spec: only an explicit false allows punching); (2) the off-days summary lost the v1 em dash; (3) manager form multi-selects never read "All selected"; (4) a failed refresh of the branch list over a cached list was silent (spec: toast "Failed to load branches").
Verification after the fixes: `npx jest` for the six feature folders + `src/api/__tests__/supportSystem.test.ts` + `src/components/ui/__tests__/forms.test.tsx` all green; `npx eslint` clean for every touched/scoped path; `npm run check:routes` passes; `npx tsc --noEmit` has 0 errors in files of this scope (the project currently reports errors only in other engineers' in-progress files: billing / chat / payroll tests and `PayslipEditScreen.tsx`); `npm run check:brand` is clean for this scope (the only hits are inside another QA report, `docs/qa/Q4d-C.md`, not mine).

### Changes made (all additive and minimal)

| File | Change | Test |
|---|---|---|
| `src/api/system.ts` (`mapHoliday`) | `block_attendance` null/missing = blocking (true); only explicit false/0 = "Punch Allowed" | `src/api/__tests__/supportSystem.test.ts` (null, missing, 0) |
| `src/features/team-rules/utils/holidayLogic.ts` (`offDaysSummary`) | v1 copy `No off days — all days are working days` (em dash) | `utils/__tests__/holidayLogic.test.ts`, `__tests__/holidaysScreen.test.tsx` updated |
| `src/components/ui/MultiSelect.tsx` (shared, additive prop `allSelectedText`) | trigger text when every option is chosen; default behaviour unchanged | `src/components/ui/__tests__/forms.test.tsx` |
| `src/features/team-rules/screens/ManagerEditScreen.tsx` | passes `allSelectedText="All selected"` to both assign multi-selects | covered by the MultiSelect test + existing manager screen tests |
| `src/features/org-structure/screens/BranchListScreen.tsx` | toast `Failed to load branches` when a refresh fails while a list is already shown | `screens/__tests__/BranchListScreen.test.tsx` (new case) |

## Needs decision (no behaviour changed)

| # | Item | Evidence | Why it needs a decision |
|---|---|---|---|
| ND1 | Holiday "Block Attendance" switch has no effect on the server | backend `router/holiday.py`: `AddHolidayRequest` and `UpdateHolidayRequest` have no `block_attendance` field (the core functions accept it, but the router drops it), so every holiday is stored with the default `true`; the client sends it (`src/api/system.ts` `addHoliday`, `updateHoliday`) | Backend must accept the field (or product removes the switch). Until then "Punch Allowed" can never be saved. |
| ND2 | Editing a manager through the staff form silently demotes them to staff | backend `core_functions/add_staff_function.py` update path: `UPDATE users SET ... role_id = 3 ...` always; the roster chip "Manager" lists role 2 users and detail -> Edit is allowed for them (v1 same) | Either backend keeps `role_id`, or the client must hide/disable Edit for role 2 (product call: managers are edited in Manager Settings). |
| ND3 | Device mismatch semantics differ between spec and backend snapshot | Spec emp_login section 7: mismatch blocks OTP login, only "Request Access" (v1 rule, kept in `src/features/auth/utils/loginMachine.ts` `primaryAction`). Backend `core_functions/auth_function.py` `verify_device_token`: message says "log in again with OTP to take over the session", auto-submits a device-change request, and never returns `request_pending` | Decide: keep the block (then "Pending..." can never appear) or allow OTP take-over. |
| ND4 | Field-staff "Punch Anywhere / Punch at Branch" choice removed | Spec add_staff: modal + pill, acceptance bullet "Field Staff switch opens the Punch-In Options modal"; v1 never submitted it, backend `AddStaffRequest` has no such field; B3b did not port it (`docs/changes/B3b.md` Deferred) | Confirm it is dead (FIX_POLICY B7) or add a backend field. |
| ND5 | Backend endpoints missing in the snapshot | `/shift/assigned_staff`, `/shift/unassigned_staff`, `/shift/assign_staff`, `/shift/unassign_staff`, `/api/attendance-rule/{org}` have no route in backend `router/`; the screens show an explicit "not available on this server yet" / defaults notice (`docs/changes/B4.md` Backend needs) | Backend work; client already handles the 404. |
| ND6 | Overview "Total" bucket is date-aware | Spec overview 7.1: Total = all staff, not date dependent. Implementation (`useOverviewList`, `docs/changes/B2.md`) uses the daily-attendance report for the selected date + branch so the list matches the Total count (spec 13 lists the old behaviour as a defect) | Product confirms the fix (list == count). |
| ND7 | Add Manager requires >= 1 department | Spec add_manager sections 7 and 14 recommend it ("v2 should prevent this in the UI"), backend 400 "Department is required for each assignment"; "all departments" is sent as every department id (`managerAssign.ts`) | Later-created departments are not covered by an "all departments" assignment; backend semantics question. |

---

## 00_entry_auth

### index (welcome) -> `/`

| Bullet / rule | Status | Evidence |
|---|---|---|
| No stored auth: "Get Started", both portal cards, 4 feature labels, footer | PASS | `features/auth/screens/WelcomeScreen.tsx:32` (+ `AuthShell` `FEATURE_ITEMS`, `FOOTER_TEXT`) |
| Admin Portal / Employee Access push the matching login | PASS | `WelcomeScreen.tsx` `onPress={() => router.push(routes.adminLogin / staffLogin)}` |
| Stored role 1 -> admin home; role 2/3 -> staff home; unexpected role -> landing | PASS | `lib/routeGuard.ts` `resolveRootRedirect`, `hooks/useRootRedirect.ts`, `WelcomeScreen.tsx:17`; test `__tests__/screens.test.tsx` |
| Admin redirect params (orgId/org_name/user_id) | DEVIATION-OK | Derived from the reactive session (spec 13 "derive from session"); no route params |
| Session check (check-session) for role 2/3 with device token; offline = stay logged in | DEVIATION-OK | Owned by the shell: `components/layout/bootstrap/useSessionWatcher.ts`, `sessionWatch.ts` (reactive, fixes the redirect race of spec 4) |
| Push token refreshed on every cold start (all roles) | PASS | `components/layout/bootstrap/usePushRegistration.ts` (+ on foreground) |
| Hold until session read (no landing flash); forced-logout wipe keeps last-org | PASS | `WelcomeScreen.tsx` `if (!ready) return null`; `store/ui` sign-out notice shown once |
| Copy: title, subtitle, card texts, `or`, feature labels, footer | PASS | `WelcomeScreen.tsx`, `AuthShell.tsx` (brand name = Clockyn per rule E; tagline kept) |
| Hardware back exits (no handler) | PASS | none registered on the root route |

### admin_login -> `/admin-login`

| Bullet / rule | Status | Evidence |
|---|---|---|
| < 10 digits disables action; 10 digits dismisses keyboard and enables | PASS | `useLoginFlow.ts` `setMobile`; `loginMachine.ts` `isPrimaryDisabled` |
| No stored token: "Get OTP"; accepted token (`success && skip_otp`): "Continue" (no OTP); rejected / errored: "Get OTP" | PASS | `loginMachine.ts` `interpretDeviceVerify`, `primaryAction`; verify call `useLoginFlow.ts:69` (role_id 1) |
| Get OTP success: boxes + "OTP sent to {n}" + server message toast | PASS | `MobileOtpLoginForm.tsx:72`, `useLoginFlow.ts` `sendOtp` |
| Get OTP failure: server detail, else "Network error. Please try again." | PASS | `loginMachine.ts` `sendOtpErrorMessage` |
| "Verify & Continue" only at 6 digits | PASS | `MobileOtpLoginForm.tsx:38` `showButton` |
| Correct OTP existing admin: device token stored per mobile, session stored, home opens (replace) | PASS | `useLoginFlow.ts:111-160` (`setDeviceToken`, `signIn`, `router.goHome`) |
| Wrong OTP: boxes clear, "The OTP you entered is incorrect. Please try again." | DEVIATION-OK | Server `detail` first, v1 copy as fallback (FIX_POLICY B3; `loginMachine.ts:197`) |
| OTP valid for unregistered number: register with number + verified contact, no session | PASS | `useLoginFlow.ts:138`; device token read from storage instead of the URL (`docs/changes/B1.md`) |
| `last_org_{userId}` restored when the company still exists | PASS | `loginService.ts:40` `loginAndBuildSession` |
| Number of a role 2/3 user: "Access denied. Admin credentials required.", nothing persisted | PASS | `store/auth.ts` `sessionFromLogin` validates before `signIn` (B1 fix); test `loginService.test.ts` |
| Continue failure toast + button re-enables; `success:false` never leaves a spinner | PASS | `useLoginFlow.ts` `finally` -> `loginEnded` (B3 fix) |
| Back arrow / hardware back -> welcome (replace) | PASS | `hooks/useBackToWelcome.ts` |
| Notification permission denied does not block login | PASS | `softPushToken` (`prompt:false`, 2.5 s cap) |
| `LoginSuccess` event, push token before navigation, first-paint prefetch | PASS | `useLoginFlow.ts:152-155`, `loginService.ts:89` `warmHomeQueries` (fire-and-forget, IST date) |
| Copy: badge, Welcome Back, label, placeholder, buttons, trust row, footer | PASS | `MobileOtpLoginForm.tsx`, `AuthShell.tsx` |

### emp_login -> `/staff-login`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Get OTP / Continue / device token persisted in the session | PASS | `useLoginFlow.ts` (portal `staff`), `store/auth.ts` `sessionFromLogin` (`deviceToken`) |
| `device_change_approved`: stored token removed, "Get OTP" | PASS | `loginMachine.ts` `interpretDeviceVerify` -> `removeToken` -> `clearDeviceToken` |
| `device_mismatch` + not pending: Request Access + amber note; opens request screen with user, org, mobile | PASS | `MobileOtpLoginForm.tsx` mismatch box (v1 copy), `useLoginFlow.ts:182`; target reads `userId`/`orgId` (`features/requests/staff/screens/DeviceChangeRequestScreen.tsx`) |
| `request_pending`: disabled "Pending..." + green note | PASS | `loginMachine.ts` `primaryAction` (see ND3: backend never sends the flag) |
| Role 2/3 OTP flow: new token stored, `manager_permissions` in session | PASS | `store/auth.ts` `sessionFromLogin` (permissions kept for role 2) |
| Role 1 number on the staff portal: access denied, nothing stored | PASS | `sessionFromLogin` (`ACCESS_DENIED_STAFF`); backend answers 403 "This is an admin account..." and that text is shown (server detail) |
| `success:false`: "Employee not found or not authorized. Contact your admin." and button re-enables | PASS | `loginMachine.ts:205` `loginErrorMessage` (`STAFF_NOT_FOUND_MESSAGE`) |
| Wrong OTP / OTP send failure copy | PASS | as admin; role_id 3 sent for OTP (v1, deferred) |
| Preload failure never blocks login; shift data in preload | DEVIATION-OK | Prefetch replaced by react-query warm-up (`warmHomeQueries`); staff home loads shift itself (B1 known gap) |
| Edited number clears mismatch/pending state; Request Access disabled for invalid number | PASS | `loginMachine.ts:105` `clearedTrust`, `isPrimaryDisabled` (B4 fix) |
| `last_login_time` 5-minute grace written before `signIn` | PASS | `useLoginFlow.ts:150` |
| Back -> welcome | PASS | `useBackToWelcome` |

### client_register -> `/register`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Verified number arrives locked with a tick; no OTP requested | PASS | `useRegistration.ts` `initiallyVerified`; `ContactOtpField.tsx` verified branch |
| Register disabled until required fields + both contacts verified | PASS | `registerForm.ts:83` `isRegisterReady` |
| Duplicate mobile / e-mail inline message, Get OTP disabled | PASS | `useContactOtp.ts` `runExistsCheck`, `canSend`; endpoint is admin-gated server side so the check degrades to "unknown" (B1 backend need) |
| Get OTP for e-mail: `purpose: registration`, 6 boxes, "Sent OTP to {email}" | PASS | `useContactOtp.ts:123`, `ContactOtpField.tsx` |
| Verify -> locked + tick + server message toast; wrong OTP clears boxes + per-kind copy | PASS | `useContactOtp.ts` `verify`, `COPY` strings |
| Non-digits stripped from OTP | PASS | `digitsOnly` in `setOtp` |
| Get OTP failure: detail, else "Network error. Please try again."; `Failed to send mobile/email OTP` | PASS | `useContactOtp.ts` `sendOtp` |
| Add Branch focuses the new row; minus only when > 1 row | PASS | `components/DynamicStringList.tsx` |
| Blank rows omitted; `['General']` when no departments; names trimmed / de-duplicated | PASS | `registerForm.ts:48` `cleanNames`, `buildRegisterInput` |
| PAN/CIN/TAN uppercased, inline messages, never blocking | PASS | `validation.ts`, `RegisterScreen.tsx` (GST gets the same non-blocking hint: DEVIATION-OK, B1) |
| Logo preview, "Tap to change logo", upload after creation, failure does not block | PASS | `components/LogoPicker.tsx`, `useRegistration.ts:127` (failure toasted, not silent) |
| Success: session, prefetch, push token, `CompleteRegistration`, attribution, home + "Awesome! Welcome to {org}" | PASS | `useRegistration.ts:110-150`; permission onboarding starts on the new user's first home open (per-user key) |
| `success:false` toast with message / "Failed to save data in database"; network "Failed to save data - Server not reachable" | PASS | `REGISTER_FAILED_MESSAGE`, `REGISTER_NETWORK_MESSAGE` |
| Payload quirks (gst twice, integer pincode, device_token, optional ids) | PASS | `api/mappers/auth.ts:77` `toRegisterBody` |
| Company address required (v2 target); pincode must be 6 digits | PASS / DEVIATION-OK | `registerForm.ts:70` (spec 14 last bullet; pincode rule from B1) |
| Update modals (soft / force) | DEVIATION-OK | Owned by the shell `UpdatePrompt` (B1 deviations) |
| Hardware back returns to admin login | PASS | header back `router.backOr(routes.adminLogin)` |
| Copy: labels, placeholders, buttons, loading "Setting up your company...", errors | PASS | `RegisterScreen.tsx` (asterisks via `required`) |

---

## 01_admin_dashboard_staff

### home -> `/admin/home`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Header logo/name, filters ALL / dept off / today, six figures | PASS | `screens/HomeScreen.tsx:47`, `components/OrgHeader.tsx`, `FilterBar.tsx` |
| Instant paint from cache; otherwise both requests | PASS | `hooks/useDashboardQueries.ts` (react-query + login warm-up, same keys) |
| Branch dropdown ALL + branches, by id, reloads with `branch_id` | PASS | `FilterBar.tsx`, `useDashboardFilters.ts` (id-based; deleted branch falls back to ALL) |
| "No attendance record for this date": past date, total > 0, no in/working/out; not tappable | PASS | `utils/dashboardLogic.ts:42` `hasNoAttendanceData`; `SummaryCard.tsx` |
| Date max today (IST); loading state while stats arrive | PASS | `useDashboardFilters.ts` `clampToToday`; `keepWithinOrg` placeholder |
| Staff Overview opens Overview (card header) / figures open the staff list | DEVIATION-OK | `docs/changes/B2.md` deviation (spec 4 F20 + assignment contract) |
| Department mode: cards with Total/Absent/Late/Working/Punch In/Punch Out; quick actions + manage hidden | PASS | `HomeScreen.tsx` `deptOn` branch; `dashboardLogic.ts:84` (real Late/Punch In counts: backend `DepartmentStatusResponse.late_punched_in` verified) |
| Department badge tap -> staff list filtered to the department | PASS | `openDepartmentStaff` -> `staffListParams({deptId})`; roster narrows by name |
| Department states: "Loading departments...", "No department data available" | PASS | `HomeScreen.tsx` `departmentView` |
| View Staff / Add Staff / View Branch / Add Branch / View Dept / Add Dept routes | PASS | `HomeScreen.tsx:151` `manageItems` |
| Logo tap -> viewer; name -> company view; "No logo available" | PASS | `OrgHeader.tsx`, `LogoViewer.tsx` |
| Company switcher: list, current closes, switching overlay, plan + caches refreshed, filters reset | PASS | `CompanySwitcherSheet.tsx`, `hooks/useCompanySwitch.ts:32` (stale-plan bug fixed) |
| Add New Company opens company form in add mode | PASS | `routes.admin.company.edit` without `orgId` = add (`CompanyEditScreen.tsx`) |
| Pull-to-refresh: date back to today, everything reloads | PASS | `HomeScreen.tsx:98`; failure toast comes from the individual queries rather than "Failed to refresh data" (DEVIATION-OK) |
| Pending-requests badge (`99+`), live on `request_submitted`, opens requests | PASS | `useDashboardQueries.ts` `usePendingRequests`, `CountBadge max=99`; realtime bus event name verified in `lib/realtime/events.ts` |
| Staff Location gate (Core/expired/no plan blocked, Prime/Elite/trial allowed), plan message toast | PASS | `HomeScreen.tsx:143`, `config/plans.ts` (verbatim messages); fail-open only while status unknown |
| Failure loading location data toast | DEVIATION-OK | location screen loads its own data (B2) |
| Plan popup (7 days, once per day per org, Android only, expired not dismissible, copy, renew/upgrade targets) | PASS | `utils/planPopup.ts:40`, `hooks/usePlanExpiryPopup.ts`; renew params simplified to `{mode:'renew'}` (DEVIATION-OK, B5 derives the rest) |
| Admin single-device poll (inert for admins in v1) | DEVIATION-OK | not ported (B2 Deferred) |
| Payment-completed / refresh flags -> toast "Plan activated! Dashboard refreshed.", reload on focus | PASS | `hooks/usePlanActivatedToast.ts`, `useRefreshOnFocus`; flag toasts replaced by producer-screen toasts |
| Update soft/force modals, permission onboarding, rate prompt, push permission | PASS / DEVIATION-OK | `DashboardOverlays.tsx` (onboarding, rate), shell `UpdatePrompt` / push registration |
| `welcomeMessage` toast after ~0.5 s | PASS | `HomeScreen.tsx` effect |
| Android back exits (tab root) | PASS | tab root, no handler |
| Live logo update | PASS | logo is a query invalidated by company edit |
| Dates in IST, branch by id, org-scoped cache, no stale plan | PASS | section 13 items: `useDashboardFilters`, `useCompanySwitch`, `queryKeys` scoped by org |
| Forced logout on deleted org (404) | DEVIATION-OK | not implemented, error toast + retry (B2 Deferred) |
| Copy table (labels, sections, tiles, errors, plan texts) | PASS | automated diff: remaining misses are dead-UI strings (logout/delete/reassign modals, notification panel) that are explicitly "don't port" |

### overview -> `/admin/overview`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Date from home (banner `DD Mon YYYY` + day name) / default today | PASS | `screens/OverviewScreen.tsx:35` (`formatDate`, `weekdayOf`) |
| Six counts; tile switches bucket from the matching endpoint | PASS | `utils/overviewLogic.ts:13` `OVERVIEW_TILES`, `statusBucketOf`; `hooks/useOverviewData.ts` |
| Total = all staff A-Z with `{n} Staff` | DEVIATION-OK | date + branch aware (ND6) |
| Punch In orange with label / `--:--`; Punched Out red + `{hrs} hrs`; others green no label | PASS | `overviewLogic.ts:80` `buildPunchMaps`, `punchColumn` |
| Empty bucket "No Staff Found / No staff in "<label>" for this date" | PASS | `OverviewScreen.tsx` |
| Date change refreshes; no future dates | PASS | `clampToToday`, `DateField maxDate` |
| List failure toast "Failed to load staff"; stats failure silent, previous counts stay | PASS | `OverviewScreen.tsx` effect; stats query keeps placeholder |
| Row tap: detail (name, emp id, branch, dept, status pill, date), loading indicator | PASS | `components/overview/StaffDayDetail.tsx` |
| Multiple sessions: `SESSION n` headings; 0/1 no heading; fallback to monthly record | PASS | `overviewLogic.ts` `resolveDaySessions`; `StaffDayDetail.tsx:58` |
| Total Hours card as `HH:MM`, no `HH:60` | PASS | `overviewLogic.ts:129` `formatHours` |
| Photo full-screen; profile photo via employee-profile | PASS | `StaffDayDetail.tsx`, `useStaffDay` photo query |
| Back closes detail first (hardware + header) | PASS | `OverviewScreen.tsx` `onBack` + `BackHandler` |
| `statsData` param ignored | PASS | no JSON params exist |
| Branch filter of home honoured (v1 dropped it) | PASS | `branchId` param (B2 fix) |

### all_Staff -> `/admin/staff`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Total opens roster (`All Staff`), spinner/skeleton until all-staff returns | PASS | `hooks/useStaffRoster.ts:48`, `screens/StaffListScreen.tsx` |
| Live buckets call the matching endpoint with branch + date; subtitles | PASS | `utils/rosterFilters.ts` `liveStatusFor`, `FILTER_TITLES` |
| Absent / Late banners with pluralisation; LATE tag on late rows | PASS | `rosterFilters.ts:65` `bannerFor`; `StaffRosterRow.tsx` |
| Chips All/Staff/Manager/Inactive with counts from the de-duplicated list | PASS | `rosterFilters.ts:117` `chipCounts` (live views merged with the full roster: fixes "always 0", DEVIATION-OK per B3a) |
| Search name/branch/dept, case-insensitive; counts unchanged; "No Results" copy | PASS | `filterRoster`, `emptyCopy` (search trimmed: fix) |
| A-Z sort, duplicate `user_id` once | PASS | `filterRoster`, `dedupeById` |
| Avatar with photo opens a lightbox (detail does not open) | PASS | `StaffRosterRow.tsx` (letter avatars open the detail: fix of swallowed tap) |
| Switch -> `PUT /addstaff/{id}/status`, server message toast, failure detail / fallback, in-flight lock | PASS | `hooks/useToggleStaffActive.ts:22`; network failure text uses the shared client message instead of "Failed to update staff status" (DEVIATION-OK) |
| Inactive chip: re-activated row disappears, count decrements | PASS | cache patched on success |
| Row tap -> detail screen (preloads in parallel); failure state | DEVIATION-OK | separate route `/admin/staff/detail` with its own queries and error state (B3a) |
| Zero-match department tile shows empty state; `punch_in`/`punch_out` aliases; no org id state | PASS | `rosterFilters.ts` aliases, `useStaffRoster.ts` `deptMissing`, "Organisation not available" |
| Manager scope uses own user id | PASS | `hooks/useStaffScope.ts` |
| Company header + logo; photo prefetch of first 20 | PASS / DEVIATION-OK | header present; prefetch replaced by `Avatar` caching (B3a) |
| UTC default date | PASS | `todayIST()` |

---

## 02_admin_org_structure

### add_staff -> `/admin/staff/edit`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Employee id pre-filled once, numeric increment until free, 1000 on failure, never overwrites typed input | PASS | `utils/employeeId.ts:28`, `hooks/useStaffEditor.ts` `empIdTouched`; `api/staff.ts` fail-open |
| Required fields inline (name, emp id, phone, branch, dept, gender) + toast "Please fill all required fields", no request | PASS | `utils/staffForm.ts:63` `validateStaffForm` (v1 order and messages) |
| Duplicate id (add): inline + toast "Employee ID already exists. Please use a different ID." | PASS | `useStaffEditor.ts:157` `save` |
| POST body: names, shift 0, role 3 (server-forced), `is_field_staff` 0/1, success toast then close | PASS | `api/mappers/staff.ts:139`; backend `add_staff_function.py` sets role 3 |
| Photo uploaded after save; failed upload does not fail the save (and is reported) | PASS | `useStaffEditor.ts` (error toast "Staff saved, but the photo could not be uploaded") |
| Photo permission denied: "Permission required to access photos" | PASS | `pickPhoto` |
| Field Staff switch + Punch-In Options modal | DEVIATION-OK | switch kept, mode choice dropped (ND4) |
| Limit banner `Staff: x / y`, full state red + disabled submit, `{n} slot(s)`, Upgrade / iOS "View Status" | PASS | `StaffLimitBanner.tsx`, `staffForm.ts:166` |
| Edit mode: pre-filled (record + photo), More Details auto-expands, id not regenerated | PASS | `hooks/useStaffFormData.ts` `useStaffRecord`, `hasMoreDetails` |
| Load failure toast "Failed to load staff details"; options failure "Failed to load form options" | PASS | `useStaffEditor.ts`, `useStaffOptions` |
| Unsaved-changes prompt (header + hardware back), Exit / Save; no prompt when clean | PASS | `components/UnsavedChangesDialog.tsx`, `dirty` (photo included) |
| Edit success: toast, caches refreshed (replaces three flags) | PASS | `orgStructureKeys(['staff','home','shifts'])` |
| "+ Add Shift" opens Shift Settings; new shift appears on return (not auto-selected) | PASS | `StaffFormSections.tsx:164`, `useRefreshOnFocus(shifts.refetch)` |
| DOB `YYYY-MM-DD`; e-mail lower-case; IFSC upper-case; phone digits (10) | PASS | `DateField`, `useStaffEditor.ts` `normalise` |
| Server `detail` toast / network toast; inputs re-enable | PASS | `useAsyncAction` (error text from the shared client) |
| Gender Male / Female only | PASS | `GENDER_CHOICES` |
| Manager (role 2) opens with own scope | PASS | `hooks/useOrgScope.ts` |
| Copy table | PASS | automated diff: remaining misses are dead modals (Shift Required, DOB scroller) and v1 network strings |
| Editing a manager demotes them (server) | NEEDS-DECISION | ND2 |

### all_Branch -> `/admin/branches`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Cards A-Z with name, address, GPS 4 dp / "No GPS", `{n}m radius`; count banner | PASS | `screens/BranchListScreen.tsx`, `utils/branchForm.ts` `sortBranches`, `formatGps`, `formatRadius` |
| Empty "No branches found", "All Branches" label hidden | PASS | `BranchListScreen.tsx` |
| Edit opens branch form in edit mode | PASS | `router.push(routes.admin.branches.edit, {branchId})` |
| Empty branch: "Checking..." then confirm; Cancel keeps; Delete toasts "Branch deleted successfully" | PASS | `utils/branchDeleteFlow.ts:48` state machine, `hooks/useBranchDeleteFlow.ts` |
| Delete failure toast; branch remains | PASS | `useBranchDeleteFlow.ts` |
| Branch with staff: reassign sheet, "{N} staff in "{name}" must be reassigned before deletion", disabled action, forced tap message, current branch not a target, Select All toggle | PASS | `components/ReassignSheet.tsx`, `branchDeleteFlow.ts:127` `reassignLabel`, `targetBranches` |
| Partial reassign: staff leave list, "{k} staff reassigned", sheet stays; all selected: "Reassign All & Delete Branch" + "Staff reassigned and branch deleted" | PASS | `useBranchDeleteFlow.ts` (delete failure after a full move falls back to the confirm: improvement) |
| Reassign failure keeps the list | PASS | reducer `failed` |
| Staff lookup failure | DEVIATION-OK | error toast and nothing opens (spec 13 fix; B3b) |
| Returning from edit shows fresh data | PASS | `useRefreshOnFocus`, invalidation after save |
| Load failure: toast "Failed to load branches", cached list stays | GAP-FIXED | toast added when a refresh fails over cached data (`BranchListScreen.tsx`); no-data case keeps the `ErrorState` |
| Manager uses own user id as scope | PASS | `useOrgScope` (`scopeId`); branch delete as manager is a known backend limitation (B3b) |

### add_branch -> `/admin/branches/edit`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Empty save: 3 inline errors, no request; errors clear on typing; GPS error clears on tap | PASS | `branchForm.ts:36` `validateBranchForm`, `useBranchEditor.ts` setters |
| Permission denied: "Location Permission Required" with Cancel / Open Settings (Clockyn wording) | PASS | `useBranchEditor.ts:55` `openPicker` |
| Add: map at current fix with marker + radius circle; Edit: stored coordinates, no fresh fix | PASS | `openPicker`, `components/LocationPickerModal.tsx` |
| Tap / drag moves the pin, address resolved, "Save Location" / "Update Location", GPS shows 6 dp + check | PASS | `LocationPickerModal.tsx`, `formatGps(...,6)` |
| Back in the map keeps previous value; Map / Satellite toggle | PASS | `closePicker`; `MAP_TYPES` |
| Radius chips 100/250/500/750/1000, out-of-set stored value kept | PASS | `branchForm.ts` `radiusChoices`, `components/RadiusSelector.tsx` |
| Add: POST with trimmed name/address, coordinates, `punch_radius`, `org_id`; Edit: PUT, "Update Branch" | PASS | `api/mappers/org.ts` `toBranchBody`, `useBranchEditor.ts:103` |
| Server `detail` toast, form stays; 10 s timeout / network strings | DEVIATION-OK | shared API client timeout + messages (B3b Deferred) |
| No org id: "Please login first"; GPS failure: "Failed to get location" | PASS | `useBranchEditor.ts` |
| Web: map picker | PASS | Leaflet `ClockynMap` + web reverse geocode (replacement documented in B3b) |
| Copy (labels, placeholders, map texts) | PASS | automated diff: only the v1 network strings and dead popups differ |

### dept_all -> `/admin/departments`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Alphabetical list with count banner; empty state | PASS / DEVIATION-OK | `screens/DepartmentListScreen.tsx`; empty hint reworded ("Add your first department..." with an Add action; spec 13 suggestion) |
| Edit opens dept form with `deptId` | PASS | `routes.admin.departments.edit` |
| Delete confirmation `Delete Department / Are you sure you want to delete "{name}"?`, success toast `"{name}" deleted successfully` | PASS | `DepartmentListScreen.tsx` |
| Server rejection: list re-fetched, detail toasted | PASS | `onError` refetch |
| Rename visible after return; no org id = no fetch | PASS | invalidation; `enabled` guard in `useDepartmentList` |

### dept_add -> `/admin/departments/edit`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Blank name: "Please enter department name", no request; "Please login first" | PASS | `screens/DepartmentEditScreen.tsx`, `utils/departmentForm.ts` |
| Add: POST trimmed name + org, popup "Department Added!" ~1.5 s then back | PASS | `POPUP_MS`, `departmentSavedMessage` |
| Edit prefilled, PUT, popup "Department Updated!" | PASS | `existing` hydrate |
| Server detail toast, screen stays; clear (x) | PASS | `useAsyncAction`, `onRightIconPress` |
| "Network error: Request timeout" string | DEVIATION-OK | shared client messages (B3b) |
| List refreshed on return | PASS | invalidation of `departments`, `home`, `staff` |

### assign_devices -> `/admin/devices`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Four rows, each shows its "... coming soon" info toast, nothing else | PASS | `screens/DevicesScreen.tsx:9` |
| Title "Add Devices"; back arrow | PASS | `Screen title` |
| Bottom-nav behaviours, cached logo | DEVIATION-OK | shell owns navigation; org name subtitle (B3b) |

### add_department (orphan)

| Item | Status | Evidence |
|---|---|---|
| Not built | DEVIATION-OK | FIX_POLICY B7 / `docs/ROUTES.md` (dept_add is the live screen) |

---

## 03_admin_company_team_rules

### all_Company -> `/admin/company`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Hero (logo/placeholder, name, category badge only when present) | PASS | `screens/CompanyViewScreen.tsx:23` |
| Mobile + Email always; optional rows only when present | PASS | contact card conditionals |
| "Legal & Compliance" only with at least one id; only present ids | PASS | `hasLegal`, `legalRows` |
| "Structure" only with branches or departments, both counts | PASS | `structure` |
| Details failure / empty: error or "No company details found"; Edit does nothing | PASS / DEVIATION-OK | `ErrorState` + retry replaces the "Network error - please try again" toast; empty state kept |
| Edit (pencil + button) opens form with `orgId`, prefilled | PASS | `onEdit` |
| Delete visible only with > 1 company; confirm copy; Cancel makes no call | PASS | `companyForm.ts` `canDeleteCompany`, `useConfirm` |
| Delete success: next active company (only when the deleted one was active), session patched, cache reset, home | DEVIATION-OK | `companyForm.ts:189` `nextActiveCompany` (B4 fix: v1 always switched) |
| Delete failure: detail toast / "Failed to delete", spinner always clears | PASS | `useAsyncAction`, `LoadingOverlay "Deleting Company..."` |
| Logo re-fetched with cache-bust on focus | DEVIATION-OK | logo comes from the company profile query; edit invalidates `company` scope (B4) |
| Missing org id guard | PASS | falls back to the session org |

### add_company -> `/admin/company/edit`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Add: POST with non-blank branches, departments or `['General']`, `org_gst ''` | PASS | `companyForm.ts:155` `buildCompanyInput` |
| Required: name, address, state, district, pincode, >= 1 branch (add only) -> exact toast | PASS / DEVIATION-OK | `validateCompanyForm:114` (trimmed; branch only when adding; pincode 6 digits, B4) |
| Edit: prefilled, branches hidden, departments shown | PASS | `formFromDetails`, `CompanyEditScreen.tsx` |
| Changed mobile/email must be verified: "Please verify new mobile/email number/address", mobile first; Get OTP only when changed | PASS | `contactNeedsVerification`, `canRequestMobileOtp/EmailOtp` |
| OTP: Verify at 6 digits, wrong OTP clears + "Invalid mobile/email OTP", success locked + server message; HTTP failure "Failed to send OTP" | PASS | `hooks/useContactVerification.ts:31` |
| Branch/department rows: minus only with 2+ | PASS | `components/TextListEditor.tsx` |
| PAN/CIN/TAN uppercased, inline hint, saving still proceeds | PASS | `companyForm.ts` validators; not in the submit guard |
| Logo: add -> `/auth/upload-org-logo`, edit -> `/company/update-logo`; unchanged = no upload; failure does not block (reported) | PASS | `CompanyEditScreen.tsx` |
| Active company rename updates session name only for the active one | PASS | `patchSession` guard |
| Add success refreshes company list / branches / departments; edit invalidates company scope | PASS | invalidations (flags replaced) |
| `success:false` message / "Failed to save company"; network failure; inputs disabled + overlay | PASS | `useAsyncAction`, `editable={!busy}`, `LoadingOverlay` |
| Success popup, 2 s delay | DEVIATION-OK | toast + immediate navigation (B4) |
| Legacy `org_gst` blanked on edit (v1) | DEVIATION-OK | sent back unchanged (B4 fix) |

### manager_settings -> `/admin/managers`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Stats Total / Assigned / Assignments | PASS | `utils/managerAssign.ts` `managerStats`; `ManagerListScreen.tsx:21` |
| Empty state + "Assign Manager" CTA; "+" opens Add Manager | PASS | `ManagerListScreen.tsx` |
| View Branch popup grouped by branch id, fallbacks "All Branches"/"All Departments", pluralisation, "No branches assigned", Close | PASS | `groupAssignmentsByBranch`, `components/ManagerSheets.tsx` |
| Staff sheet spinner, rows, "No staff found" | PASS | `ManagerStaffSheet` (error state + retry instead of silently empty: DEVIATION-OK) |
| Permissions sheet: current values, `x/y permissions active`, progress, Select All / Deselect All, empty server map never "0/0" | PASS | `utils/permissions.ts:49` `mergePermissions`, `allEnabled`, `permissionProgress` |
| Save permissions: POST `{permissions}`, close, "Permissions Saved!"; failure keeps the sheet | PASS | `saveMutation` |
| Remove: confirm `Remove {name} as manager?`, "Removing...", "Manager Removed!", failure text | PASS | `removeMutation` (server detail shown: improvement) |
| Pencil opens edit with staff locked and scopes prefilled | PASS | `router.push(routes.admin.managers.edit, {userId})` |
| List updates after Add Manager | PASS | `managers.all` invalidation |
| Back lands on Settings | DEVIATION-OK | standard `Screen` back (admin settings is a tab) |
| Permission names exact-string contract; matching shortcut for managers | PASS | `permissions.ts` list == `features/employee/utils/managerShortcuts.ts` (all ten names incl. Holiday Management, which the v1 spec lacked) |
| Fetch failure keeps list; permission-load failure never overwrites real permissions | PASS | `ErrorState` only when no data; Save disabled on load error (B4 fix) |

### add_manager -> `/admin/managers/edit`

| Bullet / rule | Status | Evidence |
|---|---|---|
| "Please select a staff member" / "Please select at least one branch to assign" | PASS | `managerAssign.ts:40` `validateManagerForm` |
| Already a manager (add): "{name} is already assigned as a manager", no POST | PASS | `ManagerEditScreen.tsx:39` submit |
| Conflict modal with manager, empId, branch, department; "All Departments"; own assignments skipped; nothing saved | PASS | `managerAssign.ts:92` `detectConflicts`, `components/ConflictModal.tsx` (fresh manager list fetched) |
| POST one `{branch_id, dept_id}` per branch x department; back to list showing updates | PASS | `buildAssignManagerInput`; invalidation + `backOr` |
| Branches without departments | DEVIATION-OK | blocked client side (ND7) |
| Edit: staff locked, chips prefilled, "Update Manager" | PASS | `prefillFromManager` (legacy null dept selects all) |
| Branch / department filter change reloads staff and clears selection | PASS | `setStaffId('')` in the filter handlers |
| "All" row selects everything, header "All selected", `{n} selected` | GAP-FIXED | `allSelectedText="All selected"` via the new additive `MultiSelect` prop; the sheet still shows the Select all row |
| Access Preview with `branches x departments` count | PASS | `countCombinations`, preview card |
| Server detail toast / "Failed to assign manager"; overlay clears | PASS | `useAsyncAction` |
| Back without saving | PASS | standard back |

### shift_settings -> `/admin/shifts`

| Bullet / rule | Status | Evidence |
|---|---|---|
| List with `start - end` times; no shifts: only add | PASS / DEVIATION-OK | `screens/ShiftsScreen.tsx:24`, `formatShiftRange`; empty state carries an add action |
| Add: POST, "Shift Added!", list refreshed, add-staff options refreshed | PASS | `saveMutation` invalidates `shifts` + `staff.options` (replaces `shift_need_refresh`) |
| Same start/end, duplicate name (case-insensitive), duplicate time pair messages; order of rules | PASS | `utils/shiftTime.ts:49` `validateShiftForm` |
| Missing name/time: v1 did nothing | DEVIATION-OK | inline messages (fix) |
| Only one menu open; background closes | PASS | action sheet (`ActionMenu`) |
| Edit prefilled, "Update", own name allowed | PASS | `editingId` excluded from duplicate checks |
| Delete confirm, DELETE with `org_id`, "Shift Deleted!", failure text | PASS | `deleteMutation`; confirm adds "Staff on this shift will be unassigned" (DEVIATION-OK) |
| Assign sheet: `ASSIGNED (n)` / `AVAILABLE (n)`, "Assign {n} Staff", "Staff assigned!", lists refresh | PASS | `components/AssignStaffSheet.tsx` |
| Remove: unassign, "Staff removed" | PASS / DEVIATION-OK | confirmation added; failures surfaced |
| "All staff assigned" when none available; failure `detail` / "Failed to assign" | PASS | `AssignStaffSheet` |
| Backend routes for assign / unassign | NEEDS-DECISION | ND5 |
| New 18 h limit message | DEVIATION-OK | mirrors a backend rule (`shiftTime.ts`, B4) |

### attendance_rule -> `/admin/attendance-rule`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Defaults 3 / Half Day with the summary sentence; saved values load | PASS | `screens/AttendanceRuleScreen.tsx:22`, `api/system.ts` `mapAttendanceRule` |
| Count 1-10, two consider-as values, summary updates | PASS | `COUNT_OPTIONS`, `CONSIDER_OPTIONS` |
| Save: success "Rule saved successfully"; failure "Failed to save rule"; body `{late_punch_in_count, consider_as}` | PASS | `useApiMutation`, `saveAttendanceRule` (test `supportSystem.test.ts`) |
| GET failure: defaults without error message | DEVIATION-OK | inline notice with retry (v1 silent-failure fix, B4) |
| Loading / double-tap safe save; `orgId` guard | PASS | `loading={save.isPending}`, `requireId` |
| Endpoint missing server side | NEEDS-DECISION | ND5 |

### holiday_management -> `/admin/holidays`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Current-month calendar, Sundays OFF by default, today outlined | PASS | `screens/HolidaysScreen.tsx:36`, `components/HolidayMonthGrid.tsx`, `getWeeklyOffs` default `[6]` |
| Holiday dates highlighted; groups sorted by earliest date; `{n} Holiday(s)` pill; day counts | PASS | `utils/holidayLogic.ts:86` `groupHolidays` (group key = name + scope + policy: DEVIATION-OK, spec 13 item 4) |
| "No Holidays" + hint | PASS | `HolidaysScreen.tsx` |
| Month/year change reloads; years current-1 ... +4; picked dates cleared | PASS | `holidayYearRange`, `onMonthChange` (spec 13 item 2) |
| Off-day cells not selectable (also in Add Dates / Edit) | PASS | `isWeeklyOffDate`, `HolidayMonthGrid` |
| Selected dates box (sorted `DD Month YYYY`), toggle, Cancel clears | PASS | `selectedDateLabel`, `SelectedDatesCard` |
| Blank name: "Please enter a holiday name", no request | PASS | `hooks/useHolidayActions.ts:31` `addHolidays` |
| Add: one POST per date with scope and `block_attendance`, "n holiday(s) added successfully", form resets (block back on), reload | PASS | `addHolidayDates` (`Promise.allSettled`; partial failure reported, never a success toast on rejection) |
| Block toggle -> "No Punch" / "Punch Allowed" display; null counts as blocking | GAP-FIXED | `mapHoliday` null handling fixed (`api/system.ts`) |
| Block toggle persisted by the server | NEEDS-DECISION | ND1 |
| Filter keeps org-wide holidays visible | PASS | `holidayLogic.ts:59` `filterHolidays` |
| Edit as diff (PUT kept, DELETE removed, POST added with the original scope); Save disabled for blank name / no dates | PASS | `computeEditDiff`, `HolidayEditModal` (unchanged records skip PUT) |
| Delete group / single copy, toasts `{n} holidays deleted` / `Holiday deleted` | PASS | `HolidaysScreen.tsx` `onDeleteGroup`, `onDeleteDate`, `deleteEntries` |
| Add Dates: existing/off-day not tappable; "Add (n)"; "{n} date(s) added" | PASS | `AddDatesModal`, `addDatesToGroup` (duplicate dates skipped with a notice: new rule from spec 13) |
| Configure Off Days: POST `{off_days}`, "Off days updated", calendar greys; none selected summary | PASS / GAP-FIXED | `setWeeklyOffs`; summary restored to the v1 em dash copy (`offDaysSummary`) |
| Off-days `success:false` | DEVIATION-OK | surfaced as an error toast (spec 13 item 7) |
| Network failures: respective toasts | PASS | `guard()` |
| Date parsing without `new Date('YYYY-MM-DD')` | PASS | `@/lib/datetime` helpers throughout; grep clean |
| "Loading holidays..." text, separate month/year modals | DEVIATION-OK | skeleton list + calendar header month/year sheet (B4) |
| Manager with Holiday Management has a tile | PASS | `features/employee/utils/managerShortcuts.ts:55` |

---

## Hard-rule sweep (whole scope)

| Rule | Result |
|---|---|
| No `Alert.alert`, no `fetch(` outside `src/lib/api`, no `toISOString().slice/split` business dates, no `new Date('YYYY-MM-DD')`, no raw hex colours in the six feature folders | clean (grep) |
| Legacy names | `npm run check:brand` clean for this scope |
| Routes via `routes` / `useAppRouter`; route files thin re-exports | `npm run check:routes` passes |
