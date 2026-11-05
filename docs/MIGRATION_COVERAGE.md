# Migration coverage: v1 screens to Clockyn

All 88 screen specs of the v1 specification set (`../project_complete_context/pages/`, relative to the Clockyn folder, outside this repo; index in `../project_complete_context/INDEX.md`) are accounted for below, followed by the shared components and systems, and then the list of **additions that were not in v1** for the product owner to review.

How to read it:

- **Route** is the Expo Router path (constants in `src/config/routes.ts`, ownership in `docs/ROUTES.md`). **Feature** is the folder under `src/features/`. **Builder** is the engineer id; the log is `docs/changes/<id>.md`.
- **Status**: **Ported** (functionality kept, v1 defects fixed per `docs/FIXES_APPLIED.md`), **Merged** (live part folded into another screen), **Dropped** (not rebuilt, reason given). Counts: 81 ported, 2 merged, 5 dropped = 88.
- "Ported" never means pixel parity: every screen uses the new design system and is responsive. Copy is kept except where the v1 name of the product appeared (replaced by "Clockyn") and where a documented fix changed it.

## 1. The 88 v1 screens

### 00 Entry and authentication

| # | v1 screen | Route | Feature | Builder | Status | Notes |
|---|---|---|---|---|---|---|
| 1 | `index` (role chooser) | `/` | `src/features/auth` | B1 | Ported | Silent session redirect moved to the shell (`useRootRedirect`) |
| 2 | `admin_login` | `/admin-login` | `src/features/auth` | B1 | Ported | Role validated before the session is stored |
| 3 | `emp_login` | `/staff-login` | `src/features/auth` | B1 | Ported | Device-mismatch flow kept (DD-31) |
| 4 | `client_register` | `/register` | `src/features/auth` | B1 | Ported | Single grouped form, two columns on desktop |

### 01 Admin dashboard and staff

| # | v1 screen | Route | Feature | Builder | Status | Notes |
|---|---|---|---|---|---|---|
| 5 | `home` | `/admin/home` (tab) | `src/features/dashboard` | B2 | Ported | About 25 % of the v1 file was dead and not ported (department detail view, inline staff detail, branch delete modal, notification panel) |
| 6 | `overview` | `/admin/overview` | `src/features/dashboard` | B2 | Ported | Branch and date aware |
| 7 | `all_Staff` | `/admin/staff` | `src/features/staff-directory` | B3a | Ported | Live buckets merged with the full roster |

### 02 Admin organisation structure

| # | v1 screen | Route | Feature | Builder | Status | Notes |
|---|---|---|---|---|---|---|
| 8 | `add_branch` | `/admin/branches/edit` | `src/features/org-structure` | B3b | Ported | Web has a real map picker |
| 9 | `add_department` | none | none | B3b | Dropped | Orphan duplicate of `dept_add` (no inbound navigation); read, not built |
| 10 | `add_staff` | `/admin/staff/edit` | `src/features/org-structure` | B3b | Ported | Add and edit in one screen; manager picker and punch-mode choice were dead and not ported (DD-03, DD-42) |
| 11 | `all_Branch` | `/admin/branches` | `src/features/org-structure` | B3b | Ported | Delete and reassign as a tested state machine |
| 12 | `assign_devices` | `/admin/devices` | `src/features/org-structure` | B3b | Ported | Reachable "coming soon" placeholder kept, title "Add Devices" |
| 13 | `dept_add` | `/admin/departments/edit` | `src/features/org-structure` | B3b | Ported | Live department form (add and rename) |
| 14 | `dept_all` | `/admin/departments` | `src/features/org-structure` | B3b | Ported | Add button added in the header |

### 03 Admin company and team rules

| # | v1 screen | Route | Feature | Builder | Status | Notes |
|---|---|---|---|---|---|---|
| 15 | `add_company` | `/admin/company/edit` | `src/features/company` | B4 | Ported | Add and edit by `orgId` presence |
| 16 | `add_manager` | `/admin/managers/edit` | `src/features/team-rules` | B4 | Ported | Department required (v1 trap 1) |
| 17 | `all_Company` | `/admin/company` | `src/features/company` | B4 | Ported | |
| 18 | `attendance_rule` | `/admin/attendance-rule` | `src/features/team-rules` | B4 | Ported | Backend route missing (`backend_changes.md` P0-4); screen shows defaults |
| 19 | `holiday_management` | `/admin/holidays` | `src/features/team-rules` | B4 | Ported | Every response checked; groups by name, scope and policy |
| 20 | `manager_settings` | `/admin/managers` | `src/features/team-rules` | B4 | Ported | Permission catalogue on the client merged with the server map |
| 21 | `shift_settings` | `/admin/shifts` | `src/features/team-rules` | B4 | Ported | Staff assignment needs P0-7 |

