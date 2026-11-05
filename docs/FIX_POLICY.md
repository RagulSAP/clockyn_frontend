# Fix policy — "same functionality, v1 issues fixed"

Two rules pull in different directions, so every change is classified:

## A. PRESERVE (behaviour must match the specs exactly)
All features, flows, copy (minus legacy names), validations, formulas (pricing, hours, salary…), role/plan gates **as intended**, API payloads/endpoints, status machines, polling intervals, limits. If a spec says "port as-is", port as-is. When the spec and old code disagree, the code (as described in the spec §7) wins.

## B. FIX NOW (defects with an unambiguous correct behaviour; no product decision, no backend dependency)
Apply these everywhere they occur:
1. **Dates** — use `@/lib/datetime` only. Business timezone is **IST (Asia/Kolkata)** for "today", month ranges and date strings sent to the API (v1 used UTC in many places → wrong day 00:00–05:30 IST; month-end day dropped). Never call `toISOString().slice(0,10)` for a business date.
2. **Async hygiene** — every async handler uses try/catch/finally (`useAsyncAction` / mutation hooks); loading overlays/spinners always clear; failures show an error toast (use the server `detail` when present); `success:false` responses are surfaced, never ignored. No "stuck spinner", no silent failure, no success toast on failure.
3. **Auth/login** — validate role **before** persisting the session; handle `success:false` after OTP verify; clear stale device-mismatch state when the number changes; `validateOTP` errors surface the server `detail`.
4. **Reactive session wiring** — session poll, force-logout listener and sockets start/stop with the auth store (no cold-start snapshot). Sign-out always: stop location tracking, close sockets, clear query cache + stores + badge counts.
5. **Plan gating inputs** — read plan status from the plan-status API (`useOrgPlan()`), not from a possibly-missing stored `plan_id` (fixes staff/manager CRM tab wrongly blocked). The gating **matrix** itself is unchanged (see `src/config/plans.ts`).
6. **Param/contract mismatches** — pass the right fields: e.g. group list/badge use `org_id` (not `organization_id`); lead edit keeps the required date (`requiredDate`/`createdDate` mapping); badge counters computed from correct fields; the `/addstaff` response lacks `branch_id` → load branch via the profile endpoint that has it (or skip geofence preload as v1 effectively did) — document in the change log.
7. **Dead/orphan code is not ported**: orphan screens (`add_department`, `payslip_template`, `track_location`, `emp_permission_calendar`), unreachable flows (OTP-gated delete in v1 "beyond" page), dead flags/keys, `test_upload` button, in-memory-only fake features (mute/pin/theme in chat) — except where the spec marks them LIVE. Placeholders that are reachable (`assign_devices` "coming soon") are kept.
8. **Display bugs** — mojibake text, truncated decimals (`parseInt` on money), missing render conditions, wrong badge counts, unscoped caches (cache keys include orgId/userId), listener/socket leaks, non-reconnecting sockets (use `createSocket` with backoff), toasts not mounted in some views, wrong-month leave chip removal, `branch filter does nothing` where a filter control exists (make it work).
9. **Exports** — "PDF" must be a real PDF (native: `expo-print`; web: print-to-PDF), Excel a real `.xlsx` (`xlsx`), CSV with BOM + RFC-4180 escaping, DOC may remain HTML-in-.doc; HTML exports escape values; the saved-report history stores the real mime/extension and opens correctly.
10. **Input validation holes** — numeric fields reject 0/negative/non-numeric where the spec shows they were accepted by mistake (advance amount, rates, etc.); decimal allowance rate sends what the backend accepts (see backend_changes.md).
11. **Security hygiene** — no secrets or keys in the repo; no OTP/PII in logs; escape rendered HTML.

## C. DEFER (do NOT change in this phase — keep v1 behaviour, log it)
Anything that changes a product rule or needs a backend decision, e.g.: face-punch "force_accept" fallback / advisory geofence; plan matrix (which plan blocks what); renew-doesn't-extend semantics and client-side pricing/credit rules; absence of OTP resend; admin single-device enforcement (admins have no device token); manager scoping rules; late-report definition; whether "Late By", "Half Day" etc. are computed server-side; leave/permission rules (future dates, max 6 h); carry-forward lifecycle semantics (persisting `carry_forward`); announcement targeting rules.
For each deferred item: keep v1 behaviour and add a line to your `docs/changes/<id>.md` under **Deferred**.

## D. Backend-dependent fixes
If a proper fix needs a backend change (missing route, wrong field, wrong status code, missing `date_statuses`…), do the best client-side behaviour that keeps v1 behaviour, and add an entry under **Backend needs** in your change log (endpoint, current behaviour, needed change, impact). The lead compiles `backend_changes.md` from these logs.

## E. Legacy naming (hard rule)
Never write the previous product/vendor names in any form, including comments, test names, storage keys, notification channel ids, file names, and mock data. Use "Clockyn" or neutral wording. Contact e-mails/URLs come from `env`. If a v1 feature exists only to promote other products by name (v1 "Our Other Applications"), do not port it.
