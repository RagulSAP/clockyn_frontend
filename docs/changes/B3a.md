# B3a — Staff directory (roster + staff detail)

## Implemented
| Screen | Route | Files |
|---|---|---|
| Staff roster (`StaffListScreen`) | `/admin/staff` (`src/app/admin/staff/index.tsx`) | `src/features/staff-directory/screens/StaffListScreen.tsx`, `components/{StaffRosterRow,RosterControls}.tsx`, `hooks/{useStaffRoster,useToggleStaffActive}.ts`, `utils/rosterFilters.ts` |
| Staff detail (`StaffDetailScreen`, param `staffId`) | `/admin/staff/detail` (`src/app/admin/staff/detail.tsx`) | `screens/StaffDetailScreen.tsx`, `components/detail/*` (ProfileCard, OverviewTab, CalendarTab + AttendanceCalendarGrid, AttendanceTableTab, LocationsTab, AdvanceTab, DayDetailSheet, PunchEditSheet, ProfileSheet, AssignSheet, DeleteStaffDialog), `hooks/*`, `utils/{attendanceDerive,advance,punchClock,staffActions}.ts` |

Roster: route params `filter` (`total|late|punched_in|working|punched_out|absent`; the dashboard aliases `punch_in`/`punch_out`/`late_punched_in` are accepted), `branchId`, `date` (IST, defaults to today), `deptId`. Search (name/branch/department), Staff/Manager/Inactive chips with counts, live status badge per row (LATE tag in the late view), Absent/Late banners, per-row active switch, avatar lightbox, company name + logo header, pull-to-refresh (button on web), virtualised list (two columns on desktop), skeleton / error+retry / empty states.

Detail: profile card (photo lightbox, name, branch, mobile, live status; Profile / Assign / Edit; trash for role 1), tabs Overview (details, month snapshot, active switch) / Calendar (Monday-first, status colours, LATE/HALF labels, legend, day detail with sessions + photos) / Day-Wise (table, tap a punch to correct it with the clock-style editor) / Location (date list, map with green punch-in and red punch-out pins) / Advance (add + history), full-profile sheet (4 sections, Edit Staff), Assign hub (Manager, Shift, Monthly Fixed, Daily Wages, Hourly Charges, Incentive, OT, Bonus -> `routes.admin.*` with `staffId`), edit -> `routes.admin.staff.edit` with `staffId`, type-the-name permanent delete (role 1 only).

Tests (`src/features/staff-directory/__tests__`): `rosterFilters` (filter logic, role merge, counts), `attendanceDerive` (late/half/leave/Sunday/absent derivation, calendar grid, H.MM hours, day rows), `advanceAndActions` (advance validation, punch clock, delete confirmation, role gate, Assign targets), `StaffListScreen` + `StaffDetailScreen` smoke/interaction tests (76 tests). `npx tsc --noEmit`, `npx eslint`, `npm run check:brand` clean for my files; `expo export --platform web` bundles.

## Fixes applied (v1 -> now)
- Roster chips (Staff / Manager / Inactive) were always 0 on tile-driven views -> live-status lists are merged with the full roster (`/home/all-staff`, cached by `queryKeys.home.allStaff`) for role, active flag and photo; the live list stays the source of membership. The status filters still call the live endpoints with `branchId` + `date`.
- Department tile with 0 results showed ALL staff / lost the department -> `deptId` resolves to the department name and narrows both the full roster and live buckets client-side; an unknown or empty department gives the empty state. (`branchId` also narrows the full roster, so "Total staff" under a branch filter matches the tile count.)
- `punch_in` / `punch_out` filter values from department tiles were unrecognised -> aliased to `punched_in` / `punched_out`.
- Infinite spinner without an org id -> explicit "Organisation not available" empty state; no request is made.
- UTC default date -> IST (`todayIST()`), `date` param validated.
- Search was not trimmed, counts used non-deduped lists, duplicate rows -> trimmed search, de-duplicated by `userId` before counting.
- Letter-avatar tap was swallowed -> only avatars that have a photo open the lightbox; every other tap opens the detail.
- Active toggle: duplicate requests, stale `is_active` -> per-row in-flight lock, cache updated on success, staff + dashboard queries invalidated (replaces the `staff_need_refresh` flag), server message toast, error toast on failure.
- Detail: stale month when returning to the current month -> attendance is a query keyed by staff + scope + year + month, so the grid always shows its own month's data.
- Attendance fetch errors were masked as an all-absent month -> error state with retry (v1 silently showed red days); a failed approved-leave merge shows an inline warning.
- Punch-location request used the logged-in user's org id and downloaded everyone's pins -> uses the screen's scope id (manager id for managers); matched per staff client-side (see Backend needs).
- Advance: 0 / negative / "5abc" amounts were accepted, date started empty, HTTP status ignored -> amount must be numeric and > 0 (messages `Please enter a valid amount`, `Amount must be greater than 0`), date defaults to today (IST) and may not be in the future, errors toast the server message, history is invalidated (no fake optimistic row with a string amount).
- "Refreshing profile..." strip could stick -> derived from the query's fetching state, so it always clears.
- Delete / deactivate did not refresh hosts -> `staff.all(scope)` + `home.all(scope)` invalidated, then navigate back to the list (`backOr`). Delete is shown for role 1 only; the typed name is case-insensitive and trimmed.
- Edit-punch sheet kept stale picker state when the punch-out cell was tapped -> the sheet opens on the tapped field; Save is disabled until something changed and at least one time is set. Punch-out earlier than punch-in is deliberately allowed (server treats it as the next day).
- `staff` prop was mutated in place after editing -> detail comes from the query cache; returning from the editor invalidates and refetches (and reopens the profile sheet if the edit started there). Storage flags (`staff_profile_updated`, `staff_profile_cache_*`, `clear_home_loading`) are not ported.
- Two photo endpoints -> one query (`/auth/employee-profile` first, `/profile-photo` as fallback).
- Emoji icons -> icon set; dead state (`advanceNote`, `advanceImage`, `selectedSalaryType`, `showSalaryDropdown`, `dayViewScrollRef`, `loadingPunchLocations`, `deptOn`) not ported.
- Late/half/leave/Sunday/absent rules, the 1-minute grace, the 9 h default shift, H.MM work hours and the "(shift end)" display fallback are ported exactly (see `utils/attendanceDerive.ts`, unit tested).