### 04 Admin settings and billing

| # | v1 screen | Route | Feature | Builder | Status | Notes |
|---|---|---|---|---|---|---|
| 22 | `beyond` | `/admin/more`, `/admin/permissions` (plus the Beyond accordion in `/admin/settings`) | `src/features/settings` | B5 | Merged | Main page and the OTP-gated delete page were unreachable and are not ported; deletion is the request flow in More Options |
| 23 | `invoices` | `/admin/billing/invoices` | `src/features/billing` | B5 | Ported | Downloaded tab on native only |
| 24 | `other_apps` | none | none | none | Dropped | Cross-promotes other products by name (FIX_POLICY E) |
| 25 | `payment_summary` | `/admin/billing/checkout` | `src/features/billing` | B5 | Ported | Retry verification added |
| 26 | `settings` | `/admin/settings` (tab) | `src/features/settings` | B5 | Ported | Appearance card added; "Our Other Applications" row removed |
| 27 | `subscription` | `/admin/billing` | `src/features/billing` | B5 | Ported | Explicit plan-state model |
| 28 | `suggest_feature` | `/admin/suggest-feature` | `src/features/settings` | B5 | Ported | |
| 29 | `support` | `/admin/support` | `src/features/settings` | B5 | Ported | Tickets refresh on focus |
| 30 | `upgrade_plan` | `/admin/billing/upgrade` | `src/features/billing` | B5 | Ported | Route params reduced to `mode`, `planId`, `staff` |

### 05 Admin payroll

| # | v1 screen | Route | Feature | Builder | Status | Notes |
|---|---|---|---|---|---|---|
| 31 | `add_payslip` | `/admin/payroll/payslips/edit` | `src/features/payroll` | B6 | Ported | Live totals in integer paise |
| 32 | `bonus` | `/admin/payroll/bonus` | `src/features/payroll` | B6 | Ported | Shared `TemplateListScreen` |
| 33 | `count_basis` | `/admin/payroll/count-basis` | `src/features/payroll` | B6 | Ported | Shared `TemplateListScreen` |
| 34 | `daily_wages` | `/admin/payroll/daily-wages` | `src/features/payroll` | B6 | Ported | Backend routes missing (P0-1, P0-3) |
| 35 | `hourly_charges` | `/admin/payroll/hourly` | `src/features/payroll` | B6 | Ported | Backend routes missing (P0-2, P0-3) |
| 36 | `incentive` | `/admin/payroll/incentive` | `src/features/payroll` | B6 | Ported | Chooser only; the dead count editor is not ported |
| 37 | `monthly_fixed` | `/admin/payroll/payslips` | `src/features/payroll` | B6 | Ported | The dead edit view of v1 is not ported |
| 38 | `overtime` | `/admin/payroll/overtime` | `src/features/payroll` | B6 | Ported | Shared `TemplateListScreen` |
| 39 | `payslip_template` | none | none | none | Dropped | Orphan (no inbound navigation) that called endpoints which do not exist |
| 40 | `turnover` | `/admin/payroll/turnover` | `src/features/payroll` | B6 | Ported | Shared `TemplateListScreen` |

### 06 Admin reports

