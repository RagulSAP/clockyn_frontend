# Q2 - E2E report (admin operations)

Scope delivered: payroll, reports + exports, requests, expenses review, location, direct chat (admin). Group chat, announcements, chat hub badges / plan gate and admin CRM were handed to Q2b and are not covered here.
Harness: Playwright on the web export, mock backend, isolated ports (`E2E_ARTIFACTS=e2e/.artifacts-q2 MOCK_PORT=8802 E2E_WEB_PORT=8820 E2E_WEB_PORTS=4 E2E_WORKERS=4`). Each spec runs on `desktop` (1280x800) and `phone` (390x844).

## Journeys -> spec -> result

| Journey | Spec | Result |
|---|---|---|
| Payslip templates: list (net salary, assigned count), delete newest-only, create with live decimal totals + custom rows (no NaN, payload), validation messages, edit/PUT, save failure, assign with branch filter + preview + already-assigned refusal, delete confirm / cancel / failure, empty state | `q2-payroll-payslips.spec.ts` | green |
| Daily wages, hourly, overtime, bonus, count basis, turnover: create + validation messages + duplicates + numbering, edit, server refusal, assign / unassign modal, delete latest only, incentive chooser | `q2-payroll-templates.spec.ts` | green |
| Monthly salary: pay one / selected (confirm) / all, totals, period change resets paid marks, server paid state survives reload, failure + `success:false`. Salary sheet: columns, advance drill-down (data / empty / error+retry), type overrides + reset, frozen column stays put on horizontal scroll, desktop vertical scroll sync, xlsx | `q2-salary.spec.ts` | green |
| Exports: CSV (BOM, RFC-4180, formula neutralising, row/column counts), real `.xlsx` opened with the `xlsx` package, DOC (escaped HTML), PDF print path (single print, no refetch, escaped, failure toast), late / overtime / salary-sheet / employee-details exports, saved-report history (type, share / open, replace same file, delete confirm, stale-after-reload, org scoping, cap 50) | `q2-reports-exports.spec.ts` | green |
| Reports hub (tabs, inert placeholders, navigation), monthly attendance PDF (+ failure), staff-detailed / late / overtime / employee-details / shifts: pickers, data, partial-failure banners, empty + error states; manager variant `/staff/reports` (permission gate, scoped endpoint) | `q2-reports-screens.spec.ts` | green |
| Requests: hub pending / unread rules (seen per list, id based), leave (per-date calls, partial failure message, `success:false`), permission (per-date cards), shift-change, device-change (token cleared), 10 s polling with a fake clock, load failure, header pill | `q2-requests.spec.ts` | green |
| Expenses: odometer (amount maths, integer rate editor validation + re-pricing, photo viewer, approve / reject, failures, date filter), travel, bills | `q2-expenses.spec.ts` | green |
| Location: markers, 15-min freshness with fake clock, branch filter, route polyline + fitted viewport, today-only polling, load failure, plan gate (core / expired / none / elite) | `q2-location.spec.ts` | green |
| Direct chat: list + staff search, send, optimistic / failure / Retry / Discard, read ticks, image + file upload, viewer, date separators, open-at-latest + scroll-to-latest, in-chat search, delete chat, WS push to open vs other conversation, unread clearing, socket drop + reconnect | `q2-chat-direct.spec.ts` | green |
| Visual sweep of 32 screens / states in light + dark with automatic overflow / NaN checks | `q2-visual.spec.ts` | green |
| Layout regressions for the defects below | `q2-layout-regressions.spec.ts` | green |

Totals: 11 spec files, 306 test instances (153 per project). Last runs: every spec file green on desktop and phone (2 intentional phone/desktop-only skips); the location spec was re-run after the final map fix (22/22) and visual + layout + salary after the last UI fixes (94 passed, 2 skipped).

## Defects found