## Deferred (v1 behaviour kept; needs a product / backend decision)
- Assign hub targets do not pre-select the staff member: `routes.admin.{managers,shifts,payroll.*}` still ignore params. `staffId` is passed so they can adopt it later.
- Advance history keeps the static green "Paid" pill (no paid state exists in the data).
- Missing record on a past non-Sunday = absent (no holiday / joining-date logic); half-day uses the v1 formula (no overnight wrap of the shift length).
- Deactivation has no confirmation on the roster switch (v1); on the detail screen it asks first because it leaves the screen.
- Role gate for permanent delete is client-side plus the `requested_by_role_id` query param (server enforcement unverified).
- Edit-punch cannot clear a punch (the API omits empty values); no out >= in validation (overnight).
- "Late" status is only whatever the server returns plus the client rule; no server-side late definition change.

## Backend needs
| Endpoint | Current | Needed | Impact |
|---|---|---|---|
| `GET /home/staff-punch-locations` | returns every staff member's pins for the org/date; client filters by user id | optional `staff_id` filter (or per-staff endpoint) | payload size for large orgs |
| `GET /home/staff-detail` | finds ACTIVE staff only | also return inactive staff (or a flag) | roster rows of inactive staff open an error screen (v1 toasted a failure and stayed on the list) |
| `/home/{absent,late-punched-in,punched-in,working,punched-out}-staff` | no `role_id`, no real `is_active`, only `status = 1` users | include `role_id` / `is_active` / photo | removes the client-side merge with `/home/all-staff` |
| `GET /home/monthly-attendance` | `total_hours` may be `"H:MM"` or decimal; `shift_start_time` / `shift_end_time` only in the raw row; only dates with a row | consistent decimal hours + shift times + holiday / weekly-off days | removes client-side late / half / absent inference |
| `PUT /home/update-attendance-punch` | empty value = unchanged | explicit way to clear a punch | cannot remove a wrong punch |
| `DELETE /addstaff/{id}/permanent`, `PUT /addstaff/{id}/status` | no auth header evidence, client-supplied role id | authorise the caller server-side | security |
| `GET /requests/calendar/{user}/{org}` | needs confirmation that every approved leave date is its own item | one item per leave date | approved-leave merge in the calendar |

## Deviations from spec
- Day-detail, profile, Assign, edit-punch and delete are bottom sheets / dialogs (centred on wide screens) instead of full-screen modals.
- Month / year selection uses `MonthYearPicker` inside the Calendar, Day-Wise and Location tabs (v1 showed two selectors above every view, even Advance where they had no effect). Year range is current year -5 .. +4 as in v1.
- Added an Overview tab (details + a derived month snapshot of present / late / half / absent / leave counts) and an Active switch on the detail screen (brief). The default tab is Calendar (v1 default view).
- After a successful delete the screen navigates back immediately (v1 waited 1.2 s); the toast is global so it stays visible.
- Tab content is rendered one at a time (no swipe).
- Image prefetch of the first 20 photos not ported (the `Avatar` already caches by stable key).
- Roster rows show the live status badge (v1 computed it but never rendered it).

## Known gaps
- Roster counts on live buckets stay partial until `/home/all-staff` returns (the list itself shows immediately).
- No hardware-back special handling beyond what `Modal` / `BottomSheet` provide.
- Manager scoping uses the manager's own user id as the scope for staff endpoints (v1 contract: `useStaffScopeId`), which is a fragile convention the backend should replace.
- Dark mode / small-phone layouts were verified by structure and tests, not on devices.

## Shared-code changes
None.