| # | v1 screen | Route | Feature | Builder | Status | Notes |
|---|---|---|---|---|---|---|
| 41 | `attendance_monthly_report` | `/admin/reports/monthly-attendance` | `src/features/reports` | B7 | Ported | Server PDF; manager variants kept |
| 42 | `employee_details_report` | `/admin/reports/employee-details` | `src/features/reports` | B7 | Ported | Real PDF and DOC |
| 43 | `employee_shift_report` | `/admin/reports/employee-shifts` | `src/features/reports` | B7 | Ported | Batched lookups with an error state |
| 44 | `late_report` | `/admin/reports/late` | `src/features/reports` | B7 | Ported | Needs shift times from the server (P1-3) |
| 45 | `monthly_report` | `/staff/reports` | `src/features/reports` | B7 | Merged | Manager variant of the shared reports hub (one component, four enabled rows) |
| 46 | `monthly_salary` | `/admin/payroll/monthly-salary` | `src/features/reports` | B7 | Ported | Needs P0-6 for persistent paid state |
| 47 | `overtime_report` | `/admin/reports/overtime` | `src/features/reports` | B7 | Ported | Needs P0-5 |
| 48 | `reports` | `/admin/reports` | `src/features/reports` | B7 | Ported | Saved-report history capped and file-backed |
| 49 | `staff_detailed_report` | `/admin/reports/staff-detailed` | `src/features/reports` | B7 | Ported | |
| 50 | `view_staff_salary` | `/admin/payroll/salary-sheet` | `src/features/reports` | B7 | Ported | CSV was dead in v1 and is not offered |

### 07 Admin requests, expenses and location

| # | v1 screen | Route | Feature | Builder | Status | Notes |
|---|---|---|---|---|---|---|
| 51 | `admin_device_change_requests` | `/admin/requests/device-change` | `src/features/requests/admin` | B8 | Ported | Shared `RequestListScreen` |
| 52 | `admin_leave_requests` | `/admin/requests/leave` | `src/features/requests/admin` | B8 | Ported | Per-date chips read-only (DD-91) |
| 53 | `admin_permission_requests` | `/admin/requests/permission` | `src/features/requests/admin` | B8 | Ported | |
| 54 | `admin_shift_change_requests` | `/admin/requests/shift-change` | `src/features/requests/admin` | B8 | Ported | |
| 55 | `odometer` | `/admin/expenses/odometer` | `src/features/expenses/admin` | B8 | Ported | Whole-rupee rate |
| 56 | `other_bills` | `/admin/expenses/bills` | `src/features/expenses/admin` | B8 | Ported | One `ExpenseReviewScreen` serves tickets and bills |
| 57 | `requests` | `/admin/requests` | `src/features/requests/admin` | B8 | Ported | Hub and badge hook `useRequestBadges` |
| 58 | `staff_location` | `/admin/location` | `src/features/location` | B8 | Ported | Branch filter now works |
| 59 | `track_location` | none | none | none | Dropped | Orphan (earlier alternative of `staff_location`, no inbound navigation) |
| 60 | `travel_ticket` | `/admin/expenses/travel` | `src/features/expenses/admin` | B8 | Ported | Shared with bills |

### 08 Admin communication

| # | v1 screen | Route | Feature | Builder | Status | Notes |
|---|---|---|---|---|---|---|
| 61 | `announcement` | `/admin/chat/announcements` | `src/features/announcements` | B9b | Ported | |
| 62 | `announcement_branch_dept` | `/admin/chat/announcements-targeted` | `src/features/announcements` | B9b | Ported | |
| 63 | `chat` (hub) | `/admin/chat` (tab) | `src/features/chat` | B9b | Ported | Plan gate on the hub (DD-11) |
| 64 | `group_chat` | `/admin/chat/groups` | `src/features/chat` | B9a | Ported | One chat engine for admin and staff; dead stubs not ported |
| 65 | `individual_chat` | `/admin/chat/direct` | `src/features/chat` | B9a | Ported | Pin, mute, theme and media sheet were fake and not ported |

### 09 CRM

| # | v1 screen | Route | Feature | Builder | Status | Notes |
|---|---|---|---|---|---|---|
| 66 | `assign_leads` | `/admin/crm/leads` | `src/features/crm` | B10 | Ported | |
| 67 | `crm` (hub) | `/admin/crm` (tab) | `src/features/crm` | B10 | Ported | Plan checked before any fetch |
| 68 | `emp_crm` | `/staff/crm` (tab) | `src/features/crm` | B10 | Ported | Dead request box not ported |
| 69 | `enter_leads` | `/admin/crm/leads/edit` | `src/features/crm` | B10 | Ported | Required date preserved on edit |

### 10 Employee communication

