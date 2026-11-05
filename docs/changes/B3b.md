# B3b — Org structure: add/edit staff, branches, departments, devices

Feature folder `src/features/org-structure/` (screens, components, hooks, utils, `testing/harness.tsx` for tests only).

## Implemented
| Screen | Route (file) | Spec |
|---|---|---|
| `StaffEditScreen` (add + edit, param `staffId?`) | `/admin/staff/edit` (`src/app/admin/staff/edit.tsx`) | 02/add_staff |
| `BranchListScreen` (list, GPS / radius pills, edit, delete + staff reassignment) | `/admin/branches` (`.../branches/index.tsx`) | 02/all_Branch |
| `BranchEditScreen` (add + edit, param `branchId?`, map picker) | `/admin/branches/edit` | 02/add_branch |
| `DepartmentListScreen` (list, edit, delete) | `/admin/departments` | 02/dept_all |
| `DepartmentEditScreen` (add + rename, param `deptId?`) | `/admin/departments/edit` | 02/dept_add |
| `DevicesScreen` (reachable "coming soon" placeholder) | `/admin/devices` | 02/assign_devices |

`add_department` (orphan duplicate) was read and NOT built, as instructed.

Key pieces
- `hooks/useStaffEditor.ts` (form controller), `useStaffFormData.ts` (options / staff limit / edit record queries), `useBranchEditor.ts`, `useBranchDeleteFlow.ts`, `useOrgScope.ts` (`scopeId` = org for admins, the manager's own user id for managers, like v1; `orgStructureKeys()` builds the invalidation list).
- `utils/employeeId.ts` (suggestion loop), `staffForm.ts` (values / validation / dirty / payload / limit banner text), `branchForm.ts`, `departmentForm.ts`, `branchDeleteFlow.ts` (pure reducer = the delete / reassign state machine).
- `components/`: `StaffFormSections`, `StaffPhotoField`, `StaffLimitBanner`, `UnsavedChangesDialog`, `BranchCard`, `ReassignSheet`, `LocationPickerModal` (works with `ClockynMap`: Leaflet on web, native maps on devices), `RadiusSelector`.
- Layout: single column on phones, two columns (`ResponsiveRow`) on desktop for the forms and the card lists; dark mode via tokens only.
- Manager (role 2) access: screens do not check the role themselves (as in v1); option / list / save calls use `scopeId` (manager = own user id for branches and staff edit; add staff and branch saves use the session org id, as the spec says). Gating by "Staff Management" / "Branch Management" permission stays with the caller (staff Settings shortcuts, B11/B5).

## Fixes applied (v1 issue -> fix)
- add_staff: option lists were loaded twice and again on every focus, and each refocus (e.g. back from Shift Settings) overwrote a typed Employee ID -> branch / department / shift options are cached react-query reads (one load); the employee id is suggested ONCE and never overwrites anything the user typed (also not when the suggestion arrives late). Shifts are re-read on focus (the user may have created one).
- add_staff: `NaN` employee id for non-numeric suggestions and an unbounded loop -> numeric increment only when the id is numeric, loop bounded (500).
- add_staff: edit-mode dirty check ignored the photo snapshot (staff with a photo were always "dirty") -> the snapshot includes the photo, taken once the record AND photo lookups settled.
- add_staff: "+ Add Shift" fetch had no error handling (stuck loader) and used an AsyncStorage flag handshake -> plain navigation to `routes.admin.shifts` + refetch on focus; no loader to get stuck.
- add_staff: cross-screen AsyncStorage flags (`staff_need_refresh`, `staff_details_need_refresh`, `staff_profile_updated`, `staff_profile_cache_*`, `dashboardStats`) -> query invalidation (`staff`, `home`, `shifts`, employee photo) after save.
- add_staff: photo MIME hard-coded `image/png` -> the picked image's real mime / file name; failed photo upload was silently swallowed -> error toast "Staff saved, but the photo could not be uploaded…" (the save still counts as successful).
- add_staff: Date of Birth was three scroll lists that allowed impossible dates and ignored the stored DOB -> real `DateField` (max = today IST), prefilled.
- add_staff: dead code not ported: Shift Required modal, success popup, `showingSuccess`, `genders` state, `org_name` param, `deleteStaff`, manager picker (see Deferred), `org logo` header.
- add_staff: JSON `preloadedData` route param -> only `staffId`; the record is read via `GET /addstaff/{id}` (+ photo). Staff-limit lookup is refreshed on focus (v1: once on mount).
- add_staff: phone / emergency contact / account number accept digits only (the numeric keyboard of v1 was not enforced on paste / web); e-mail lower-case, IFSC upper-case as in v1.
- all_Branch: delete flow never refreshed other screens' branch caches -> branch / home / staff queries invalidated after delete and after every reassignment. Stale errors are cleared on every user action (reducer resets `error`).
- all_Branch: staff-lookup failure fell through to a plain delete dialog -> error toast with the server message, nothing opens (spec §13).
- all_Branch: reassign succeeded but the final delete failed -> v1 emptied the list and said "Failed to reassign staff" -> now "Staff reassigned, but the branch was not deleted: <reason>" and the flow falls back to the plain delete confirm so the user can retry.
- all_Branch: "Reassign 0 Staff" label -> "Reassign Staff" (disabled) until something is selected; backdrop / close dismissal works (blocked while busy); no pull-to-refresh -> pull-to-refresh (+ web refresh button, refetch on focus); a hint is shown when there is no other branch to move staff to.
- all_Branch / dept_all: `orgId` param could be missing so nothing was fetched -> ids come from the session; skeleton while loading and an error state with retry (v1 silent / cached only).
- add_branch: Save Location only appeared after a map tap -> available as soon as a pin exists (add mode starts with the GPS fix, edit mode with the stored coordinates); confirm label is based on whether GPS is already set (v1 tested latitude only); web now has a real map picker (Leaflet) with tap / drag, Map / Satellite toggle, radius circle; reverse-geocoded address is shown and, when the Address field is empty, copied into it (v1: display only); success toast "Branch added successfully" / "Branch updated successfully" (v1 just closed); out-of-set stored radius is shown as an extra selected chip.
- dept_add: success popup timer leaked on unmount -> cleared; popup shows the TRIMMED name (v1 interpolated the untrimmed text); `departments_need_refresh` flag replaced by invalidation (`departments`, `home`, `staff`).
- dept_all: error toast could read just "Failed" -> server `detail` / "Failed to delete department"; list re-synced after a failed delete; delete confirm keeps a spinner instead of closing optimistically.
- assign_devices: dead bottom-nav callbacks removed; header title "Add Devices", rows show the v1 "... coming soon" info toasts.

## Deferred (v1 behaviour kept; needs a product / backend decision)
- Manager picker: `parent_id` is never sent (v1: the UI was dead). Editing a staff member sends no `parent_id`; whether that clears the stored manager is unverified.
- "Punch Anywhere" / "Punch at Branch" choice of the field-staff toggle was UI-only in v1 (never submitted) -> NOT ported (no backend field); only the Field Staff switch exists.
- No phone / e-mail format validation and no 10-digit rule (v1 had none; only required-field validation).
- Removing a photo only clears the local selection (no server delete endpoint).
- Branch with staff cannot be deleted when it is the only branch (no "unassign" option) — spec marks it a product gap.
- Deleting a department does not block when staff belong to it (server un-assigns them, `dept_id = NULL`) and there is no reassign prompt, as in v1.
- Employee-id uniqueness is checked client-side only on ADD (fail-open when the lookup fails); edit mode relies on the server.
- Branch name duplicates / department duplicates are only reported by the server.
- 10 s request timeout of v1 branch / department saves: the shared API client's timeout and network messages are used instead of the custom "Network error: ..." strings.

## Backend needs
| Endpoint | Current | Needed | Impact |
|---|---|---|---|
| `POST/PUT /addstaff/` | `profile_image` is not sent by this client (photo goes through a second multipart call); `parent_id` omitted | confirm `PUT` without `parent_id` does not wipe the manager; optionally accept a punch-mode / field-punch field | manager assignment, punch mode |
| `POST /addstaff/` | plan staff limit is enforced only by the client banner (unverified server-side) | reject adds beyond `staff_limit` with a clear 4xx message | prevents bypassing the banner |
| `GET /plans/subscription/{org}` | `staff_limit` can be missing for some plans; `plansApi.getSubscription()` defaults it to 10, so this feature reads the RAW field (missing = no banner, like v1) | always return `staff_limit` | accurate banner |
| photo removal | none | `DELETE /auth/employee-profile/{id}` (or `photo=null` on PUT) | Remove can't clear a stored photo |
| `POST /branch/delete`, `GET /branch/staff` | `org_id` must match the branch's org; managers send their own user id -> 404 `Branch not found or access denied` | resolve manager scope server-side for delete / reassign / staff list | managers with Branch Management cannot delete today |
| `GET /branch/staff/{id}` | active staff only; inactive staff keep a dangling `branch_id` after the branch is deleted | include or null-out inactive staff on delete | data hygiene |
| `POST /branch/reassign-staff` | HTTP 200 even if 0 rows were updated; accepts `delete_branch_id` | return the moved count; this client could then do reassign + delete atomically via `delete_branch_id` | removes the non-atomic two-call delete |
| reverse geocoding on web | `@/lib/platform/geocode` calls the public OpenStreetMap Nominatim service (best effort, 8 s timeout) | own geocoding proxy / key for production volume (usage policy) | branch address suggestion on web |

## Deviations from spec
- Headers: the v1 company-logo + name header is replaced by the standard `Screen` header with the organisation name as subtitle; bottom navigation bars are not rendered (the app shell owns navigation).
- Branch / department lists got an "Add" icon button in the header (v1 added them from the home screen's buttons, which no longer exist as such); empty states carry an "Add ..." action (spec §13 suggestion for departments).
- Dropdowns are the design-system `Select` (sheet / dialog); shift options show the name with `start - end` as subtitle (the closed field shows only the name, as in v1). A branch / department / gender stored on the record but missing from the option list is shown as an extra option.
- Gender stays Male / Female only (spec acceptance), even though the API constant also lists Other; an existing "Other" value is kept.
- Unsaved-changes prompt uses a custom two-button dialog (Exit / Save; dismissing stays on the form) instead of `useConfirm`, because a dismissed confirm cannot be told apart from "Exit".
- Map picker: if the GPS fix fails (non-denied) the map still opens at the default centre without a pin so the location can be set by tapping (v1 stopped with a toast). On web a permission denial also still opens the map (no settings deep link exists); on native a denial shows the "Location Permission Required" dialog with Open Settings and does not open the map (v1). The permission copy names Clockyn. The "Change" link of the bottom card is dropped (the card is always visible).
- Radius chips use `FilterChips`; the department / branch pickers' emoji glyphs became design-system icons.
- Edit staff for a manager uses the manager's own user id as the org scope for option loads and the `user_id` of the payload (v1 `orgId` param contract); no `orgId` route param exists any more.

## Known gaps
- Web browser Back (and swipe-back on iOS) cannot be intercepted for the unsaved-changes prompt; the header back arrow and Android hardware back are.
- Staff-limit "Upgrade" opens `routes.admin.billing.overview` for every role (iOS label "View Status"); managers cannot buy, the billing screen decides.
- The staff list / detail panel (B3a) refreshes through `queryKeys.staff.all(...)` / `home.all(...)` invalidation; it must use those prefixes (it does if it follows `queryKeys`).
- Test runs print React `act()` warnings from the design system's animated components (Modal / Switch); all tests pass.
- `expo export --platform web` run once: succeeds with all six routes in the bundle.

## Shared-code changes (additive only)
- NEW `src/lib/platform/geocode.ts` (web / default: OSM Nominatim `reverseGeocode(lat, lng): Promise<string | null>`), `geocode.native.ts` (expo-location `reverseGeocodeAsync`), `geocodeFormat.ts` (pure `formatAddress`, shared) and `__tests__/geocodeFormat.test.ts`. No existing file was modified.
- No changes to `components/ui`, `api`, `store`, `hooks`, `queryKeys` (custom edit-record key is built from `queryKeys.staff.all(...)` locally).

## Tests
`npx jest src/features/org-structure src/lib/platform/__tests__/geocodeFormat.test.ts` — 10 suites / 71 tests: employee-id suggestion, staff validation / dirty / payload / limit banner, branch + department validators, branch-delete reducer (state machine), and smoke + interaction tests for every screen (add / edit staff incl. emp-id not overwritten, duplicate id, limit gate, unsaved dialog, photo upload; branch list reassign-then-delete incl. delete-failure recovery; branch map picker; departments; devices).
