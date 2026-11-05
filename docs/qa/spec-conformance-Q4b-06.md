# Spec-conformance audit Q4b — 06_admin_reports

Scope: `src/features/reports` (+ `src/api/{reports,salaryReports}.ts`, `src/lib/platform/{exporter,exportFormats,exportXlsx,fileNames,files,pdf}`) against the ten specs in `project_complete_context/pages/06_admin_reports` (reports, attendance_monthly_report, staff_detailed_report, late_report, overtime_report, employee_details_report, employee_shift_report, monthly_report (manager variant), monthly_salary, view_staff_salary). Every §14 acceptance bullet, §7 rule/formula, §8 copy item and §4 flow was traced to code; formulas were re-derived from the specs' worked examples and pinned with executed tests.

Status legend: `PASS` (code matches the spec), `DEVIATION-OK` (differs on purpose; FIX_POLICY section / B7 change-log entry cited), `GAP-fixed` (gap/bug found and fixed in this pass), `NEEDS-DECISION` (not changed; see the last section).

## Summary

| Status | Count |
|---|---|
| PASS | 130 |
| DEVIATION-OK | 54 |
| GAP-fixed | 8 (7 matrix rows + 1 performance fix without a spec row) |
| NEEDS-DECISION | 6 distinct items (11 matrix rows reference them) |

(Counts are of the rows in the tables below; one row may cover several near-identical bullets; three rows read "PASS / DEVIATION-OK" and are counted as PASS.)

Gaps fixed (details under "Fixes made"):
1. Late report shift times that already carry AM/PM were re-formatted (`09:00AM` -> `09:00 AM`); spec says displayed unchanged.
2. Late report "Punch In" showed `--:--` when the server sent an ISO timestamp (the minutes were derived but the cell was not).
3. Employee-shift screen did not show the company name sub-title.
4. Employee-shift list could double-count / duplicate-key a repeated staff id (spec lists it as a defect).
5. A permission / shift-change request with no stored request-level status was counted by the status *derived* from its per-date decisions instead of "pending" (spec §7: missing = pending).
6. Working-days request sent `-` as branch / department filter (v1 guarded against it).
7. Saved-report history on the web kept two entries when the same file name was exported twice (every export is a new blob URL, so the "same file" dedupe never fired).
8. The N+1 reports (staff detailed, late, shifts) re-ran every time the browser window regained focus (for example after closing the print dialog of the web PDF export).

## 1. reports (hub) + 8. monthly_report (manager variant)

