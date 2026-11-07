# Routes, screen ownership & spec map

`Spec` = file under `../project_complete_context/pages/` (read it fully before building; §13 lists what to fix/not port; §14 is the acceptance checklist). `Shared` specs are under `../project_complete_context/shared/`. Route constants live in `src/config/routes.ts`.

Route files go in `src/app/<path>.tsx` (tab roots in `src/app/{admin,staff}/(tabs)/<name>.tsx`; screens that have a sub-path and a list use `.../index.tsx`). A route file only re-exports the screen: `export { default } from '@/features/<feature>/screens/XScreen';`.

**Builder ids** (B1…B12) own the screens in their row and write their change log to `docs/changes/<id>.md`.

## Public / auth
| v1 screen | New route | Feature dir | Spec | Builder |
|---|---|---|---|---|
| index | `/` (welcome) | features/auth | 00_entry_auth/index | B1 |
| admin_login | `/admin-login` | features/auth | 00_entry_auth/admin_login | B1 |
| emp_login | `/staff-login` | features/auth | 00_entry_auth/emp_login | B1 |
| client_register | `/register` | features/auth | 00_entry_auth/client_register | B1 |
| emp_device_change_request | `/device-change-request` (pre-login) **and** `/staff/requests/device-change` (in-app) | features/requests | 12_employee_requests_expenses/emp_device_change_request | B12 |

## Admin (`/admin/*`, roles 1 & 2)
| v1 screen | New route | Feature dir | Spec | Builder |
|---|---|---|---|---|
| home | `/admin/home` (tab) | features/dashboard | 01/home | B2 |
| overview | `/admin/overview` | features/dashboard | 01/overview | B2 |
| all_Staff | `/admin/staff` | features/staff-directory | 01/all_Staff | B3a |
| (staff detail panel) | `/admin/staff/detail` | features/staff-directory | shared/components/view_staff_details | B3a |
| add_staff | `/admin/staff/edit` | features/org-structure | 02/add_staff | B3b |
| all_Branch / add_branch | `/admin/branches`, `/admin/branches/edit` | features/org-structure | 02/all_Branch, 02/add_branch | B3b |
| dept_all / dept_add | `/admin/departments`, `/admin/departments/edit` | features/org-structure | 02/dept_all, 02/dept_add | B3b |
| assign_devices | `/admin/devices` | features/org-structure | 02/assign_devices | B3b |
| all_Company / add_company | `/admin/company`, `/admin/company/edit` | features/company | 03/all_Company, 03/add_company | B4 |
| manager_settings / add_manager | `/admin/managers`, `/admin/managers/edit` | features/team-rules | 03/manager_settings, 03/add_manager | B4 |
| shift_settings | `/admin/shifts` | features/team-rules | 03/shift_settings | B4 |
| attendance_rule | `/admin/attendance-rule` | features/team-rules | 03/attendance_rule | B4 |
| holiday_management | `/admin/holidays` | features/team-rules | 03/holiday_management | B4 |
| settings | `/admin/settings` (tab) | features/settings | 04/settings | B5 |
| support hub / Video Hub | `/admin/help` (tab), `/admin/help/videos` | features/help | new in Clockyn (no v1 page) | - |
| beyond (live parts) | `/admin/more`, `/admin/permissions` | features/settings | 04/beyond, 04/settings | B5 |
| support / suggest_feature | `/admin/support`, `/admin/suggest-feature` | features/settings | 04/support, 04/suggest_feature | B5 |
| other_apps | **dropped** (cross-promotes other products by name) | – | 04/other_apps | – |
| subscription / upgrade_plan / payment_summary / invoices | `/admin/billing`, `/admin/billing/upgrade`, `/admin/billing/checkout`, `/admin/billing/invoices` | features/billing | 04/… | B5 |
| monthly_fixed / add_payslip | `/admin/payroll/payslips`, `/admin/payroll/payslips/edit` | features/payroll | 05/monthly_fixed, 05/add_payslip | B6 |
| daily_wages, hourly_charges, overtime, bonus, count_basis, turnover | `/admin/payroll/{daily-wages,hourly,overtime,bonus,count-basis,turnover}` | features/payroll | 05/… | B6 |
| incentive | `/admin/payroll/incentive` | features/payroll | 05/incentive | B6 |
| payslip_template | **dropped** (orphan) | – | 05/payslip_template | – |
| monthly_salary / view_staff_salary | `/admin/payroll/monthly-salary`, `/admin/payroll/salary-sheet` | features/reports | 06/monthly_salary, 06/view_staff_salary | B7 |
| reports + 6 report screens | `/admin/reports`, `/admin/reports/{monthly-attendance,staff-detailed,late,overtime,employee-details,employee-shifts}` | features/reports | 06/… | B7 |
| monthly_report (manager variant) | `/staff/reports` | features/reports | 06/monthly_report | B7 |
| requests + 4 admin_*_requests | `/admin/requests{,/leave,/permission,/shift-change,/device-change}` | features/requests | 07/… | B8 |
| odometer / travel_ticket / other_bills | `/admin/expenses/{odometer,travel,bills}` | features/expenses | 07/… | B8 |
| staff_location | `/admin/location` | features/location | 07/staff_location | B8 |
| track_location | **dropped** (orphan) | – | 07/track_location | – |
| chat (hub) | `/admin/chat` (tab) | features/chat | 08/chat | B9b |
| individual_chat / group_chat | `/admin/chat/direct`, `/admin/chat/groups` | features/chat | 08/individual_chat, 08/group_chat, shared/components/ChatMessageBubble | B9a |
| announcement / announcement_branch_dept | `/admin/chat/announcements`, `/admin/chat/announcements-targeted` | features/announcements | 08/announcement, 08/announcement_branch_dept | B9b |
| crm | `/admin/crm` (tab) | features/crm | 09/crm | B10 |
| assign_leads / enter_leads | `/admin/crm/leads`, `/admin/crm/leads/edit` | features/crm | 09/assign_leads, 09/enter_leads | B10 |