| # | v1 screen | Route | Feature | Builder | Status | Notes |
|---|---|---|---|---|---|---|
| 70 | `emp_broadcast` | `/staff/chat/broadcast` | `src/features/announcements` | B9b | Ported | |
| 71 | `emp_broadcast_targeted` | `/staff/chat/targeted` | `src/features/announcements` | B9b | Ported | |
| 72 | `emp_chat` (hub) | `/staff/chat` (tab) | `src/features/chat` | B9b | Ported | |
| 73 | `emp_group_chat` | `/staff/chat/groups` | `src/features/chat` | B9a | Ported | Same engine as admin |
| 74 | `emp_personal_chat` | `/staff/chat/direct` | `src/features/chat` | B9a | Ported | Admin conversation pinned first |

### 11 Employee home and profile

| # | v1 screen | Route | Feature | Builder | Status | Notes |
|---|---|---|---|---|---|---|
| 75 | `emp_attendance_calendar` | `/staff/attendance` | `src/features/employee` | B11 | Ported | |
| 76 | `emp_home` (punch screen) | `/staff/home` (tab) | `src/features/employee` | B11 | Ported | Face camera and registration are modals in the same feature |
| 77 | `emp_permission_calendar` | none | none | none | Dropped | Orphan with hard-coded mock data |
| 78 | `emp_personal_details` | `/staff/profile` | `src/features/employee` | B11 | Ported | |
| 79 | `emp_settings` | `/staff/settings` (tab), `/staff/permissions`, `/staff/more` | `src/features/employee` | B11 | Ported | Manager shortcuts match the admin permission names exactly (contract test) |

### 12 Employee requests and expenses

| # | v1 screen | Route | Feature | Builder | Status | Notes |
|---|---|---|---|---|---|---|
| 80 | `emp_device_change_request` | `/device-change-request` (pre-login) and `/staff/requests/device-change` (in-app) | `src/features/requests/staff` | B12 | Ported | One screen, two routes, mode by the `userId` param |
| 81 | `emp_expenses_add` | `/staff/expenses` | `src/features/expenses/staff` | B12 | Ported | |
| 82 | `emp_leave_request` | `/staff/requests/leave` | `src/features/requests/staff` | B12 | Ported | |
| 83 | `emp_odo_meter_reading` | `/staff/expenses/odometer` | `src/features/expenses/staff` | B12 | Ported | |
| 84 | `emp_other_bills` | `/staff/expenses/bills` | `src/features/expenses/staff` | B12 | Ported | Shared `ExpenseUploadScreen` |
| 85 | `emp_permission_request` | `/staff/requests/permission` | `src/features/requests/staff` | B12 | Ported | |
| 86 | `emp_request` (hub) | `/staff/requests` | `src/features/requests/staff` | B12 | Ported | |
| 87 | `emp_shift_change_request` | `/staff/requests/shift-change` | `src/features/requests/staff` | B12 | Ported | |
| 88 | `emp_travel_tickets` | `/staff/expenses/travel` | `src/features/expenses/staff` | B12 | Ported | Shared `ExpenseUploadScreen` |

### Dropped screens at a glance

| v1 screen | Reason |
|---|---|
| `add_department` | Orphan duplicate of `dept_add` |
| `other_apps` | Promotes other products by name |
| `payslip_template` | Orphan that calls non-existent endpoints |
| `track_location` | Orphan, superseded by `staff_location` |
| `emp_permission_calendar` | Orphan with mock data |

## 2. Shared components and systems of the v1 set