| Item | Status | Evidence / fix |
|---|---|---|
| Hub opens on Generate tab with 4 category cards in order (Attendance, Salary, Employee, CRM) | PASS | `utils/catalogue.ts:27-65`, `components/ReportsHub.tsx` (default tab `generate`); test `salaryAndProfile.test.ts` "report catalogue" |
| Enabled admin rows = Monthly Summary, Staff-wise Detailed, Late, Overtime, Monthly Salary, View Staff Salary, Employee Details, Employee Shift / Timing; routes correct | PASS | `catalogue.ts` + `routeFor`; `ReportCatalogue.tsx:29` |
| Placeholder rows (Incentives, Loss of Pay, Reimbursement, Previous Employees, Employees Salary Structures, Meeting/Travel/Expense Report) are greyed and untappable | PASS | `ReportCatalogue.tsx:27-33` (`disabled`, muted text, no chevron) |
| Row labels / category titles verbatim (§8) | PASS | `catalogue.ts` |
| Header "Reports" + company name only when non-empty | PASS | `ReportsHub.tsx` `subtitle={session?.orgName \|\| undefined}` |
| Company logo in header / business icon fallback | DEVIATION-OK | New app shell header has no logo slot; B7 "Company logo is not embedded" (CONVENTIONS design-system) |
| Tabs "Generate" / "View Reports" | PASS | `ReportsHub.tsx:15-18` |
| Empty history: "No reports yet" + "Generated reports will appear here. Go to Generate tab to create one." | PASS | `SavedReportList.tsx:44-49` |
| History card: name + date/time (`dd Mon yyyy, hh:mm AM`) in IST | PASS | `SavedReportList.tsx` `formatDateTime` (IST); FIX_POLICY B1 |
| Newest first, stored order | PASS | `history.ts addToHistory` prepends |
| Reload history when the screen regains focus on the View tab and when the tab opens | PASS | `useSavedReports.ts` `useFocusEffect` |
| History loading indicator (v1 none) | DEVIATION-OK | FIX_POLICY B8 / spec §13(g) |
| Tap card: open in in-app WebView viewer with Share button | DEVIATION-OK | B7 "Deviations": real files open via OS viewer (PDF) or share sheet (other formats); spec §13(a)(b) fix list |
| Viewer close / hardware back closes viewer | DEVIATION-OK | No in-app viewer (above) |
| Missing file -> error "Could not open report." | PASS | `useSavedReports.ts` (entry flagged "File no longer available", toast on tap; `openFile` error -> `Could not open report.`) |
| Share icon -> OS share sheet with dialog title = report name, real mime | PASS | `useSavedReports.ts share` (spec §13(b) fixed) |
| Share unavailable -> "Sharing is not available on this device." | PASS | `files.native.ts shareFile` throws that text, shown as toast (FIX_POLICY B2: no `Alert.alert`) |
| Delete: confirm "Delete Report", Cancel / Delete, persists | PASS | `useSavedReports.ts remove`, `history.ts deleteSavedReport` |
| Delete confirm message "Remove this report from the list?" | DEVIATION-OK | B7 "Remove this report from the list and delete its file?" (file is now deleted too; spec §13(d)) |
| Delete also deletes the file; list capped (v1: never) | DEVIATION-OK | FIX_POLICY B9 / spec §13(d); cap 50 `history.ts:14`; tests `historyAndMonth.test.ts` |
| Hardware back: View -> Generate -> leave | PASS | `ReportsHub.tsx` `useHardwareBack` |
| History scoped by org, entry stores real mime/extension (not `pdf`) | PASS | `history.ts historyKey`, `useReportExport.ts`; test `historyAndMonth.test.ts` "records real mime/extension entries per org" |
| Same-file re-export replaces the older entry | GAP-fixed | `history.ts addToHistory` now also matches by file name (web blob URLs differ per export); test `specConformance.test.ts` "saved-report history (web blob URLs)" |
| Orphaned file never deleted while still referenced | PASS | `history.ts orphanedFiles`; test "replaces an older entry that points at the same file" |
| Concurrent exports never lose entries | PASS | `history.ts serialised`; test "serialises concurrent exports" |
| Bottom nav admin / role tabs, no tab highlighted | DEVIATION-OK | App shell owns navigation (ROUTES.md "Layout ownership", spec §13(f)) |
| Manager: exactly 4 rows enabled (Monthly Summary, Late, Monthly Salary, View Staff Salary); all others greyed | PASS | `catalogue.ts managerEnabled`; test "enables exactly 4 rows for the manager variant"; screen test `ManagerReportsScreen` |
| Manager hub gated by "Attendance Reports" permission (and role 2) | PASS | `ManagerReportsScreen.tsx` (deep link also re-checked; spec only gated the Settings row) |
| Manager hub history: open (PDF viewer) / delete with confirm | PASS | shared `SavedReportList` |
| Manager hub has no share button (v1) | DEVIATION-OK | Share shown in both variants (spec §13(a) "merge into one screen"); no product risk |
| Manager hub rows use `navigate` vs `push` | DEVIATION-OK | spec §13(c) calls the inconsistency a defect; `router.push` everywhere |
| Manager: downstream screens are org-wide (`getAllStaff(orgId)`) | NEEDS-DECISION | N-1 |
| Staff (role 3) never reaches the manager hub | PASS | `ManagerReportsScreen.tsx` role check |

## 2. attendance_monthly_report (server PDF)

| Item | Status | Evidence / fix |
|---|---|---|
| Title "Monthly Report", info card text, section titles "Select Staff" / "Select Period" | PASS | `MonthlyAttendanceReportScreen.tsx:77-107` |
| Generate button "Generate & View PDF" (emoji dropped) | DEVIATION-OK | spec §13(f) glyph text |
| Staff button "All Staff" / `<name>  (<emp_id>)` (two spaces) + dept sub-line | PASS | `MonthlyAttendanceReportScreen.tsx:66-67` |
| Picker: "Select Staff", placeholder "Search by name or ID...", All Staff row ("Generate reports for all staff"), "No staff found" | PASS | `StaffPickerSheet.tsx` |
| Search is case-insensitive substring over name and emp id; cleared on reopen | PASS | `useReportStaffOptions.ts filterOptions`; `StaffPickerSheet.tsx close()` |
| Picker de-duplicated by user id (first wins) | PASS | `useReportStaffOptions.ts dedupeOptions` |
| Admin all staff -> `/api/reports/monthly-attendance-all/{org}/{YYYY-MM}`, file `attendance_all_{YYYY-MM}.pdf` | PASS | `api/reports.ts resolveAttendanceReport`; `api/__tests__/reportsPlansBilling.test.ts` |
| Single staff -> `/api/reports/monthly-attendance/{user_id}/{YYYY-MM}`, `attendance_{emp_id}_{YYYY-MM}.pdf` | PASS | same |
| Manager all -> `/api/reports/manager/{id}/monthly-attendance-all/{YYYY-MM}`; manager team member -> manager single; self -> plain single | PASS | same |
| Manager picker: "(Me)" first then team, duplicates removed; "Manager (Me)" when no name | PASS | `useReportStaffOptions.ts:40-47`; screen test "uses the manager endpoint and lists the manager first as (Me)" |
| Manager "(Me)" name via session instead of an extra `/addstaff` fetch; emp id = user id | DEVIATION-OK | B7 "Manager (Me) entry uses the session name"; spec §13(h) |
| Staff list: admin includes inactive staff (shown with "Inactive") | PASS | spec §7 admin picker contents; `StaffPickerSheet.tsx` |
| Year range current-5 ... current+4 computed per render in IST; defaults current month | PASS | `monthRange.ts yearRangeFor('attendancePdf')`; test "computes selectable years in IST" |
| Month/year as picker (v1 dropdown modals) | DEVIATION-OK | B7 "Month/year selection uses MonthYearPicker" |
| Success only on a real download; error body never kept as a report (v1 kept it) | PASS | `files.native.ts downloadAndOpen` deletes partial file; `files.ts` `!res.ok` throws |
| Non-200: error "Server returned <status>", no history entry | DEVIATION-OK | web path throws `Server returned <status>`; native throws the library message; shown as toast (FIX_POLICY B2, no `Alert.alert`) |
| History entry `All Staff — <Month> <Year>` / `<name> — <Month> <Year>`, real mime `application/pdf`, written before the viewer opens | PASS | `MonthlyAttendanceReportScreen.tsx:40-50`; screen test |
| Viewer failure does not undo the history entry (toast only) | PASS | `MonthlyAttendanceReportScreen.tsx:51-56` |
| Generate disabled + spinner while generating; guarded against missing org id | PASS | `:73` (`loading`, `disabled={generating \|\| !staff.orgId}`) |
| Offline -> error message, button re-enables | PASS | `useAsyncAction` try/catch/finally |
| Staff-list load failure shows error with retry (v1 silent) | DEVIATION-OK | FIX_POLICY B2 |
| Android opens VIEW intent / iOS share sheet / web new tab | PASS | `files.native.ts openFile`, `files.ts openFile` |
| PDF endpoints fetched without auth headers (as v1) | NEEDS-DECISION | N-5 |
| Manager "All Staff" PDF is org-wide on the backend | NEEDS-DECISION | N-1 (B7 Deferred) |