| # | Sev | Defect | Evidence | Fix | Regression test |
|---|---|---|---|---|---|
| 1 | High | A long chat opened at the TOP (virtualised list pinned to the end only on the first content-size event), so the latest message was off screen and "Scroll to latest message" never appeared (no scroll event ever fired). Also the last bubble was clipped when pinned too early. | `q2-chat-direct` long conversation; screenshots | `src/features/chat/components/MessageList.tsx`: keep pinning to the end until the content size is stable for 350 ms | `q2-chat-direct` "long conversation opens at the latest message..." |
| 2 | Medium | Selecting a field employee on the location map left the viewport at street level: Leaflet drops a `setView` issued while a zoom animation is running, so the fit-to-route (arriving right after selection) was lost; route ends were far outside the map. | tile-zoom trace (z15 only) | `src/lib/platform/maps/ClockynMap.web.tsx`: zoom changes jump (`{reset:true}`), pans keep the animation | `q2-location` route test asserts S and E pins inside the map |
| 3 | Medium | Report generation failure showed "Server returned 500" instead of the server `detail` (FIX_POLICY B2). | `q2-reports-screens` monthly attendance failure | `src/lib/platform/files.ts` `downloadAndOpen` reads JSON `detail` / `message` | same test |
| 4 | Medium | Monthly Salary "Total Amt / Unpaid Amt" KPI values cut as "₹4,08,0..." on a phone (`adjustsFontSizeToFit` does nothing on web). | phone screenshot | `src/components/ui/StatCard.tsx` steps the font size down with value length | `q2-layout-regressions` |
| 5 | Medium | Odometer / reviews: "Approve" cut to "Appro..." beside Photos + Reject on a phone. | phone screenshot | `src/features/expenses/admin/components/ReviewParts.tsx` Photos takes its own row while decisions are pending | `q2-layout-regressions` |
| 6 | Low | Location freshness counters lost the "15 MINS" part of their label on phones. | phone screenshot | `StaffLocationScreen.tsx` stats one per row on phones | `q2-layout-regressions` |
| 7 | Low | Frozen Employee column took ~55% of a phone screen (salary sheet, staff-detailed, late, overtime), leaving a sliver for data. | phone screenshots | `EmployeeCell.tsx` `useEmployeeColumnWidth` (168 px on phones) used by the four tables | `q2-layout-regressions` |
| 8 | Low | Payslip assign dialog: action column misaligned (Assign vs Assigned width) and names squeezed onto 3 lines. | phone screenshot | `PayslipAssignModal.tsx` fixed-width action cluster | `q2-layout-regressions` |
| 9 | Low | Image viewer did not close on Escape when the opener kept focus (chat composer). | `q2-chat-direct` image viewer | `src/components/ui/ImageViewer.tsx` document-level Escape listener on web | same test |

Mock fixes (additive): advance rows now carry `created_by_name` (the app shows "Added by"); location history compares the IST calendar date of a ping (was UTC); new control endpoint `POST /__test/drop-sockets` + `MockClient.dropSockets()`.

## Open items / needs a decision

* Odometer card shows "STOP 0 km" / "0.0 km" for a reading with a start but no stop yet (v1 copy, ported on purpose). Product may prefer "-".
* Web saved-report files live in memory: after a page reload every history entry is flagged "File no longer available" (documented web limitation; the PDF print path is never recorded).
* Header of the staff-detailed report truncates its title ("Staff Detailed R...") next to Export on a phone.
* Custom payslip rows have no rupee prefix on the amount field (cosmetic).
* Sidebar highlights "Home" while on `/admin/reports` and `/admin/location` (they hang under Home) - intended, noted.
* `npm run e2e:typecheck` currently fails in another lead's file (`q3-11-visual.spec.ts`), not in Q2 files.

## Screenshots reviewed

`<artifacts>/screenshots/q2/{desktop,phone}/<screen>-{light,dark}.png` for 32 screens. Looked at (phone unless noted): payslips light, payslip-edit dark, salary-sheet light, monthly-salary light, requests-leave dark, requests-hub dark, odometer light, location dark + desktop light, chat conversation dark, staff-detailed light + desktop dark, reports hub desktop, payslip-assign modal dark, advance sheet light. Everything else was covered only by the automatic overflow / NaN checks (no horizontal overflow on any screen).

## Coverage gaps

* Group chat, announcements, chat hub badges / plan gate, admin CRM: Q2b.
* Screens not individually inspected visually (only auto-checked): payslip list desktop, count-basis / turnover / bonus / overtime / hourly cards, reports late / overtime / shifts / employee details, travel / bills, requests permission / shift / device, chat list.
* Dark-mode contrast was judged by eye on the screenshots listed above, not measured.
* Native-only behaviour (expo-print file, share sheet, native maps) is out of scope on web.
* Real backend payroll maths is not exercised (mock derivation).
* Camera capture in chat (`capture` input) and video messages not driven.