| v1 shared item | Where it lives now |
|---|---|
| `ChatMessageBubble` | `src/features/chat/components/MessageBubble.tsx` |
| `ConfirmationModal` | `useConfirm` and `ConfirmDialog` in `src/components/ui/ConfirmDialog.tsx` |
| `CustomToast` | `ToastProvider` in `src/components/ui/Toast.tsx` (one global host) |
| `FaceRecognition`, `FaceRegistration` | `src/features/employee/components/FaceRecognitionModal.tsx`, `src/features/employee/components/FaceRegistrationModal.tsx` |
| `LoadingModal` | `LoadingOverlay` in `src/components/ui/LoadingOverlay.tsx` |
| `OTPInput` | `src/components/ui/OTPInput.tsx` |
| `PermissionOnboarding`, `RateAppModal` | `src/components/overlays/` |
| `SearchableDropdown` | `Select` in `src/components/ui/Select.tsx` |
| `SplashScreen` | `src/components/layout/BrandSplash.tsx` |
| `UnifiedBottomNavigationBar` | `src/components/layout/TabBar.tsx` and `src/components/layout/SidebarNav.tsx` |
| `view_staff_details` (staff detail panel) | `/admin/staff/detail`, `src/features/staff-directory/screens/StaffDetailScreen.tsx` |
| auth and session, navigation, push, badges and realtime, plan gating, location tracking | `src/store/auth.ts`, `src/components/layout/` (`Bootstrap.tsx`, `bootstrap/`), `src/lib/realtime/`, `src/config/plans.ts`, `src/lib/platform/` (`docs/ARCHITECTURE.md`) |
| caching and preload (`*_need_refresh` flags, JSON route params) | TanStack Query keys in `src/lib/query/queryKeys.ts` and invalidation after mutations (no flags) |
| date, time and formatting | `src/lib/datetime.ts`, `src/lib/format.ts` (IST business time) |
| permissions and onboarding | `src/lib/platform/permissions.ts`, `src/components/overlays/` |
| app update, rate prompt, Meta events | `src/components/layout/bootstrap/UpdatePrompt.tsx`, `src/lib/rateApp.ts`; the vendor event SDK is not ported: the five marketing events (`AppOpened`, `LoginSuccess`, `CompleteRegistration`, `AttendanceMarked`, `Subscribe`) go through a provider interface whose default is a no-op (`src/lib/platform/analytics.ts`, `setAnalyticsProvider` plugs an SDK in); attribution is posted by `src/api/attribution.ts` |
| app config and build | `app.config.ts`, `.env.example`, `src/config/env.ts` |
| responsive and layout utilities | `src/components/layout/` (`useBreakpoint`, `ResponsiveRow`, `AppShell`) |

## 3. Additions that were not in v1 (for the product owner to review)

Everything here is new behaviour or UI. Items that merely fix a v1 defect are in `docs/FIXES_APPLIED.md` and are not repeated. The last column is the question to settle.