## 3. staff_detailed_report

| Item | Status | Evidence / fix |
|---|---|---|
| Title "Staff Detailed Report", company name, month chip, `{n} staff` | PASS | `StaffDetailedReportScreen.tsx:76-86` (picker replaces chips: DEVIATION-OK, B7) |
| Loading caption "Fetching staff & requests..." then "Loading attendance... (x/N)" in steps of 5 | PASS | `reportLoaders.ts:78-91`, `api/reports.ts loadMonthlyAttendanceBatched`; test `reportLoaders.test.ts` captions |
| Rows sorted A->Z by name | PASS | `reportLoaders.ts byName`; test "builds sorted rows" |
| 17 data columns in 4 groups 8/3/3/3 with exact labels; frozen Employee column (avatar, name, `emp_id · role`, branch) | PASS | `staffDetailed.ts:127-146`; test "has 17 data columns in 4 groups" |
| Zero / `0h` dimmed, other values in column colour | PASS | `staffDetailed.ts isDimmedValue`, screen `useColumns` |
| Frozen column + synced vertical scroll | DEVIATION-OK | shared `DataTable` (single scroll container, no JS sync); BUILDER_BRIEF §3 |
| Absent = max(0, working - present - approved leave dates): 26/20/3 -> 3, negative -> 0 | PASS | `attendanceMath.ts:48`; tests `attendanceMath.test.ts`, `specConformance.test.ts` |
| Leave per DATE in month: {10-03 approved, 10-04 rejected, 11-01 approved} -> 1/1/0 and Leave column 1 | PASS | `attendanceMath.ts:108-117`; test "request counters for a month" |
| Permission counted once per request when any date key is in the month, request-level status | PASS | `attendanceMath.ts:119`; tests |
| Shift change counted by `shift_change_date` in month, request-level status | PASS | `attendanceMath.ts:121` |
| Missing / unknown status counts as pending | GAP-fixed | `requestLevelStatus` fell back to the DTO status (derived from date decisions) when the request carried no stored status; now pending. Test `specConformance.test.ts` "a request without a request-level status counts as pending" |
| Half Day = count of `half_day` days (backend never emits it -> 0) | PASS | `attendanceMath.ts countHalfDays`; test |
| Hrs Worked: "08:30" on two days -> `17h 0m`; none -> `0h`; decimal "8.50" no longer truncated | PASS | `attendanceMath.ts dayHours/totalWorkedMinutes`; tests (decimal 7.75 + 8.5 = `16h 15m`, HH:MM, rounding once) |
| Present/late taken from backend summary (present includes late) | PASS | `staffDetailed.ts:60-66` |
| Working days from the API once per branch+department (cached), fallback days minus Sundays | PASS | `reportLoaders.ts fetchWorkingDays`; tests (once per combo, fallback 27 for Oct 2026) |
| Working-days filters: `-`/empty branch or dept never sent | GAP-fixed | `reportLoaders.ts fetchWorkingDays`; test "never sends an empty or '-' branch / department" |
| Sundays = calendar Sundays (pure date math, IST) | PASS | `monthRange.ts reportMonth`; tests (Oct 2026 = 4, leap Feb) |
| Role label Manager (role 2) / Employee | PASS | `staffDetailed.ts roleLabel` |
| Branch / dept `-` default | PASS | `staffDetailed.ts:58-59` |
| Requests API failure: screen still loads, request columns 0 | DEVIATION-OK | loads with 0s plus a warning banner (FIX_POLICY B2 / B7 "Silent failures"); test "falls back ... warnings" |
| Staff API failure: error, spinner stops, no stale rows | DEVIATION-OK | error state with retry instead of toast "Failed to load report data" (B7 "Stale rows after a failed reload"); screen test |
| Years offered current-2 ... current+3; reload on change; keys scoped by org+period | PASS | `monthRange.ts yearRangeFor`, `useReportQueries.ts` |
| Empty: "No data" / "No staff found for {Month} {year}" | PASS | `StaffDetailedReportScreen.tsx:96` |
| Export sheet "Export Report": PDF, DOC, Excel, CSV in order, "Download as ..." | PASS | `ExportSheet.tsx`, `exportLabels.ts` |
| CSV: file `staff_report_{Mon}_{year}.csv`, 22 headers, mime text/csv, BOM + RFC-4180 | PASS | `STAFF_DETAILED_EXPORT_COLUMNS`; tests `exportContents.test.ts` (BOM, doubled quotes, formula neutralised), `overtimeAndExport.test.ts` |
| Excel: real `.xlsx` (v1 HTML-as-.xls) | DEVIATION-OK | FIX_POLICY B9; test `exportContents.test.ts` "xlsx: a real workbook" |
| PDF: real PDF (native expo-print / web print dialog), title + company | DEVIATION-OK | FIX_POLICY B9; B7 (no logo, no file on web); test "PDF and DOC" |
| DOC `.doc` / application/msword, heading | DEVIATION-OK | heading = title + subtitle (B7 "DOC/PDF heading is the report title with the month in the subtitle") |
| Export values HTML-escaped | PASS | `exportFormats.ts escapeHtml`; test (script tag escaped) |
| History entry `Staff Report {Mon} {year} ({CSV\|Excel\|PDF\|DOC})` with REAL mime, after success only | PASS | `useReportExport.ts:44-56`, `exportLabels.ts historyName` |
| Export failure: error + no history entry | DEVIATION-OK | toast with matching "Failed to ..." fallback (`exportFailureMessage`) instead of `Alert.alert` (FIX_POLICY B2) |
| Blocking overlay while exporting: "Preparing file..." (v1 "Preparing Excel...") | DEVIATION-OK | spec §13(b) |
| Export disabled while loading / zero rows | DEVIATION-OK | spec §13(h) |
| Logo cannot be downloaded -> export still succeeds | DEVIATION-OK | no logo embedded (B7) |
| Back chevron returns | PASS | `Screen` back |

