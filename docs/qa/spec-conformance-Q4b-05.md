# Spec-conformance audit Q4b-05: admin payroll set-up

Scope: specs `05_admin_payroll` (monthly_fixed, add_payslip, daily_wages, hourly_charges, overtime, bonus, count_basis, turnover, incentive; `payslip_template` intentionally dropped, FIX_POLICY B.7). Implementation: `src/features/payroll` (+ `src/api/payroll.ts`). Routes `/admin/payroll/...` (ROUTES.md rows B6).

Legend: PASS = implemented as specified (evidence); DEVIATION-OK = intentional, cited FIX_POLICY section or B6 change log; GAP-fixed = defect found and fixed in this audit; Needs-decision = not changed.

## Summary

| Status | Count |
|---|---|
| PASS | 129 matrix rows (G1 also corrected the copy behind 12 of them) |
| DEVIATION-OK | 29 |
| GAP-fixed | 3 defects (G1 failure copy, G2 stale inline error, G3 live whole-number check) plus G4 missing test pins |
| Needs-decision | 9 (listed at the end; behaviour unchanged) |

Verification: `npx jest src/features/payroll src/api/__tests__/payroll` 250 passed (10 suites; 137 of them new, in 2 new files); `npx tsc --noEmit` clean for the whole project; `npx eslint src/features/payroll src/api/payroll.ts` clean; `npm run check:brand` clean for payroll files (it currently fails on 4 lines in another QA engineer's `docs/qa/Q4d-C.md`, which is not owned here).

Money and formula re-derivation (all pinned in `src/features/payroll/__tests__/specConformance.test.ts`): payslip acceptance #10 (30000 + 10000 + 2000 custom = 42000, EPF 1800, net 40200); decimals 1000.75 not truncated (#16); live totals equal the server formula `computePayslipTotals` for decimal, float-trap (0.1 + 0.2) and large inputs; amount in words 21 table values incl. 125000.75 -> "One Lakh Twenty Five Thousand Rupees Only", 10000000 -> One Crore, 1000000000 -> One Hundred Crore (v1 recursion); wire bodies for every type (field names, numeric types).

## monthly_fixed (`PayslipListScreen`, `PayslipAssignModal`, `PayslipPreviewModal`)

| Item | Status | Evidence / fix |
|---|---|---|
| #1 cards show name, net badge (non-zero), assigned text | PASS | `screens/PayslipListScreen.tsx:73-80` (`t.netSalary ?` hides 0, R6); test `payslipScreens.test.tsx` "lists templates oldest first" |
| #2 "No staff assigned yet" / "View {n} Assigned Staff" opens assign | PASS | `components/TemplateCard.tsx:112-125` |
| #3 "+ Add" opens empty add_payslip | PASS | `PayslipListScreen.tsx:50`; test "Add opens the empty form" |
| #4 Edit opens pre-filled (name, Basic, HRA, EPF, PT, HI, custom rows) | PASS | `screens/PayslipEditScreen.tsx:60-66` + `utils/payslipForm.ts:46-57`; test "edit mode prefills" |
| #5 Delete only on the last card | DEVIATION-OK | deterministic newest-by-`createdAt` (R1 left intent open; B6 Fixes + Deviations); `utils/payslipForm.ts:149-165` |
| #6 Delete -> Cancel closes; tap empty space closes | DEVIATION-OK | Cancel closes (`TemplateCard.tsx:99`); tap-away dropped because the menu/confirm are inline, not an overlay dropdown (B6 Deviations "inline"); opening another card's menu closes the previous confirm/menu (`PayslipListScreen.tsx:88-91`) |
| #7 "Deleting..." state, card disappears, "Deleted Successfully!" | PASS | button label `TemplateCard.tsx:103`, toast `PayslipListScreen.tsx:35` (B6: toast instead of popup); test `specConformance.test.tsx` delete feedback |
| #8 delete failure toast "Failed to delete template" | PASS | `PayslipListScreen.tsx:32`; fallback copy fixed (GAP-fixed G1); test pins failure + retry |
| #9 assign opens: loading, title = org name, "All Branches"/"All Departments" | PASS | `PayslipAssignModal.tsx:119-146`; skeleton instead of "Loading staff..." modal (B6) |
| #10 branch/department filters reload server-side; "All" clears | PASS | `PayslipAssignModal.tsx:80-87`, `api/payroll.ts:307-316` (`branch_id`/`department_id`/`pay_slip_id`, empty dropped); test asserts query args |
| #11 row `{department} \| {branch}`; assigned shows "Assigned" (R5 fix) | PASS | `PayslipAssignModal.tsx:176,190`; `staff_id`/`is_assigned` keyed (`api/payroll.ts:122-132`) |
| #12 Assign flips row, refreshes count, "Payslip Assigned!" | PASS | `PayslipAssignModal.tsx:108-114` (toast, B6) |
| #13 already on another payslip -> "Already Assigned" alert with name + OK | PASS | `PayslipAssignModal.tsx:36-43,93-101,208-217` (in-app dialog replaces native alert, FIX_POLICY CONVENTIONS) |
| #14 assign failure toast = message else "Failed to assign payslip" | PASS | `PayslipAssignModal.tsx:104` |
| #15 preview content (org, `{payslip} - {Month} {Year}`, 6 info rows, tables, totals, net, words) | PASS | `PayslipPreviewModal.tsx:86-122`; money 2-decimals via `formatINR` (grouped, CONVENTIONS "Money is INR via formatINR"; R7 raw `toFixed` not kept) |
| #16 125000.75 -> "One Lakh Twenty Five Thousand Rupees Only" | PASS | `utils/numberToWords.ts`; tests in `payslipForm.test.ts` and `specConformance.test.ts` |
| #17 preview failure "Failed to load preview" | PASS | `PayslipPreviewModal.tsx:89` (inline retry state) + skeleton while loading (B6) |
| #18 returning after save shows fresh data, no manual refresh | DEVIATION-OK | query invalidation `queryKeys.payroll.all` replaces the two AsyncStorage flags (spec §13 "shared cache invalidation", B6 Fixes) |
| #19 `staffId`/`staffName` have no effect | PASS | route has no such params (B6 Deferred) |
| #20 preloadedData / plan-blocked no crash | DEVIATION-OK | no JSON route params (BUILDER_BRIEF 2.4); 403 shows error state with retry (`PayslipListScreen.tsx:57`) |
| #21 back/scrim closes staff modal, dropdowns, preview | PASS | design-system `Modal` (`components/ui/Modal`) |
| #22 back arrow shows "Loading staff..." | DEVIATION-OK | dropped, spec §13 "don't port" |
| §3 header "Salary Payslips", label "All Payslips", menu Edit / Assign Staff / Delete, confirm "Delete this template?", badge copy | PASS | `PayslipListScreen.tsx:45,54,82`, `TemplateCard.tsx` (emoji replaced by icons, B6) |
| §3 staff modal "Staff Details", "Assigned"/"Assign", Close | PASS | `PayslipAssignModal.tsx:148,185-198,118` |
| F1 list load error | PASS | ErrorState "Failed to load templates" + retry; empty org (bare `[]`) replaces list (B6, `usePayslipTemplates.ts`) |
| F4 delete non-success silent in v1 | DEVIATION-OK | surfaced as toast (FIX_POLICY B.2) |
| F6 assign payload `{org_id, staff_id, pay_slip_id}` | PASS | `api/payroll.ts:322-325` |
| R1 order / R3 exclusivity / R5 / R6 / R7 | PASS / DEVIATION-OK | see rows above; R3 server rule surfaced by the dialog |
| R4 numberToWords (en-IN, floor, "Rupees Only", negative) | PASS | `utils/numberToWords.ts`; negative net pay reads "Minus ..." instead of v1 "undefined" (FIX_POLICY B.8); pinned in `specConformance.test.tsx` preview test |
| §8 copy (all strings) | PASS | verified against `PayslipListScreen`, `TemplateCard`, `PayslipAssignModal`, `PayslipPreviewModal`; emoji dropped (B6) |

## add_payslip (`PayslipEditScreen`, `payslipForm.ts`)

| Item | Status | Evidence / fix |
|---|---|---|
| #1 add mode title "Add Payslip", button "Save Payslip" | PASS | `PayslipEditScreen.tsx:140,161`; test |
| #2 edit mode "Edit Payslip", "Update Payslip", prefill | PASS | `:60-66`, `payslipForm.ts:46`; test |
| #3 Basic or HRA empty -> toast "Please fill basic salary and HRA", no request | PASS | `payslipForm.ts:109` (checked first) |
| #4 blank name -> "Please enter template name" | PASS | `payslipForm.ts:110` |
| #5 add: POST numeric, "Payslip Added!", ~1.5 s then list | PASS | `PayslipEditScreen.tsx:96-101`; new test "add: Saving... disables the button ... list reopens after ~1.5 s" |
| #6 edit: PUT `/api/salary/template/{id}`, "Payslip Updated!" | PASS | `api/payroll.ts:274-280`; new tests (URL, no `pay_slip_id` in body, toast) |
| #7 blank EPF/PT/HI sent as 0 | PASS | `payslipForm.ts:125-139`; `specConformance.test.ts` wire body |
| #8 custom earning with name but no amount not sent | PASS | `isSavedLine` `payslipForm.ts:74`; test |
| #9 two "+ Add Earning" -> two rows; remove removes only that row | PASS | `CustomLinesEditor.tsx`; test "removes only the chosen custom row" |
| #10 30000 / 10000 / custom 2000 / EPF 1800 -> 42000 / 1800 / 40200 | PASS | `computeLiveTotals` `payslipForm.ts:84-92`; screen shows `formatINR` grouped (`₹40,200`) |
| #11 server rejection -> toast, form stays editable | PASS | `PayslipEditScreen.tsx:95-96`; new test (403 detail shown, Save usable again). v1 hid the server message; showing it is spec §13 |
| #12 offline -> same toast, Save re-enabled | PASS | `useAsyncAction` finally clears loading; network text from API layer (FIX_POLICY B.2) |
| #13 saving: "Saving..." + disabled | PASS | `PayslipEditScreen.tsx:161-164`; new test also asserts a second tap does not resend |
| #14 AsyncStorage keys set, list fresh | DEVIATION-OK | cache invalidation (spec §13, B6) |
| #15 back returns without saving | PASS | `Screen` back |
| #16 1000.75 not truncated, totals = server | PASS | integer-paise sum; parity test with `computePayslipTotals` |
| §7 required order Basic/HRA then name | PASS | `payslipForm.ts:108-111` |
| §7 no NaN, custom rows counted only when name AND amount | PASS | `payslipForm.ts:74-95` (fix of v1 parseInt/NaN, B.8) |
| §7 text / negative amounts rejected (v1 -> 422) | PASS | inline "Enter a valid amount" + toast "Please correct the highlighted amounts" (B.10); table test over 9 bad inputs |
| §7 zero allowed for Basic/HRA ("0" passes) | PASS | `parseAmountField` accepts 0 (see Needs decision N2) |
| §7 name trimmed on send | DEVIATION-OK | v1 sent untrimmed; trimming is harmless (`api/payroll.ts:109`) |
| §6 body fields `payslip_name, org_id, basic_pay, hra, epf, professional_tax, health_insurance, custom_earnings, custom_deductions` | PASS | `api/payroll.ts:105-119`; pinned |
| §8 labels / placeholders / toasts | PASS | "Basic Salary *", "House Rent Allowance *", "EPF", "Professional Tax", "Health Insurance", "Net Salary", "Enter Payslip Name", "0", "Earning name", "Deduction name", "Add Earning/Deduction", "Failed to save template" (emoji and "+" glyphs replaced by icons, B6) |
| Inline custom-row amount error stays after correcting the value | GAP-fixed | G2: error now clears when that row's amount is edited (`PayslipEditScreen.tsx:110-125`); new test |
| §13 header `paddingTop: 40`, `pf`/`esi` names | DEVIATION-OK | not ported (spec "don't port") |

## daily_wages and hourly_charges (`TemplateListScreen`, `wageConfigs.tsx`, `wageForm.ts`)

| Item | Status | Evidence / fix |
|---|---|---|
| D#1 / H#1 list in server order, `Day Pay {n}` / `Hour-Pay-{n}`, `₹{amount}`, assigned text | PASS | `config/wageConfigs.tsx:60-62,97-99`; test "render their own copy" |
| D#2 / H#10 preloadedData, mount fetch once | DEVIATION-OK | no JSON route params; one react-query fetch per org |
| D#3 / H#2 Add dialog title `Day Pay {n}` | DEVIATION-OK | highest + 1 for both (v1 daily used length + 1; spec §13 "fix", B6) |
| D#4 / H#3 empty -> "Amount is required"; 0 / abc -> "Amount must be a valid number"; no request | PASS | `utils/wageForm.ts:30-34`; B.10 table test (0, 0.0, negatives, `12abc`, `1e3`, `Infinity`, `NaN`) |
| D#5 live error while typing -5, clears when valid | PASS | `liveAmountError` `utils/numbers.ts:23`, `wageConfigs.tsx:39-41`; test |
| D#6 add: POST `{org_id, amount}`, refetch, "Template Saved!" | PASS | `api/payroll.ts:358-365`, `TemplateListScreen.tsx:77-84`; test (+ new popup copy test) |
| D#7 edit: PUT, "Template Updated!" | PASS | `wageSave` `wageConfigs.tsx:30-34`; test |
| D#8 edit -> Cancel keeps original amount | PASS | no optimistic list mutation (list only refetched) |
| D#9 / H#7 only highest-numbered card offers Delete | PASS | `utils/templates.ts:27-40`; numeric compare ("10" > "9") |
| D#10 / H#7 Delete -> Cancel; confirm -> "Template Deleted!" | PASS | `TemplateCard.tsx:92-109`, messages `wageConfigs.tsx:50-56` |
| D#11 delete failure toast "Failed to delete template" | PASS | `deleteWageTemplate` fallback copy matches |
| D#12 assign modal spinner then ASSIGNED (n) / AVAILABLE STAFF (n), `{emp_id} • {branch_name}` | PASS | `AssignStaffModal.tsx:162-231` (skeleton instead of spinner, B6) |
| D#13 two ticked -> "Assign 2 Staff", POST both ids, "2 staff assigned!", counts refresh | PASS | `AssignStaffModal.tsx:100-118`, `api/payroll.ts:381-384` (`{org_id, user_ids, temp_id}`); test |
| D#14 Remove -> toast "Staff unassigned" | PASS | `AssignStaffModal.tsx:131`; `unassignWages` URL `/api/wages/unassign/{org}/{user}/{tpl}` |
| D#15 assign failure: `detail` else "Failed to assign" | PASS | `getErrorMessage` prefers server detail; new test; fallback "Failed to assign staff" (v1 exception copy) |
| D#16 staff moves off other Day Pay | DEVIATION-OK | server rule; one-line hint in dialog (`wageConfigs.tsx:86`, spec §13 asks to surface; per-staff confirmation needs backend data, see N7) |
| D#17 back | PASS | `Screen` |
| D#18 tap empty space closes menu / confirm | DEVIATION-OK | inline menu (see monthly_fixed #6) |
| D#19 "No staff assigned yet" / badge opens modal | PASS | `TemplateCard.tsx` |
| D#20 plan gate only in Settings | DEVIATION-OK | B6 Deferred (gate in Settings feature, not this one) |
| H#4 duplicate amount -> `This amount already exists in Hour-Pay-{n}`; own amount allowed | PASS | `wageForm.ts:35-38`; tests |
| H#5/#6/#12 popups and failure toast | PASS | shared `MESSAGES` |
| H#9 scrim tap does not close the hourly form; daily does | PASS | `formDismissible: true` only for daily (`wageConfigs.tsx:81`), `TemplateFormModal.tsx:25` |
| H#14 duplicate checked on SAVE only, stays until next keystroke | PASS | live handler clears on keystroke (`wageConfigs.tsx:39-41`) |
| Edit dialog errors stale after Cancel / reopen (§13) | PASS | `openForm`/`closeForm` clear errors (`TemplateListScreen.tsx:60-72`) |
| Saving overlay / double submit | DEVIATION-OK | SAVE shows "Saving..." and ignores taps (B6) |
| §8 copy: "If one day present", "If one hour present", "Enter amount", "SAVE", "Cancel", popups, toasts | PASS | `wageConfigs.tsx`, `TemplateFormModal.tsx` |
| §6 endpoints and bodies `/api/daily-wages`, `/api/hourly-charges`, `/api/wages/*` | PASS | `api/payroll.ts:348-392`; amount sent as JSON number (parseFloat equivalent); backend envelope unverified (B6 Backend needs) |

## overtime (`overtimeConfig`, `overtimeForm.ts`)

| Item | Status | Evidence / fix |
|---|---|---|
| #1 cards `Over Time {n}`, duration chip, `₹{amount}` | PASS | `incentiveConfigs.tsx:76-90` |
| #2 90 -> "1h 30m", 120 -> "2h", 45 -> "45m" | PASS | `overtimeForm.ts:10-17`; test |
| #3 "+ Add OT", title `Over Time {max+1}` | PASS | `incentiveConfigs.tsx:70,74`; test |
| #4 both empty -> "Enter the Duration"; amount empty -> "Amount is required" | PASS | `overtimeForm.ts:54-57` (trailing space dropped, B6; unreachable "Duration is required" collapsed) |
| #5 minutes 75 -> "Minutes must be 0-59"; digits only, max 2 chars | PASS | `overtimeForm.ts:36-40,58-61`, fields `maxLength={2}` + `digitsOnly`; B.10 table test (60, 99, -1, 5.5, x) |
| #6 0h 0m -> "Enter the Duration" | PASS | `overtimeForm.ts:62` |
| #7 duplicate duration -> `This duration already exists in Over Time {n}`; own duration allowed | PASS | `overtimeForm.ts:66-68`; test |
| #8 amount 0 / non-numeric -> "Amount must be a valid number" live and on save | PASS | `overtimeForm.ts:63`, live `incentiveConfigs.tsx:128`; table test |
| #9 add POST `{org_id, template_name, duration_minutes, amount}`, popup, new card "No staff assigned yet" | PASS | `incentiveConfigs.tsx:151-155`, `api/payroll.ts:504-512`; list refetched (no fabricated `Date.now()` ids, B6) |
| #10 edit splits hours / minutes (minutes blank when 0); PUT `{duration_minutes, amount}` | PASS | `overtimeForm.ts:19-27`, `api/payroll.ts:515-521`; tests |
| #11 only highest card Delete; "Delete this overtime?"; "Deleted Successfully!" | PASS | `incentiveConfigs.tsx:79`, messages `:58-64`; test |
| #12 assign multiple / Remove | PASS | shared `AssignStaffModal` (`/api/incentive/assign`, `/unassign`) |
| #13 save failure toast "Failed to save" | PASS | messages; fallback copy fixed (GAP-fixed G1); new test |
| #14 scrim tap does not dismiss | PASS | `formDismissible` undefined |
| #15 params ignored | PASS | n/a |
| #16 plan gate | DEVIATION-OK | B6 Deferred |
| #17 local append without refetch | DEVIATION-OK | refetch after save (spec §13 "fix") |
| §7 duration stored in minutes, total > 0, unique | PASS | `overtimeTotalMinutes`, `findDuplicate` |
| §7 one staff on several overtime templates | DEVIATION-OK | server allows; no warning, as v1 (B6 Deferred) |
| §8 copy ("Duration", "Hours", "Minutes", ":", "Amount", "Enter amount", "All Overtime", "Add OT") | PASS | `incentiveConfigs.tsx` |

## bonus (`bonusConfig`, `bonusForm.ts`)

| Item | Status | Evidence / fix |
|---|---|---|
| #1 cards `Bonus {n}`, `{Month} {Year}`, `{percent}%` | PASS | `incentiveConfigs.tsx:225-236` |
| #2 "+ Add Bonus", `Bonus {max+1}` | PASS | `:222-224` |
| #3 non-numeric characters rejected; 150 -> live "Enter a number between 0-100" | PASS | `decimalOnly` + `livePercentError`; test + B.10 table (incl. 100.01, 101, 1000, negative, `1e3`) |
| #4 empty percentage / month / year errors shown together | PASS | `bonusForm.ts:49-54`; test |
| #5 duplicate percentage -> `This percentage already exists in Bonus {n}` | PASS | `bonusForm.ts:57-59`; own template allowed |
| #6 add POST with month name and year; new card shows month/year | PASS | `api/payroll.ts:524-533`; year sent as number (server int) |
| #7 12 months, years currentYear-5 ... +4 (IST year) | PASS | `bonusForm.ts:18-22`, `currentMonthIST` (FIX_POLICY B.1); stored out-of-window year added |
| #8 edit prefills; PUT persists month / year (v2 requirement) | PASS | `incentiveConfigs.tsx:243-247`, `updateBonusIncentive(id, pct, {month, year})`; tests |
| #9 Delete on highest only; "Delete this bonus?" | PASS | `incentiveConfigs.tsx:221` |
| #10 title "Staff Details"; staff on any bonus show warning icon + amber row | PASS | `incentiveConfigs.tsx:249-253`, `AssignStaffModal.tsx:215-222` |
| #11 tapping them opens "Already Assigned" with name; Cancel leaves unselected, Assign selects | PASS | `AssignStaffModal.tsx:134-142,233-245`; test |
| #12 bulk assign / Remove | PASS | shared |
| #13 save failure "Failed to save" | PASS | G1 |
| #14 scrim does not dismiss form; month / year pickers do | PASS | `Select` sheets |
| #15 no preload / no `unassigned-all` | PASS | not ported (B6) |
| #16 plan gate | DEVIATION-OK | B6 Deferred |
| #17 N+1 requests for assigned users | DEVIATION-OK | uses `user_ids` from list, per-template fallback only if server omits (B6, spec §13) |
| §7 percentage 0-100 inclusive (0 allowed), decimals, unique | PASS | `bonusForm.ts:25-28` (see N1) |
| §8 labels "Bonus (calculated by Basic Salary) *", "Enter percentage", "Month *", "Year *", "Select Month/Year" | PASS | `incentiveConfigs.tsx:171-206` |
| Dead unassigned-staff modal, logo chain | DEVIATION-OK | not ported (FIX_POLICY B.7) |

## count_basis (`countBasisConfig`, `incentiveForms.ts`)

| Item | Status | Evidence / fix |
|---|---|---|
| #1 list cards with three values and `₹{each_incentive}` | PASS | `incentiveConfigs.tsx:289-295`; test |
| #2 enriched preload from chooser | DEVIATION-OK | list endpoint already carries details; per-row details call only if columns missing (`api/payroll.ts:411-420`, spec §13) |
| #3 "+ Add Count", `Count {max+1}` | PASS | |
| #4 empty -> three "... is required" together | PASS | `incentiveForms.ts:34-37`; test |
| #5 non-numeric / zero -> "Must be a valid number" | PASS | `incentiveForms.ts:39-46`; B.10 table (`0`, negatives, `12abc`, `1e3`, `Infinity`, `NaN`, 2.5) |
| #5b whole-number fields flag a decimal as soon as it is typed | GAP-fixed | G3: live check used the "positive number" rule so `12.5` showed no error until SAVE; now `liveWholeNumberError` (`utils/numbers.ts`, `incentiveConfigs.tsx` count fields); new tests |
| #6 duplicate value in any of the three fields names the other template | PASS | `incentiveForms.ts:48-56`; all three reported together (v1 stopped at the first; superset) |
| #7 add -> "Saved Successfully!", refetch | PASS | `api/payroll.ts:460-469` body `{org_id, template_name, count_upto:int, next_count:int, each_incentive}` |
| #8 edit loads details, modal does not open on failure | DEVIATION-OK | edit opens from the list row, no `details/{id}` call (B6; avoids per-staff copy row) |
| #9 PUT `{count_upto, next_count, each_incentive}`, "Updated Successfully!" | PASS | `api/payroll.ts:472-479` |
| #10 Delete on highest, refetch, popup | PASS | |
| #11 assign "Loading..." then lists | PASS | skeleton (B6) |
| #12 save failure "Failed to save" | PASS | G1 |
| #13 Cancel closes, scrim does not | PASS | |
| §3 `₹undefined` / decimals truncated by `parseInt` | PASS | rejected, never truncated (B6; B.10) |
| §3 no saving state / double submit | DEVIATION-OK | "Saving..." and busy guard (B6) |
| §8 copy | PASS | "Count Upto Basic Salary", "Next Count", "Each Incentive", placeholders |

## turnover (`turnoverConfig`)

| Item | Status | Evidence / fix |
|---|---|---|
| #1 `Turnover {n}`, `Basic Salary: ₹{turnover}`, `{percent}%` | DEVIATION-OK | kept v1 label (B6 Deferred); second redundant badge dropped (spec §13) |
| #2 "+ Add Turnover", `Turnover {max+1}` | PASS | |
| #3 empty -> "Turnover upto is required" + "Incentive is required" | PASS | `incentiveForms.ts:86-88`; test |
| #4 zero / non-numeric -> "Must be a valid number" | PASS | table test over both fields |
| #5 duplicate turnover amount error; duplicate percent and 150 % allowed | PASS | `incentiveForms.ts:93-95`; test (uncapped kept, see N5) |
| #6 add -> "Saved Successfully!", refetch | PASS | `api/payroll.ts:482-490` body `{org_id, template_name, turnover_upto, incentive_percent}` |
| #7 edit prefilled; PUT same body (v1); "Updated Successfully!" | PASS | `incentiveConfigs.tsx:411-413`, `api/payroll.ts:493-501`; test |
| #8 delete rule / popup | PASS | |
| #9 assign / Remove copy | PASS | shared |
| #10 chooser pre-populates | DEVIATION-OK | as count_basis #2 |
| #11 failure "Failed to save" | PASS | G1 |
| §13 `console.log` of payload, PUT unused fields | PASS | not ported / kept body per spec |

## incentive (`IncentiveChooserScreen`)

| Item | Status | Evidence / fix |
|---|---|---|
| #1 chooser "Select Incentive Type" with Count Basis / Turnover Basis | PASS | `screens/IncentiveChooserScreen.tsx`; test (no Overtime / Bonus entries) |
| #2 "✕" returns | DEVIATION-OK | real page with the standard back control (spec §13) |
| #3 / #4 Loading... then populated target | DEVIATION-OK | no pre-fetch; targets load their own data (spec §13, B6) |
| #5 pre-fetch failure still opens target | PASS | navigation is independent of any fetch |
| #6 no blank page on return | PASS | real page (B6) |
| #7 Android back | PASS | standard back works |
| #8 params ignored | PASS | |
| Navigation only through `routes` | PASS | `IncentiveChooserScreen.tsx:15-25` |
| Dead count list / add UI | DEVIATION-OK | not ported (B.7) |

## Fixes made

| ID | Defect | Fix | Files | Tests |
|---|---|---|---|---|
| G1 | When the server answered `{success:false}` without a message, toasts used API-layer wording ("Failed to save payslip template", "Failed to save incentive", "Failed to delete incentive", "Failed to unassign staff", "Failed to delete payslip template") instead of the v1 copy in spec §8 (B6 listed this as a known gap) | fallback strings aligned to v1: "Failed to save template", "Failed to delete template", "Failed to save", "Failed to delete", "Failed to unassign"; server messages still win | `src/api/payroll.ts` (strings only, no behaviour change) | `specConformance.test.ts` "failure copy" (12 calls + server-message-wins) |
| G2 | Payslip custom-row amount error ("Enter a valid amount") stayed visible after the amount was corrected until the next Save | error cleared when that row's amount changes | `src/features/payroll/screens/PayslipEditScreen.tsx` (`setLines`) | `specConformance.test.tsx` "inline custom-row amount error clears" |
| G3 | count_basis Count Upto / Next Count showed no live error for a decimal (`12.5`) although SAVE rejects it | `liveWholeNumberError` (whole number > 0) used for those two fields | `src/features/payroll/utils/numbers.ts`, `src/features/payroll/config/incentiveConfigs.tsx` | `specConformance.test.ts` + `.test.tsx` count live tests |
| G4 | No tests pinned: payslip save success / failure / saving state / PUT url, delete and assign failure feedback, preview money formatting and negative net pay, B.10 across all validators, number-to-words table, wire bodies, totals parity with the server formula | tests added | `src/features/payroll/__tests__/specConformance.test.ts`, `specConformance.test.tsx` | 137 new tests (all pass) |

No shared (outside `src/features/payroll`) files changed other than the string-only edit of `src/api/payroll.ts` (G1; the one external consumer, the employee feature, only calls `getPayslipPreview` / `getAssignedPayslipId` which are unchanged).

## Needs decision (behaviour unchanged)

| # | Item | Evidence | Question |
|---|---|---|---|
| N1 | Bonus percentage 0 is accepted | bonus §7 "0-100 inclusive (0 allowed)" and unit test; FIX_POLICY B.10 asks to reject 0 only where v1 accepted it by mistake | Is a 0 % bonus intended? If not, change `percentValue` lower bound to > 0 |
| N2 | Payslip Basic / HRA of 0 accepted (spec: "The value '0' passes") | `payslipForm.ts:66-71` | Keep, or require > 0 for Basic |
| N3 | No decimal-places cap on money fields (wage / OT / count / turnover / payslip). Payslip live totals round each typed addend to paise, so an input with 3+ decimals (1000.755) could differ from the server's exact float sum by under 1 paisa | `lib/format.parseMoney` has a 2-decimal option not used here | Cap at 2 decimals (`parseMoney`)? Needs a rule on what the backend stores |
| N4 | No upper bound on amounts, overtime hours, counts (a 20-digit value is sent and rejected by the backend with a generic failure) | `utils/numbers.ts` | Set per-field maxima |
| N5 | Turnover incentive percent uncapped (>100 allowed); count uniqueness on all three fields; hourly / overtime / bonus / turnover uniqueness client-side only | specs §7, B6 Deferred | Confirm intent; server-side enforcement |
| N6 | Turnover card label "Basic Salary: ₹{turnover}" (v1 wording, misleading) | B6 Deferred | Product to confirm wording |
| N7 | Daily / hourly assignment silently moves staff off their other template; unassigned list does not say which template; overtime allows several templates per staff; bonus only warns | B6 Deferred; needs backend field | Add per-staff "currently on template X" confirmation? |
| N8 | Delete is client-side "highest number / newest only"; server does not enforce, and delete leaves assignments / numbering gaps | B6 Backend needs | Server cascade or refuse-when-assigned |
| N9 | Plan gate `salary_structure` and manager permissions ("Salary Management", "Incentive Management") are applied by the Settings and manager-shortcut entries only, not inside these screens (v1 behaviour; route-level admin / manager guard for `/admin/payroll/*` is outside this slice and was not verified here) | specs §Plan gating; B6 Deferred | Close the hole for plan-blocked orgs? |

Other observations: `docs/changes/B6.md` states 113 tests; the payroll feature suite had 94 tests before this audit and has 231 now (137 added). Spec items depending on deployed-backend envelopes (`/api/daily-wages`, `/api/hourly-charges`, `/api/wages`) remain unverified (B6 Backend needs).