## Staff / manager (`/staff/*`, roles 2 & 3)
| v1 screen | New route | Feature dir | Spec | Builder |
|---|---|---|---|---|
| emp_home | `/staff/home` (tab) | features/employee | 11/emp_home (+ shared FaceRecognition, FaceRegistration) | B11 |
| emp_attendance_calendar | `/staff/attendance` | features/employee | 11/emp_attendance_calendar | B11 |
| emp_personal_details | `/staff/profile` | features/employee | 11/emp_personal_details | B11 |
| emp_settings | `/staff/settings` (tab) + `/staff/permissions`, `/staff/more` | features/employee | 11/emp_settings | B11 |
| support hub / Video Hub | `/staff/help` (tab), `/staff/help/videos` | features/help | new in Clockyn (no v1 page) | - |
| emp_permission_calendar | **dropped** (mock orphan) | – | 11/emp_permission_calendar | – |
| emp_crm | `/staff/crm` (tab) | features/crm | 09/emp_crm | B10 |
| emp_chat (hub) | `/staff/chat` (tab) | features/chat | 10/emp_chat | B9b |
| emp_personal_chat / emp_group_chat | `/staff/chat/direct`, `/staff/chat/groups` | features/chat | 10/… | B9a |
| emp_broadcast / emp_broadcast_targeted | `/staff/chat/broadcast`, `/staff/chat/targeted` | features/announcements | 10/… | B9b |
| emp_request + leave / permission / shift-change / device-change | `/staff/requests{,/leave,/permission,/shift-change,/device-change}` | features/requests | 12/… | B12 |
| emp_expenses_add + odo / travel / bills | `/staff/expenses{,/odometer,/travel,/bills}` | features/expenses | 12/… | B12 |

## Layout/route-file ownership
- F3 owns: `src/app/_layout.tsx`, `src/app/admin/_layout.tsx`, `src/app/admin/(tabs)/_layout.tsx`, `src/app/staff/_layout.tsx`, `src/app/staff/(tabs)/_layout.tsx`, `src/app/+not-found.tsx`, `AppShell`, tab bar.
- Builders own the route files of their screens only. Never edit another builder's files; if you need a change in shared code (`components/ui`, `lib`, `api`), make the minimal additive change and log it.
- Admin routes are also reachable by managers (role 2) via the staff Settings shortcuts (names must match `managerPermissions` strings exactly — see 11/emp_settings).