## 4. late_report

| Item | Status | Evidence / fix |
|---|---|---|
| Title, org name, month, `{n} late entries` pill (incl. `0 late entries`) | PASS | `LateReportScreen.tsx:78-84` |
| Captions "Fetching staff...", "Loading attendance... (x/N)" steps of 5 | PASS | `reportLoaders.ts:132-141` |
| Late when status `late` OR punch-in > shift start + 1 min (1-min tolerance); any status qualifies via time | PASS | `lateRule.ts:90-97`; tests (09:12 late, 09:01 not, 09:02 late) |
| Late minutes = full difference (no grace); 12 min -> `12 min`, 75 -> `1h 15m`, 60 -> `1h 0m` | PASS | `lateRule.ts:63-67`; tests incl. new spec example 10:15 vs 09:00 = 75 |
| Shift times "09:00AM"/"06:00PM" shown unchanged; "09:00:00"/"18:00:00" -> "09:00 AM"/"06:00 PM" | GAP-fixed | `displayShiftTime` always re-formatted (`09:00AM` -> `09:00 AM`); now unchanged when AM/PM present. Tests `lateRule.test.ts` |
| Punch In cell `hh:mm AM`, `--:--` when missing; ISO timestamps read in IST | GAP-fixed | the cell ignored ISO punch-ins (`--:--` while the minutes were known); `lateRule.ts punchDisplay`; test "formats 24h shift times ... ISO punch-ins in IST" |
| Date shown `DD-Mon-YYYY` | PASS | `lateRule.ts:120` |
| Sort by real date then name (v1: by label string) | DEVIATION-OK | spec §13(b); test "sorted chronologically" |
| Branch / Dept `-` defaults; 9 export headers `Name, Emp ID, Branch, Dept, Date, Shift Start, Shift End, Punch In, Late By` | PASS | `lateRule.ts:136-146`; test "maps the 9 export columns" |
| Shift columns / Late By when the server sends no shift times: `-` + bogus punch-clock duration (v1) | DEVIATION-OK | B7: `—` plus explanatory note (spec §7 correction calls v1 output "wrong, misleading"; §13 backend need) |
| Staff scope: everyone incl. inactive / managers, no dedupe | PASS | `reportLoaders.ts:134` (ids de-duplicated only for the request fan-out) |
| Staff list failure: error state; attendance failures per staff: warning (v1 silent) | DEVIATION-OK | FIX_POLICY B2; test `loadLateReport` |
| Empty: "No late entries" / "All staff were on time in {Month} {year}" | PASS | `LateReportScreen.tsx:99` |
| Export CSV/Excel/PDF/DOC, history `Late Report {Mon} {year} (...)` real mime, file `late_report_{Mon}_{year}.*` | PASS / DEVIATION-OK | as staff detailed (real formats, B9) |
| Late definition without grace period from attendance rules | NEEDS-DECISION | N-3 (FIX_POLICY C) |
| Late shift times not provided by the backend | NEEDS-DECISION | N-2 |