| # | Addition | Where | Source | Question for the owner |
|---|---|---|---|---|
| 1 | **Appearance setting** (Light, Dark, System) and a full dark theme | Admin Settings card, staff Settings row, web sidebar; `src/theme/` | B5 deviations; Q4d-B R14 | Keep the manual override? Default to System? |
| 2 | **Web and desktop target**: sidebar shell from 1100 px and on tablets, two-column forms and card lists, master and detail chat, Leaflet maps, print-to-PDF | `src/components/layout/AppShell.tsx`, `src/lib/platform/*.web.*` | F3b; B3b; B9a | Is the web app a supported product surface or only a convenience? |
| 3 | **"Change number" and "Change email" links** on the OTP steps of login and registration, and a "Change" action on the company OTP | `src/features/auth`, `src/features/company` | B1 deviations; B4 | Replace by a real resend with cooldown (DD-37)? |
| 4 | **Overview tab** (details and a month snapshot of present, late, half, absent and leave) and an **Active switch** on staff detail; default tab is Calendar | `src/features/staff-directory/components/detail/OverviewTab.tsx` | B3a deviations | Keep the Active switch on the detail screen? |
| 5 | **Add buttons** in the Branch and Department list headers and empty-state actions (v1 added from home) | `src/features/org-structure/screens` | B3b deviations | none |
| 6 | **Per-date status chips** (read only) on admin leave requests | `src/features/requests/admin` | B8 | Needed for per-date actions (DD-91)? |
| 7 | **New confirmation dialogs**: approve or reject of odometer, ticket and bill; Pay All and Pay Selected; unassign staff from a shift; delete a lead category; delete a chat; delete a saved report (also deletes its file) | features named in the logs | B8; B7; B4; B10; B9a | Copy approval |
| 8 | **Retry affordances**: error states with Retry on every list, pull-to-refresh (and a refresh button on web), "Retry verification" after a payment, "Retry photo upload" for expenses, Retry and Discard on failed chat messages | across features | B5; B12; B9a | none |
| 9 | **Unsaved-changes dialog** with Exit, Save and Keep editing on staff edit and personal details | `src/features/org-structure`, `src/features/employee` | B3b; B11 | none |
| 10 | **Permissions screen**: a fourth permission (photos), explicit grant buttons, summary count | `src/features/settings/screens/PermissionsScreen.tsx` | B5 deviations | none |
| 11 | **Odometer rate hint** "Saved as ₹4 per km (whole rupees only)" and the whole-rupee rule | `src/features/expenses/admin` | B8 | Allow paise rates (DD-92, `backend_changes.md` P2-4)? |
| 12 | **Holiday rules**: duplicate protection (same name, scope and date), grouping by name, scope and policy, an "Add Dates" action | `src/features/team-rules` | B4 deviations | Duplicate rule on the server too? |
| 13 | **Manager form**: Select all departments, at least one department required | `src/features/team-rules/screens/ManagerEditScreen.tsx` | B4 | Server semantics (DD-54) |
| 14 | **Shift rules**: 18-hour pre-check with the backend's explanation; delete warns that staff on the shift are unassigned | `src/features/team-rules` | B4 | none |
| 15 | **Saved-report history cap of 50** with file deletion, "File no longer available" markers, Share in both hubs | `src/features/reports/utils/history.ts` | B7 | Cap size |
| 16 | **Chat extras**: scroll-to-latest button, in-chat search, IST date separators, unread cap 99+, Enter sends on web, per-group themes persisted | `src/features/chat` | B9a | none |
| 17 | **Staff Settings shortcuts** for Holiday Management and Company Settings (no-ops in v1), Profile Settings wired | `src/features/employee/screens/StaffSettingsScreen.tsx` | B11 | Managers get these rows only with the matching permission (contract tested) |
| 18 | **CRM**: violet "Carry Forward Requested" card driven by the employee's own request, a toast that new employee leads were sent to the admin, CRM tab badge refreshed every 5 minutes | `src/features/crm` | B10 | Carry-forward lifecycle (DD-94) |
| 19 | **Employee home**: modern layout, birthday popup once per day, request badge consulting the request calendar, face registration with all four thumbnails and a 3-attempt cap | `src/features/employee` | B11 | none |
| 20 | **Staff chat hub company logo** | `src/features/chat/screens/hub` | Q4d-D | none |
| 21 | **Update and rate prompts**: neutral store wording, update check at most every 10 minutes, rate prompt once per mount and only with a configured store URL | `src/components/layout/bootstrap/UpdatePrompt.tsx`, `src/lib/rateApp.ts` | F3b; F4 | Store URLs (`backend_changes.md` C-9) |
| 22 | **Dev-only UI gallery** `/dev/ui-kit` (redirects outside development) | `src/app/dev/ui-kit.tsx` | Q5 | Remove before store release? |
| 23 | **Platform extras**: Map and Satellite toggle (staff location, branch picker), reverse geocoding of the branch address on web via a public service | `src/lib/platform/maps`, `src/lib/platform/geocode.ts` | B3b; B8 | Own geocoding proxy (`backend_changes.md` P2-14) |
| 24 | **Configuration-driven links**: support and sales e-mails, privacy policy, web portal and store URLs come from environment variables and the UI hides itself when unset | `src/config/env.ts` | B5 | Owner must supply values (`backend_changes.md` section 6) |
| 25 | **Invoices**: explicit Delete row, amount shown on cards, per-organisation downloaded registry | `src/features/billing/screens/InvoicesScreen.tsx` | B5 | none |
| 26 | **Subscription**: FREE TRIAL badge for the whole trial; mode badges NEW PLAN, ADD STAFF and RENEWING | `src/features/billing` | B5 | none |
| 27 | **Notification routing**: role-aware tap targets with `userId` and `groupId` deep links, held until the navigator is ready | `src/lib/platform/notificationRouting.ts`, `src/components/layout/bootstrap/notificationGlue.ts` | F3b; B9a | none |
| 28 | **Staff roster**: live status badge on each row (computed but never rendered in v1) | `src/features/staff-directory/components/StaffRosterRow.tsx` | B3a | none |
| 29 | **Accessibility and quality baseline**: labelled controls, 44 px touch targets, WCAG contrast tokens, web keyboard support | `src/components/ui`, `src/theme/` | Q5 | Border contrast decision (DD-102) |
| 30 | **End-to-end suite and mock backend** (web, Playwright) | `e2e/` (`e2e/README.md`) | Q5; tooling | none |
