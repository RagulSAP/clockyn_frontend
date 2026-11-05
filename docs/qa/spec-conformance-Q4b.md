# Spec-conformance audit Q4b: admin settings/billing, payroll, reports

Scope: `04_admin_settings_billing` (8 specs; `other_apps` dropped), `05_admin_payroll` (9 specs; `payslip_template` dropped), `06_admin_reports` (10 specs). The traceability matrices (one table per spec: bullet, status, evidence or fix) are in the three detail files below. This file is the merged summary.

| Slice | Detail file | PASS | DEVIATION-OK | GAP-fixed | Needs-decision |
|---|---|---|---|---|---|
| 04 settings, support, billing | `spec-conformance-Q4b-04.md` | 182 | 68 | 5 | 7 items (4 rows) |
| 05 payroll | `spec-conformance-Q4b-05.md` | 129 | 29 | 3 defects + test pins | 9 |
| 06 reports | `spec-conformance-Q4b-06.md` | 130 | 54 | 8 | 6 |
| Total | | 441 | 151 | 16 defects fixed | 22 |

Row counts are those stated in each detail file. One row may cover several near-identical bullets.

## Gaps fixed

- 04 billing and settings:
  - Upgrade modes B/C hint text now reads "Min 10 · Unlimited". The old test matched a substring and could not fail.
  - The invoices error panel now has the "Could not load invoice history" title and a "Retry" label.
  - The iOS view-only subscription card now has its own wording.
  - The Android background-location refusal now opens OS settings.
  - The legacy support reply label now reads "Admin Reply" (`src/api/support.ts`, a shared file, one string).
- 05 payroll:
  - The `{success:false}` fallback copy in `src/api/payroll.ts` now uses the v1 wording.
  - The payslip custom-row amount error now clears on edit.
  - The count_basis whole-number check is now live.
- 06 reports:
  - Late-report time display in `utils/lateRule.ts`: AM/PM shift times display unchanged, and ISO punch-ins show in IST.
  - A request with no stored status now counts as pending.
  - A `-` or empty branch/dept is no longer sent to the working-days call.
  - History dedupes by file name on web.
  - The staff-detailed, late and shifts queries no longer refetch on window focus.
  - Duplicate staff ids in the shift report are removed.
  - The company sub-title on the shifts report is fixed.

## Money and formula result

- No arithmetic defect was found in pricing or payslip totals.
- Pricing: every worked example in the upgrade_plan and payment_summary specs was re-derived and is pinned by executed tests. The posted order amounts are 8,496 / 7,646 / 8,602. A renewal is 3,540. A staff-only upgrade from 12 to 20 with 4 months left costs 1,510.
- Operation order is credit, then coupon (round half up, on the post-credit base), then GST 18% (round half up).
- Payslip totals match the server formula. The 42000 / 1800 / 40200, 1000.75 and 125000.75-in-words examples are pinned.
- Report derivations (absent 26/20/3, hours, overtime, shift counts) and export contents (real mime and extension, CSV BOM and quoting, xlsx header, escaped HTML) are pinned by the new `specConformance` and `exportContents` tests.

## Needs decision

Behaviour was not changed for any of these. The evidence is in each detail file's Needs-decision section.

- 04, items N1-N7:
  - The v1 settings scroll lock was not ported.
  - The company logo is missing in headers.
  - Background location cannot be re-requested once foreground is on.
  - Pay is disabled at a Rs 0 total, which the spec does not say.
  - The grand total would be fractional if prices were ever non-integer.
  - Coupon fallback wording is undecided.
  - The B5-deferred pricing and renew backend items are still open.
- 05, nine items:
  - Bonus of 0% is accepted.
  - Payslip Basic/HRA of 0 is accepted.
  - There is no 2-decimal cap on money fields.
  - There are no upper bounds on amounts, hours or counts.
  - Turnover percent is uncapped.
  - The turnover "Basic Salary" label is misleading.
  - Daily and hourly assignment moves staff silently.
  - Delete is a client-only newest-only rule.
  - The route-level plan and manager guard for `/admin/payroll/*` was not verified.
- 06, N-1 to N-6:
  - Manager scoping is org-wide in the report screens and the manager "All Staff" PDF.
  - Backend endpoints are missing or lack fields: overtime-report, salary monthly-list and mark-paid, and shift times in monthly-attendance.
  - The late-rule definition and the dead Half Day column.
  - Salary type is always MONTHLY_FIXED and fine is always 0 on the server.
  - Attendance PDFs are fetched without auth headers.
  - Employee-profile PDF/DOC with PII persists in the shared saved-files folder, and same-name exports across orgs overwrite each other.

## Verification (final)

- Jest:
  - 04: settings + billing + supportSystem, 164 tests pass.
  - 05: payroll + api/payroll, 250 tests pass.
  - 06: reports, 113 tests pass.
- `npx tsc --noEmit`: 0 errors for the whole project (re-run by the lead).
- `npx eslint` on all three feature folders: clean.
- `npm run check:brand`: passes (re-run by the lead after the other engineer's `docs/qa/Q4d-C.md` was corrected).