## 5. overtime_report

| Item | Status | Evidence / fix |
|---|---|---|
| Month chip, "Loading..." caption, table | PASS | `OvertimeReportScreen.tsx:109` |
| OT row (150 min, 3 days, Rs 900) -> `3`, `2h 30m`, `₹900` bold coloured + `OT` badge | PASS | `OvertimeReportScreen.tsx:34-48`, `overtime.ts`; test `specConformance.test.ts` |
| No OT -> `—` grey, no badge; Branch / Department grey in every row | PASS | `OvertimeReportScreen.tsx:24-33` |
| 45 min -> `45m`, 120 -> `2h`, 125 -> `2h 5m` | PASS | `overtime.ts` via `formatDurationMinutes`; test "sorts by overtime minutes desc then name" |
| Staff list drives rows (inactive included); OT of unknown users dropped | PASS | `overtime.ts mergeOvertime`; test |
| Sort by OT minutes desc then name | PASS | `overtime.ts:48`; test |
| Pill `{N} with OT` | PASS | `OvertimeReportScreen.tsx:102` |
| Amount `₹` + locale-independent grouping, shown even for non-OT rows when non-zero | PASS | `overtime.ts formatOtAmount`, `OvertimeReportScreen.tsx:56-62` (v1 used device-locale `toLocaleString`: spec §13(c) fix) |
| Branch/dept default em dash `—` | PASS | `overtime.ts:33-34` |
| OT API `success:false` / error body: rows kept with `—` | DEVIATION-OK | visible warning banner (spec §13(a), FIX_POLICY B2); test "shows rows with a visible warning" |
| Staff API / network failure | DEVIATION-OK | error state with retry; text `Failed to load overtime report` is the fallback message |
| Empty: "No staff found" / "No data for {Month} {year}" | PASS | `OvertimeReportScreen.tsx:116` |
| 7 export headers; `OT Days` exported as `—` when no OT (v1 raw 0) | DEVIATION-OK | spec §13(h) fix; B7 |
| Export formats, history `Overtime Report {Mon} {year} (...)`, file `overtime_report_{Mon}_{year}.*` | PASS / DEVIATION-OK | as above (real formats) |
| Overtime endpoint not routed in the backend snapshot | NEEDS-DECISION | N-2 |

## 6. employee_details_report

| Item | Status | Evidence / fix |
|---|---|---|
| Directory sorted A->Z with `{N} staff`; skeleton while loading | PASS | `EmployeeDetailsReportScreen.tsx:215-230`, `employeeProfile.ts filterDirectory` |
| Search over name, emp id, dept, branch (any case), live; clear restores | PASS | `filterDirectory`; test "searches name, id, department and branch" |
| "No employees found" | PASS | `EmployeeDetailsReportScreen.tsx:223` |
| Staff list failure | DEVIATION-OK | error state with retry (`Failed to load staff` fallback) |
| Card tap: "Loading details..." overlay then profile (name/id/chips + 4 sections) | PASS | `:101-119`, overlays `:147-152` |
| Empty or `-` fields hidden; empty sections dropped (v1 empty card) | PASS | `employeeProfile.ts hasValue/profileSections`; test |
| Profile failure toast "Failed to load employee details"; inactive staff cannot be opened | DEVIATION-OK | inactive staff get a friendly message (B7 "inactive staff profile errors"); the directory marks them "Inactive" |
| Section titles / field labels verbatim (Contact Information ... Bank Branch) | PASS | `employeeProfile.ts:34-60` |
| Dates (`dob`, `doj`) shown as returned | DEVIATION-OK | formatted `dd MMM yyyy` via `@/lib/datetime` (CONVENTIONS "never hand-format dates") |
| Detail back / Android back returns to the list; list back leaves | PASS | `:121-130`, `useHardwareBack` |
| Download sheet "Download as": PDF, DOC | PASS | `:166-181` |
| PDF: `{Name}_report.pdf` real PDF, application/pdf, history entry `{name} - Employee Report`, share, View | DEVIATION-OK | FIX_POLICY B9 (real PDF; unicode kept in names); View opens the saved PDF on native; on web the browser print dialog produces no file (B7 "Deviations") |
| DOC: `{Name}_report.doc`, application/msword | PASS | `exportHtml` (test `exportContents.test.ts`); history entry now also written (spec §13(f)) |
| Export error toast "Failed to export report"; blocking overlay "Preparing file..." | PASS | `:117-122`, fallback `exportFailureMessage` ("Failed to generate PDF" / "Failed to download DOC") |
| Sharing unavailable -> toast | DEVIATION-OK | platform layer wording "Sharing is not available on this device." (shared `files.native.ts`) vs v1 "Sharing not available on this device" |
| HTML omits empty sections, all values escaped | PASS | `employeeProfile.ts buildProfileHtml`; tests incl. new `exportContents.test.ts` (PDF/DOC seams) |
| In-app preview modal "Report Preview" + Share | DEVIATION-OK | B7 "No in-app HTML viewer/WebView" |
| Auth-null endless spinner | DEVIATION-OK | spec §13(b); session guard |
| Profile contains PII persisted in app files | NEEDS-DECISION | N-6 |

## 7. employee_shift_report

| Item | Status | Evidence / fix |
|---|---|---|
| "Loading shift data..." then Total Shifts / Assigned / Unassigned tiles | PASS | `EmployeeShiftsReportScreen.tsx:119-155` |
| 3 shifts, 20 staff, 15 valid shift ids -> 3 / 15 / 5 | PASS | `shiftReport.ts groupStaffByShift/assignedCount`; test `specConformance.test.ts` |
| Shift card `{start} – {end}  ·  {hours}` with real duration (9h; overnight 10PM-6AM = 8h; 8h 30m) | DEVIATION-OK | times normalised to `hh:mm AM` (spec §13(b) "normalise times"; the DTO mapper already converts them to 24h); duration test `salaryAndProfile.test.ts` |
| Cards start collapsed; header toggles only that card | PASS | `EmployeeShiftsReportScreen.tsx:107-111` |
| Expanded rows: avatar, name, id, dept, branch (empty dept/branch not rendered) | PASS | `StaffRow` (module level; v1 defined it inside render) |
| Expanded, nobody assigned, not searching: "No staff assigned to this shift"; searching: "No matching staff" | PASS | `emptyMessage` |
| Search filters inside cards only; counts and pills unchanged | PASS | `shiftReport.ts filterShiftStaff`; test |
| Failed detail request / unknown shift id -> Unassigned | PASS | `reportLoaders.ts loadShiftReport`; test "groups staff by shift id" |
| Unassigned card ("No shift assigned") shown only when non-empty | PASS | `:187-202` |
| No shifts: "No shifts created yet" + "Go to Settings → Shift Settings to create shifts" | PASS | `:166` |
| Shift API failure / 3 s timeout looks like "no shifts" (v1) | DEVIATION-OK | error state with retry (B7 "Employee shifts"; spec §13(c)) |
| Staff list failure -> `Failed to load shift data` | PASS | fallback message of the error state |
| Company name subtitle (§8 "Subtitle `{companyName}`") | GAP-fixed | screen had no subtitle; `EmployeeShiftsReportScreen.tsx` now passes `session.orgName` |
| Duplicate staff id double-counted / duplicate React key | GAP-fixed | `shiftReport.ts groupStaffByShift` skips repeated ids; test "a duplicated staff id is listed and counted once" |
| Inactive staff and managers included in lists and counts | PASS | no filter in `loadShiftReport` |
| N+1 `/addstaff/{id}` in batches of 5 | DEVIATION-OK | spec §13(a), B7 (unbatched in v1) |
| No export, no storage writes | PASS | screen has no export / history |
| Hardware back always pops | PASS | default navigation |
| Org-wide scope for managers | NEEDS-DECISION | N-1 |

## 9. monthly_salary

| Item | Status | Evidence / fix |
|---|---|---|
| Opens with staff loaded, "Loading employees..." caption; Total = staff, Paid 0 (when none paid), Unpaid = total, progress 0% | PASS | `MonthlySalaryScreen.tsx:158-180`, `monthlySalary.ts computePayTotals`; test |
| Counts over the de-duplicated list (v1 mixed raw and de-duplicated) | DEVIATION-OK | spec §13(d); `monthlySalary.ts dedupeByUserId` |
| Progress `Payment Progress — {Month} {year}`, `round(paid/total*100)`%, hidden with no staff | PASS | `:190-198`; test (1 of 3 -> 33, empty -> 0) |
| Pay one -> POST `{org_id, user_ids:[id], month, year}`; row turns Paid, counts and progress update; success dialog | PASS | `api/salaryReports.ts markSalaryPaid`, `MonthlySalaryScreen.tsx:118-128`; screen test "marks one employee paid with the selected month/year" |
| Pay error: toast with server message, employee stays unpaid | PASS | `useAsyncAction` `errorMessage: 'Failed to process payment'`; screen test |
| Card tap toggles selection (not for paid); toolbar swaps to "Pay Selected (n)" | PASS | `PayCard`, `toggleOne`; `:222-240` |
| Pay Selected: one POST with the selected ids, selection clears | PASS | `payMany` + `onSuccess` pruning |
| Select All (n) selects unpaid only; tap again clears | PASS | `monthlySalary.ts allUnpaidSelected`, `toggleAll` |
| Pay All (n): one POST with all unpaid ids in list order; disabled/grey when all paid | PASS | `unpaidIds`; test "progress is round(...); Pay All sends every unpaid id once in list order" |
| Month/year change: payload and labels use the new period; paid marks and selection are NOT carried over | DEVIATION-OK | spec §13(c) fix; period-keyed state `MonthlySalaryScreen.tsx:100-105` |
| Pay-one leaves the selection (v1 kept a stale selected id) | DEVIATION-OK | spec §13(e); `pruneSelection` |
| Paying: toolbar spinner, per-row Pay disabled | PASS | `busy={paying}` |
| "Done" closes the success dialog (also back / scrim) | PASS / DEVIATION-OK | spec §7 hardware-back defect |
| Summary "Total Amt" / "Unpaid Amt" show real sums (v1 static `₹—`); `₹—` only when no source | DEVIATION-OK | spec §13(b); B7 |
| Paid state from `GET /salary/monthly-list` when available, else session-local with an info banner | DEVIATION-OK | spec §13(a); B7 Backend needs |
| Confirmation before Pay All / Pay Selected | DEVIATION-OK | spec §13(h) |
| Inactive staff and managers listed with Pay buttons and counted | PASS | `monthlySalary.ts rowsFromStaff` (badge "Inactive") |
| Staff-load failure / no session | DEVIATION-OK | error state / "Session unavailable" (spec §13(f)) |
| Year picker current-2 ... current+3 | PASS | `yearRangeFor('reports')` |
| Salary breakdown for amounts is net per user; no client salary arithmetic beyond sums | PASS | `monthlySalary.ts computePayTotals` |
| `/salary/monthly-list` and `/salary/mark-paid` not routed in the backend snapshot | NEEDS-DECISION | N-2 |

## 10. view_staff_salary (Staff Salary sheet)

| Item | Status | Evidence / fix |
|---|---|---|
| Breakdown for the current month/year loads; `{n} staff`; no client re-sort | PASS | `SalarySheetScreen.tsx:147`, `reportLoaders.ts loadSalarySheet` |
| 14 on-screen columns (Type + 13); frozen Employee column; header groups Incentive (Count, Turnover) and Travel (Odometer, Ticket) | PASS | `salarySheet.ts:58-80`; header spans 5/2/3/2/3 |
| Cell rules: `—` for 0/null; Fine red when non-zero; Net bold green; `incentive_count` plain; amounts `₹` en-IN grouping | PASS | `salarySheet.ts formatMoneyCell/formatCountCell`; test `specConformance.test.ts` (`₹1,23,456`) |
| Frozen-column sub-line `role_name \|\| branch_name \|\| emp_id \|\| —` | PASS | `salarySheet.ts salarySubline`; test |
| Breakdown failure (incl. 403 expired plan): rows from the staff list, zero amounts, type Monthly, role Manager/Employee, inactive included | DEVIATION-OK | same rows, plus a banner naming the reason (spec §13(e), FIX_POLICY B2); test `reportLoaders.test.ts` |
| Both endpoints fail -> error, no stale rows | DEVIATION-OK | error state `Failed to load salary data` fallback (B7) |
| Type badge -> "Select Salary Type" (Monthly/Weekly/Daily/Hourly, current marked); updates that row only; no API call; amounts not recomputed | PASS | `SalaryTypeSheet.tsx`, `salarySheet.ts applySalaryTypes`; test (per-row wins, net unchanged) |
| "All Types" pill -> "Set Type for All Staff" / "Applies to every employee"; all rows change; pill shows the label | PASS | `SalarySheetScreen.tsx:158-165` |
| Overrides and pill label reset when month/year changes (v1 stale pill) | DEVIATION-OK | spec §13(d); `TypeState.key` |
| Salary type label map; unknown key shown raw | PASS | `salarySheet.ts salaryTypeLabel`; test |
| Advance drill-down: "Advance Details" + name, loading, `₹` 2 decimals, date, "Added by", optional ID, "No advance records found." | PASS | `AdvanceSheet.tsx`; error state added (spec §13(f)) |
| Advance list is all months, newest first | PASS | `AdvanceSheet.tsx sortAdvances` (stable for equal dates) |
| Advance amount `₹1234.50` vs `₹1,234.50` | DEVIATION-OK | `formatINR` (CONVENTIONS "Money formatINR") |
| Export menu exactly PDF, DOC, Excel; "Preparing file..." overlay | PASS | `SalarySheetScreen.tsx:51,150`, `ReportScaffold.tsx` |
| Export: 18 columns in the listed order, raw unformatted numbers, overridden type label; file `salary_{Mon}_{year}.*` | PASS | `salarySheet.ts:132-169`; tests `overtimeAndExport.test.ts`, screen test "exports 18 columns" |
| Export title "Staff Salary — {Month} {year}" | DEVIATION-OK | title + `Company \| Month Year` subtitle (B7) |
| Real PDF / xlsx / DOC (v1 HTML renamed); HTML escaped | DEVIATION-OK | FIX_POLICY B9; test `exportContents.test.ts` |
| No entry in View Reports history; no CSV in the menu | PASS | `useReportExport` called without `historyLabel`; `EXPORT_FORMATS = pdf, doc, xlsx` |
| Android folder picker / toast "saved to Downloads"; iOS UTI `public.html` | DEVIATION-OK | share sheet / browser download via platform layer (spec §13(k)) |
| Race protection when switching months | PASS | keys scoped by org + period |
| Backend-computed net salary (no client salary math); `salary_type` always MONTHLY_FIXED, `fine` always 0 | NEEDS-DECISION | N-4 (backend-side; client shows what the server sends) |
| Manager sees org-wide salary sheet | NEEDS-DECISION | N-1 |

## Fixes made

| # | File(s) | Change | Tests |
|---|---|---|---|
| 1, 2 | `src/features/reports/utils/lateRule.ts` | AM/PM shift times shown as sent; ISO / raw punch-in rendered through `punchDisplay` (IST) | `utils/__tests__/lateRule.test.ts` (updated one expectation to the spec text, added "formats 24h shift times as hh:mm AM/PM and shows ISO punch-ins in IST", "spec examples: 75 min late") |
| 3 | `src/features/reports/screens/EmployeeShiftsReportScreen.tsx` | company name sub-title | covered by screen smoke test |
| 4 | `src/features/reports/utils/shiftReport.ts` | duplicate staff ids skipped | `specConformance.test.ts` |
| 5 | `src/features/reports/utils/attendanceMath.ts` | missing request-level status = pending | `specConformance.test.ts` |
| 6 | `src/features/reports/services/reportLoaders.ts` | `-` / empty branch + dept never sent to the working-days endpoint | `services/__tests__/reportLoaders.test.ts` |
| 7 | `src/features/reports/utils/history.ts` | history dedupe also by file name | `specConformance.test.ts` |
| 8 | `src/features/reports/hooks/useReportQueries.ts` | `refetchOnWindowFocus: false` on the staff-detailed, late and employee-shifts queries (pull-to-refresh / retry unchanged) | n/a (config) |

New test files: `src/features/reports/utils/__tests__/specConformance.test.ts` (spec §14 worked examples: absent 26/20/3, leave date-split, `08:30` x2 = `17h 0m`, half days, OT 150 min / Rs 900, shift 3/15/5, salary cell formats, type-override precedence, pay progress 33 percent, history dedupe) and `src/features/reports/services/__tests__/exportContents.test.ts` (real mime/extension per format, CSV BOM + RFC-4180, real xlsx header, escaped PDF/DOC HTML, employee profile PDF/DOC seams).

No shared-code changes outside `src/features/reports`.

## Needs decision

| # | Item | Evidence |
|---|---|---|
| N-1 | Manager scoping: Late, Overtime, Staff detailed, Employee details/shifts, Monthly salary and Salary sheet call `getAllStaff(orgId)` (org-wide) even from `/staff/reports`; the manager "All Staff" attendance PDF merges the whole org on the backend | `reportLoaders.ts`, spec monthly_report §13(e), attendance_monthly_report §13 "scope mismatch"; FIX_POLICY C "manager scoping rules"; B7 Deferred |
| N-2 | Backend endpoints missing / insufficient: `/api/incentive/overtime-report` (not routed), `/salary/monthly-list` + `/salary/mark-paid` (not routed), `/home/monthly-attendance` has no shift start/end (Late By cannot be computed) | spec overtime §6, monthly_salary §6, late_report §7; B7 Backend needs |
| N-3 | Late definition (status `late` OR > 1 min after shift start, no grace from attendance rules) and the dead "Half Day" column | FIX_POLICY C; spec late §13(i) |
| N-4 | Salary type is `MONTHLY_FIXED` for every row and `fine` is 0 server-side, so the Type override and Fine column are placeholders; override is local-only and does not recompute net | spec view_staff_salary §6 |
| N-5 | Attendance PDF endpoints are GETs without auth headers (as v1); also the plain single-staff endpoint has no permission check | spec attendance_monthly_report §13(a); B7 Backend needs "auth + scope" |
| N-6 | Employee profile PDF/DOC (Aadhaar, PAN, bank details) is persisted in the app's saved-files folder until deleted from History; consider ephemeral file / masking. Related: native saved files share one folder across organisations, so the same file name exported under two organisations on one device overwrites the other's file (history is per org) | spec employee_details §13(g); `files.native.ts savedDir` |

Minor observations (no action): `ensureSuccess` accepts a 200 body without a `success` flag, so an overtime response like `{detail:'Not Found'}` with status 200 would render zeros without the warning banner (a real 404 does raise the banner); the shared `shareFile` error wording differs slightly from the employee-details v1 toast.

## Verification

- `npx jest src/features/reports`: all suites pass (new + existing).
- `npx tsc --noEmit` (whole project): no errors.
- `npx eslint src/features/reports`: clean.
- `npm run check:brand`: the reports feature and this document are clean; at the time of the run the check reported references only inside another QA engineer's note (`docs/qa/Q4d-C.md`), which is outside this slice and was not edited.
