# Spec-conformance audit Q4b-04 — admin settings, support, billing

Scope: spec folder `04_admin_settings_billing` (settings, beyond, support, suggest_feature, subscription, upgrade_plan, payment_summary, invoices; `other_apps` intentionally dropped). Implementation: `src/features/settings`, `src/features/billing` (+ `src/api/billing.ts`, `src/api/support.ts`, `src/config/plans.ts`, `src/lib/datetime.ts`).
Status legend: PASS, DEVIATION-OK (cites FIX_POLICY section / `docs/changes/B5.md` / BUILDER_BRIEF), GAP-fixed (found and fixed here), Needs-decision (behaviour untouched, see the last section).

## Summary

| Status | Count |
|---|---|
| PASS | 182 |
| DEVIATION-OK | 68 |
| GAP-fixed | 5 (A7 hint, I3 error panel, U17 iOS wording, B4 background-location settings, P11 legacy reply label) |
| Needs-decision (traceability rows) | 4 (S2, S23, S52, M39); 7 open items in the final section (N1-N7) |

259 traceability rows in total. Fix 6 in "Fixes made" is a test-only hardening (no behaviour change).

Verification (final run): `npx jest src/features/settings src/features/billing src/api/__tests__/supportSystem.test.ts` -> 13 suites / 164 tests green (was 12 / 128 before this audit; +36 tests). `npx tsc --noEmit` -> 0 errors. `npx eslint src/features/settings src/features/billing src/api/support.ts` -> clean. `npm run check:brand` -> fails ONLY on 4 lines of `docs/qa/Q4d-C.md` (another QA engineer's report, not in this slice); nothing in the files owned by this audit hits the brand check.

Money/formula result: every worked example of upgrade_plan §7.10 (a-d) and payment_summary §7 / §14 re-derived by hand and pinned by executed tests at BOTH the pure-function level (`pricing.test.ts`, pre-existing, verified correct) and now at the screen level (`CheckoutScreen.test.tsx`: plan change with credit + 10 % coupon = Rs 8,602 posted as the order amount; expired plan = no credit; credit > charge floors at 0; renewal = Rs 3,540 with the current plan id; staff-only upgrade 12 -> 20 with 4 months left = Rs 1,510 for 8 extra staff, `staff_limit=8`). No arithmetic defect was found: staff charge unrounded; credit -> coupon (round half up, on the post-credit base) -> GST 18 % (round half up) in the exact v1 operation order.

---

## 1. settings (`settings.md`)

| # | Bullet / rule / copy / flow | Status | Evidence / fix |
|---|---|---|---|
| S1 | §14 8 rows in listed order, company name under "Settings" | PASS | `settingsMenu.ts:47-122`, `SettingsScreen.tsx` title/subtitle; `SettingsScreen.test` "renders every section in order" (+ "Appearance" row added: DEVIATION-OK, B5 Deviations) |
| S2 | §14 no accordion open -> list does not scroll | Needs-decision | v1 scroll lock not ported (N1) |
| S3 | §14 one accordion open at a time | PASS | `SettingsScreen.tsx` `toggleSection`; test "only one accordion is open" |
| S4 | §14 active/trial plan -> Salary children (Monthly Fixed, Daily Wages, Hourly, Incentive/OT/Bonus, Fine/Deduction) | PASS | `settingsMenu.ts:65-82`; test "salary structure: nested incentive group" |
| S5 | §14 expired/no plan -> subtitle "Upgrade plan to access", no expand, info toast (Core subscribe message) | PASS | `salaryGate.ts:14`, `config/plans.ts` `planBlockMessage`; tests in `logic.test` + `SettingsScreen.test` |
| S6 | §14 plan-status API fails -> not blocked | PASS | `config/plans.ts` `isFeatureBlocked` (null -> false); test "fails open" |
| S7 | §14 Monthly Fixed -> overlay + `GET /api/salary/templates` + `preloadedData` | DEVIATION-OK | B5 Fixes (prefetch + JSON `preloadedData` removed; BUILDER_BRIEF §2.4 no JSON blobs in route params); row navigates with a typed route `routes.admin.payroll.payslips` |
| S8 | §14 same for Daily Wages / Hourly / Overtime / Bonus / Count / Turnover | DEVIATION-OK | same as S7 (`settingsMenu.ts:66-81`, `INCENTIVE_OPTIONS`) |
| S9 | §14 Incentive nested row -> "Select Incentive Type" (Count / Turnover) closes and navigates | PASS | `SettingsScreen.tsx` incentive BottomSheet; test |
| S10 | §14 Shift Setting `[{id,name,startTime,endTime}]` mapping | DEVIATION-OK | B5 (target screen reads query cache) |
| S11 | §14 Odometer parallel fetch + `preloadedRate`, no-params fallback | DEVIATION-OK | B5 (prefetch removed) |
| S12 | §14 Managers -> `getManagers` array passed | DEVIATION-OK | B5; row -> `routes.admin.managers.list` |
| S13 | §14 prefetch fails -> overlay disappears, nothing navigates, no toast | DEVIATION-OK | no prefetch, no overlay (B5 Fixes; FIX_POLICY B2 forbids silent failure) |
| S14 | §14 return to Settings -> no loading overlay | DEVIATION-OK | n/a, no overlay exists |
| S15 | §14 Beyond open -> six children; App Permissions `/beyond?page=permissions`; More Options internal view | DEVIATION-OK | 5 children ("Our Other Applications" dropped, BUILDER_BRIEF §2 / FIX_POLICY E); real routes `/admin/permissions`, `/admin/more` (B5 Deviations) |
| S16 | §14 More Options: hardware back -> main; Privacy back -> More Options | PASS | `MoreOptionsScreen.tsx` BackHandler + `onBack`; NEW test "Android hardware back on the privacy page" |
| S17 | §14 Privacy view: policy page + "Request Account Deletion" / "I Understand, Go Back", no bottom nav | PASS | `MoreOptionsScreen.tsx`, `PrivacyPolicyView.tsx` (URL from `env`, graceful unconfigured state) |
| S18 | §14 confirm "Submit Request" + success -> toast, `is_active` 0, ~1.5 s logout | PASS | `accountDeletion.ts:8-33`; `logic.test` + `MoreAndPermissions.test` |
| S19 | §14 `{success:false, detail}` -> error toast, stay logged in | PASS | `MoreOptionsScreen.tsx` catch -> `getErrorMessage`; test "failed deletion request" |
| S20 | §14 network down -> "Network error. Try again." | DEVIATION-OK | FIX_POLICY B2 (error mapping uses the shared network message) |
| S21 | §14 Logout confirm -> auth + caches cleared, stack reset | PASS | `SettingsScreen.tsx` `signOut()` (FIX_POLICY B4 no manual navigation); test |
| S22 | §14 back arrow on main -> `/home` + prefetch | DEVIATION-OK | tab root, `hideBack` (B5 Deviations) |
| S23 | §14 logo update elsewhere updates header logo | Needs-decision | B5 Known gap: no logo in the header (N2) |
| S24 | §14 "Fine / Deduction" -> toast "Coming soon" | PASS | `settingsMenu.ts:81`; test |
| S25 | §7 Salary gate = not trial AND (expired OR no plan) | PASS | `config/plans.ts` `isPlanFeatureBlocked`; `logic.test` gate matrix |
| S26 | §7 gate never re-evaluated (race) | PASS | FIXED in B5: `useOrgPlan()` query (FIX_POLICY B5) |
| S27 | §7 only one accordion; Fine placeholder; deletion is a request | PASS | see S3, S24, S18 |
| S28 | §7 UTC date in dashboard prefetch | DEVIATION-OK | prefetch removed; IST helpers only (FIX_POLICY B1) |
| S29 | §8 header `Settings` / company name | PASS | `SettingsScreen.tsx` |
| S30 | §8 8 row titles + subtitles | PASS | `settingsMenu.ts:47-122` |
| S31 | §8 company / salary / attendance / expenses children copy | PASS | `settingsMenu.ts`; `logic.test` "accordion children match the spec copy" |
| S32 | §8 Beyond children incl. Logout | PASS | 5 children (other-apps dropped, see S15) |
| S33 | §8 `Loading...` overlay | DEVIATION-OK | no overlay (B5) |
| S34 | §8 `Select Incentive Type`, `Count Basis`, `Turnover Basis` | PASS | `SettingsScreen.tsx`, `INCENTIVE_OPTIONS` |
| S35 | §8 Logout confirm `Logout` / `Are you sure you want to logout?` | PASS | `SettingsScreen.tsx` logout |
| S36 | §8 More Options title + `Privacy Policy` / `View our privacy policy` | PASS | `MoreOptionsScreen.tsx` |
| S37 | §8 Privacy view buttons; delete-confirm title/message/confirm | PASS | `MoreOptionsScreen.tsx` |
| S38 | §8 delete success / failure toast copy | PASS | `accountDeletion.ts:9`; fallback `Failed to submit request` |
| S39 | §4 F1 goHome + prefetch | DEVIATION-OK | S22 |
| S40 | §4 F2 blocked Salary tap -> info toast | PASS | S5 |
| S41 | §4 F3 accordion toggle (closing salary resets nested group) | PASS | `SettingsScreen.tsx` `setOpenGroup(null)` |
| S42 | §4 F4/F5 plan / reports / company rows | PASS | `settingsMenu.ts`; company edit route without `orgId` = add mode (`config/routes.ts:36`) |
| S43 | §4 F6 prefetch-then-navigate | DEVIATION-OK | S7 |
| S44 | §4 F7 Fine / Deduction toast | PASS | S24 |
| S45 | §4 F8 More Options internal view | DEVIATION-OK | real route (B5) |
| S46 | §4 F9 hardware back | PASS | S16 |
| S47 | §4 F10 deletion request (1-6) | PASS | S18-S20 |
| S48 | §4 F11 Managers prefetch | DEVIATION-OK | S12 |
| S49 | §4 F12 Logout | PASS | S21 |
| S50 | §4 F13 focus reset of loading flags | DEVIATION-OK | no flags (B5) |
| S51 | §4 F14 AppState permission refresh result never rendered | DEVIATION-OK | dead code not ported (FIX_POLICY B7) |
| S52 | §4 F15 logo live update | Needs-decision | N2 |
| S53 | §13 dead `handleNav 'beyond'`, `showAppPerms`, unused state | DEVIATION-OK | not ported (FIX_POLICY B7) |

## 2. beyond (`beyond.md`)

| # | Bullet / rule / copy / flow | Status | Evidence / fix |
|---|---|---|---|
| B1 | §14 Settings -> App Permissions opens the permissions page | DEVIATION-OK | `/admin/permissions` real route (B5 Deviations) |
| B2 | §14 all granted -> "3 of 3 permissions granted", "All Active", green ON | DEVIATION-OK | 4 permissions (photos added) -> "4 of 4" (B5 Deviations); `PermissionsScreen.tsx`; test "All Active" |
| B3 | §14 location not granted -> request foreground; denied -> OS settings, recheck ~1 s | PASS | `PermissionsScreen.tsx` `onCardPress`; recheck on foreground (`usePermissionStatuses`, `useAppActive`, FIX_POLICY B8 no polling) |
| B4 | §14 Android: fg granted -> background asked next; if not granted OS settings opens | GAP-fixed | background refusal never opened settings (`ok = bg \|\| ok`). Now `backgroundRefused` -> `openAppSettings()` (`PermissionsScreen.tsx` onCardPress). Test "Android opens the device settings when the background grant is refused" |
| B5 | §14 iOS never requests background | PASS | `Platform.OS === 'android'` guard; test "iOS never asks for background location" |
| B6 | §14 Camera / Notifications -> device settings, re-eval ~1 s and on focus | DEVIATION-OK | explicit grant buttons; settings opened once blocked; status re-read on foreground (B5 Deviations) |
| B7 | §14 returning from settings updates card/pill/count | PASS | `usePermissionStatuses.ts` `useAppActive` |
| B8 | §14 permissions back arrow -> `/settings` replace | DEVIATION-OK | stack back (tab root parent) |
| B9 | §14 Delete My Account -> OTP flow (mobile lookup, OTP modal, verify, final confirm, DELETE) | DEVIATION-OK | FIX_POLICY B7: unreachable OTP-gated delete page not ported (B5 line 188); reachable deletion = request flow (S18) |
| B10 | §14 OTP validation / wrong OTP / mobile lookup failure copy | DEVIATION-OK | same as B9 |
| B11 | §14 Main page "Logout" / cards | DEVIATION-OK | merged into the Settings Beyond accordion (S15, S21) |
| B12 | §14 Cancel on deletion dialogs sends nothing | PASS | test "cancel sends nothing" in `MoreAndPermissions.test` |
| B13 | §7 location ON = foreground OR (Android) background | PASS | foreground implies background; `permissions.native.ts` `read('location')` |
| B14 | §7 summary count / "All Active" iff all granted | PASS | `PermissionsScreen.tsx` `countGranted`; `logic.test` |
| B15 | §7 iOS notifications reported as always allowed | DEVIATION-OK | B5 fix: real state read (spec §13 "v2 should query real state") |
| B16 | §8 `App Permissions` header + `{n} of N permissions granted` | PASS | `PermissionsScreen.tsx` |
| B17 | §8 `Permission Status` / `Tap a card to manage in device settings` | PASS | `PermissionsScreen.tsx` |
| B18 | §8 card labels + descriptions (Location / Camera / Notifications) + ON/OFF | PASS | `permissionsLogic.ts:11-16`, `PermissionCard.tsx` |
| B19 | §8 footer note | PASS | `PermissionsScreen.tsx` |
| B20 | §8 `Our Other Applications` / Main page copy | DEVIATION-OK | FIX_POLICY E, dropped |
| B21 | §4 F1 refresh on mount + foreground | PASS | B7 |
| B22 | §4 F2-F4 delete / OTP / final delete | DEVIATION-OK | B9 |
| B23 | §4 F5 permission card tap (1 s recheck) | PASS | B3/B4 (recheck via foreground event instead of timer) |
| B24 | §4 F6 hardware back leaves route | DEVIATION-OK | spec §13 flags it as a defect; B5 handles privacy -> menu |
| B25 | §4 F7 Logout | PASS | S21 |
| B26 | §13 duplicated OTP modal, `PermRow`, `showPermissions` | DEVIATION-OK | not ported (FIX_POLICY B7) |

## 3. support (`support.md`)

| # | Bullet / rule / copy / flow | Status | Evidence / fix |
|---|---|---|---|
| P1 | §14 subjects + tickets load (`/support/subjects`, `/support/requests/{orgId}`) | PASS | `useSupport.ts`, `api/support.ts`; test asserts `listTickets('org-1')` |
| P2 | §14 no subject -> toast "Please select a subject" | PASS | `utils/support.ts:11`; test |
| P3 | §14 blank message -> toast "Please enter a message" | PASS | `utils/support.ts:11`; NEW test "message validated after the subject" |
| P4 | §14 valid form, no photo -> multipart POST (name, message, user_id, org_id), success toast, form cleared, back ~1.5 s | PASS | `SupportScreen.tsx` submit; `api/support.ts` `submitTicket`; NEW test "a successful submit clears the form and returns ... ~1.5 s" |
| P5 | §14 photo attached -> `photo` part, preview, remove | PASS | `SupportScreen.tsx`; NEW test "attaching a photo previews it, sends it ... removed" |
| P6 | §14 photo permission denied -> alert, no photo | DEVIATION-OK | toast `Please allow photo library access.` (no `Alert.alert`, CONVENTIONS; title dropped); NEW test |
| P7 | §14 server failure -> detail / message / "Submission failed (HTTP n)" | PASS | `utils/support.ts:33` `ticketSubmitError`; `logic.test`; NEW test "failed submit shows the server detail" |
| P8 | §14 30 s upload timeout -> "Upload timed out..." | PASS | `api/support.ts:SUPPORT_UPLOAD_TIMEOUT_MS=30000`; `ticketSubmitError` isTimeout |
| P9 | §14 ticket card shows subject, status badge, message, photo, date, thread | PASS | `TicketCard.tsx` (dates via `@/lib/datetime`, FIX_POLICY B1) |
| P10 | §14 replies[]: admin author or "Admin", user "You", timestamps | PASS | `replyAuthorLabel` (`utils/support.ts:28`); NEW test blank-author fallback |
| P11 | §14 legacy `reply` only -> "Admin Reply" box | GAP-fixed | mapper labelled it "Support" (B5 Known gap). `api/support.ts` `mapSupportTicket` now uses `Admin Reply`; `supportSystem.test` + NEW screen test |
| P12 | §14 empty/whitespace draft -> send disabled; send posts `{reply_text, author_name, is_admin:false}`, clears draft, reloads, "Reply sent!" | PASS | `SupportScreen.tsx` `sendReply`; existing test |
| P13 | §14 reply failure -> detail / "Failed to send reply", draft kept | PASS | existing test |
| P14 | §14 resolved ticket placeholder "Reply to reopen this ticket..." | PASS | `TicketCard.tsx`; test |
| P15 | §14 no tickets -> "My Tickets" hidden | PASS | `SupportScreen.tsx` `hideTickets`; test |
| P16 | §7 status mapping created -> Open; in_progress; resolved | PASS | `api/support.ts` `mapTicketStatus`; `utils/support.ts:24` |
| P17 | §7 subject sent by NAME; message trimmed | PASS | `SupportScreen.tsx` Select values are names; test |
| P18 | §7 resolved card tinted green | PASS | `TicketCard.tsx` |
| P19 | §7 reply author name = profile name or "You" | PASS | `SupportScreen.tsx` `authorName` from session (B5 Fixes; no extra `/addstaff` call) |
| P20 | §8 header `Support` / `We're here to help`, labels, placeholders, `Upload Photo`, `Submit Request` | PASS | `SupportScreen.tsx` |
| P21 | §8 status badge labels | PASS | `utils/support.ts:24` |
| P22 | §8 reply labels `You`, `Admin`, `Admin Reply` | PASS | P10 + P11 |
| P23 | §8 toasts `Support request submitted!`, `Reply sent!` | PASS | `SupportScreen.tsx` |
| P24 | §8 failure toast `Failed to submit. Please try again.` | PASS | `ticketSubmitError` fallback |
| P25 | §4 F0 load: tickets refreshed (spec: only after submit/reply) | DEVIATION-OK | refresh on focus + pull-to-refresh (B5 Fixes; spec §13 flags the v1 gap) |
| P26 | §4 F1 image picker quality 0.7, library, no editing | PASS | `pickImage({ source: 'library', quality: 0.7 })`; test asserts the options |
| P27 | §4 F4 subject dropdown | PASS | `Select` component |
| P28 | §10 subject load failure silent | DEVIATION-OK | hint "Could not load subjects. Pull down to retry." (B5 Fixes) |

## 4. suggest_feature (`suggest_feature.md`)

| # | Bullet / rule / copy / flow | Status | Evidence / fix |
|---|---|---|---|
| G1 | §14 empty subject -> "Please enter a subject", no request | PASS | `utils/support.ts:18`; test |
| G2 | §14 empty message -> "Please enter your message" | PASS | test |
| G3 | §14 body has trimmed subject/content, org id, company name, user email | PASS | `SuggestFeatureScreen.tsx`; `api/system.ts` `submitFeatureSuggestion`; test |
| G4 | §14 success toast + back after ~1.8 s | PASS | `SUGGEST_REDIRECT_DELAY_MS=1800`; NEW test (asserts back called after the delay, not before) |
| G5 | §14 server `{success:false,message:'x'}` -> error toast "x", text kept | PASS | `ensureSuccess` surfaces `message`; test keeps text |
| G6 | §14 network error -> "Failed to send. Please try again." | PASS | `getErrorMessage(e, FAILED)` |
| G7 | §14 limits 1000 / 120, counter `n/1000` | PASS | `SUGGEST_*_MAX`, `showCounter`; NEW test asserts `maxLength` 120 / 1000 |
| G8 | §14 submitting -> disabled, "Sending..." | PASS | `SuggestFeatureScreen.tsx`; NEW test (also double-press ignored) |
| G9 | §14 back arrow -> no request | PASS | `Screen` back |
| G10 | §7 success criterion lenient (any 2xx without success:false) | PASS | `ensureSuccess` semantics |
| G11 | §8 hero `Share Your Idea` / "Help us build a better {legacy name}..." | DEVIATION-OK | FIX_POLICY E: "Clockyn" |
| G12 | §8 labels, placeholders, counter, button, validation + success copy | PASS | `SuggestFeatureScreen.tsx` |
| G13 | §13 server `detail` never shown | PASS | B5 Fixes: server text now surfaces (`getErrorMessage`) |
| G14 | §4 F1 no double-submit guard | PASS | guard added (B5) |

## 5. subscription (`subscription.md`)

| # | Bullet / rule / copy / flow | Status | Evidence / fix |
|---|---|---|---|
| U1 | §14 Android active Core 6 mo: ACTIVE, sentence, billing date, valid until, staff strip | PASS | `PlanStatusCard.tsx`, `planState.ts:13-56`; `SubscriptionScreen.test` |
| U2 | §14 staff_limit == used -> Remaining 0 red | PASS | `PlanStatusCard.tsx` `danger={remaining===0}`; `planState.test` remainingStaff |
| U3 | §14 past end_date -> EXPIRED + "Your plan has expired. Please renew." | PASS | `deriveBillingState` (IST, end date inclusive: FIX_POLICY B1); `planState.test` |
| U4 | §14 trial active (no paid sub) -> FREE TRIAL + "Free trial ends on {date}" | DEVIATION-OK | B5 Fixes: shown for the WHOLE trial, not only the last day (spec §7/§14 invites an intentional decision) |
| U5 | §14 subscription request fails -> NO PLAN + "Select a Plan First" | DEVIATION-OK | B5 Fixes: explicit retryable error state instead of a fake NO PLAN; "Select a Plan First" kept for state `none`; test |
| U6 | §14 trial org taps Upgrade/Renew -> upgrade screen shows trial lock | PASS | `SubscriptionScreen.tsx` pushes mode; `UpgradePlanScreen.tsx:58` `trialBlocked`; test "locked during a free trial" |
| U7 | §14 Plan Details: grouped by name, tiers ascending, price + "/staff/mo" | PASS | `groupPlans` (`planState.ts:80`), `PlanDetailsSheet.tsx`; test |
| U8 | §14 active Prime 6 mo downgrade matrix (Core all disabled; Prime 1,6 disabled, 12 enabled; Elite 1 disabled, 6/12 enabled) | PASS | `isTierDisabled` (`planState.ts:105`); `planState.test` pins the exact example |
| U9 | §14 disabled tier -> "Downgrade Not Allowed"; active tier -> "You're on This Plan" | PASS | `SubscriptionScreen.tsx` `onBlockedTier`; test |
| U10 | §14 select enabled tier -> highlight + "Continue to Pay"; tap again deselects | PASS | `PlanDetailsSheet.tsx` |
| U11 | §14 Continue to Pay -> upgrade screen with plan params, mode A, no trial params | DEVIATION-OK | B5: only `mode=new` + `planId` (everything else derived from the query cache, route-param contract) |
| U12 | §14 Upgrade with subscription -> `isStaffUpgrade=true`, `existingEndDate` | DEVIATION-OK | `mode=upgrade`; end date re-derived (B5) |
| U13 | §14 Renew: active -> end date; expired -> today; `planMonth=12`, `isRenew` | PASS | `quote.ts:resolveQuoteSource` renewStart; `pricing.test` (resolveQuoteSource) |
| U14 | §14 web portal row opens the portal URL | DEVIATION-OK | URL from `env.webPortalUrl`, Android only and only when configured (B5) |
| U15 | §14 Download Invoices / Billing History -> invoices | PASS | `SubscriptionScreen.tsx`; test |
| U16 | §14 iOS: only status card, Billing History, support text | PASS | `SubscriptionScreen.tsx` `!purchase` branch; test |
| U17 | §14 iOS status wording ("... staff accounts", "Used", "No active plan") | GAP-fixed | iOS reused the Android card. `PlanStatusCard.tsx` `readOnly` variant (v1 sentences, "Used" label, no billing dates), wired in `SubscriptionScreen.tsx`; NEW tests (2) |
| U18 | §14 iOS admin footer vs non-admin sentence | PASS | `SubscriptionScreen.tsx` `role === 1`; `SupportNote.tsx` (e-mail from `env`, hidden when unset: B5) |
| U19 | §14 returning after payment refreshes | PASS | `useRefreshOnFocus`, plan keys invalidated by checkout |
| U20 | §14 API failure does not crash | PASS | ErrorState / skeleton states; test "retryable error" |
| U21 | §7 active = end date not in the past; trial overridden by paid plan | PASS | `deriveBillingState`; `planState.test` "paid active overrides stale trial" |
| U22 | §7 status label + sentence per state | PASS | `BILLING_BADGE`, `billingSentence` |
| U23 | §7 remaining staff = max(0, limit - used) | PASS | `remainingStaff` |
| U24 | §7 downgrade matrix + rank map + active tier by plan id | PASS | `planState.ts:65-118` (hard-coded rank map is a documented v1 rule, B5 Deferred) |
| U25 | §7 plan features per plan | PASS | `planFeatureList` (`planState.ts:147`) |
| U26 | §7 Upgrade/Renew need a subscription, else "Select a Plan First" | PASS | `SubscriptionScreen.tsx` `state === 'none'` (placeholder object handled via explicit state, B5) |
| U27 | §7 renew = 12 months at the current tier price | PASS | `quote.ts:resolveQuoteSource` (`RENEW_MONTHS`) |
| U28 | §7 staff-limit fallback 10 | PASS | `liveStaffLimit` (`pricing.ts:122`) |
| U29 | §7 "Plan Includes": Duration printed as "{n} months"; Amount "Rs x/month" | DEVIATION-OK | spec §13 flags it: uses `monthLabel` and "/staff/month" wording (FIX_POLICY B8 display fixes) |
| U30 | §8 header, default name `No Active Plan`, badges, sentences, meta labels | PASS | `PlanStatusCard.tsx`, `planState.ts` |
| U31 | §8 "Also available on web" / "Manage billing at {host}" | DEVIATION-OK | host from `env` (FIX_POLICY E) |
| U32 | §8 Billing Actions: 4 rows with titles + subtitles | PASS | `SubscriptionScreen.tsx` |
| U33 | §8 sheet copy (Plan Details, Valid till, pill, Plan Includes, Available Plans, `{Name} Plan`, CURRENT, Features, Select Duration, Continue to Pay) | PASS | `PlanDetailsSheet.tsx` |
| U34 | §8 popups: current / downgrade / select-first (title + message + button) | PASS | `SubscriptionScreen.tsx:309-335` |
| U35 | §8 dead "Not Available During Free Trial" popup | DEVIATION-OK | shown by the upgrade screen instead (B5 Deviations; FIX_POLICY B7) |
| U36 | §4 F1 load on focus; spinner stuck when auth missing | PASS | explicit loading state (B5 Fixes) |
| U37 | §4 F1 trial flags persisted into auth on every load | DEVIATION-OK | derived from the plan queries (`useOrgPlan`), session patched after payment (B5) |
| U38 | §4 F2 Plan Details re-fetch spinner | DEVIATION-OK | background refetch on open (B5 Deviations) |
| U39 | §4 F3-F9 tier tap / Continue / Upgrade / Renew / invoices / select-first -> details / back | PASS | `SubscriptionScreen.tsx`; tests |
| U40 | §13 `selectedPlan`, `downloading` dead state; UTC date parsing | DEVIATION-OK | not ported (FIX_POLICY B7/B1) |

## 6. upgrade_plan (`upgrade_plan.md`)

| # | Bullet / rule / copy / flow | Status | Evidence / fix |
|---|---|---|---|
| A1 | §14 mode A (Core 6 mo, limit 12 -> Prime 12 mo): banner 1, Duration "1 Year", stepper min 12 starts 12 | PASS | `UpgradePlanScreen.tsx`, `calcMinStaff` (`pricing.ts:92`); `UpgradePlanScreen.test` |
| A2 | §14 S=20,P=40,M=12, Core@25x6: 9,600 / credit 1,500 / pay 8,100 | PASS | `CostBox.tsx`, `calcPlanCredit` (`pricing.ts:68`); `pricing.test` (b) + screen-level `CheckoutScreen.test` |
| A3 | §14 expired current plan -> credit 0 | PASS | `buildQuote` isPlanExpired; `pricing.test` + NEW `CheckoutScreen.test` "expired plan gets no credit" (Rs 11,328) |
| A4 | §14 "You pay" negative -> displays 0 | PASS | `CostBox.tsx` `Math.max(0, cost - credit)`; NEW `CheckoutScreen.test` "credit larger than the charge" |
| A5 | §14 mode B: no Duration card, "Current Plan: {Name}", ACTIVE, "Valid till {end_date}" | PASS | `UpgradePlanScreen.tsx:126-127`; test |
| A6 | §14 mode B at the current limit -> "Add Staff to Continue" disabled | PASS | `quote.canContinue`; test |
| A7 | §14 mode B (live 12): starts 12, min 10, hint "Min 10 . Unlimited", dialog "Minimum: 10 staff", disabled <= 12 | GAP-fixed | the hint showed "Current: 12 . Min 10 . Unlimited" in modes B and C (the old test only matched a substring). Now `mode === 'new' && hasCurrentPlan` decides the "Current:" part (`UpgradePlanScreen.tsx:130`). Tests now anchor the exact text for B and C |
| A8 | §14 mode B limit 12, stepper 20, 4 months: staffLimit=8, planMonth=4, isStaffUpgrade, noCoupon, credit 0 | DEVIATION-OK | hand-off is `mode/planId/staff`; the quote re-derives extra=8, months=4, no coupon, credit 0: pinned in `pricing.test` (d) and `CheckoutScreen.test` (staff-only: order amount 1,510, `staffLimit: 8`) (B5 route-param contract) |
| A9 | §14 mode C: starts 10, min 10, "Renewing: {Name}" RENEW, validTill = end + 12 mo, planMonth 12, credit 0, coupon allowed | PASS | `quote.ts`; `pricing.test` (c); `UpgradePlanScreen.test` renew; NEW `CheckoutScreen.test` renew (Rs 3,540, coupon box shown, valid till 10 Feb 2100) |
| A10 | §14 dialog: 5 -> min; 25 -> 25; text -> unchanged | PASS | `applyStaffInput` (`pricing.ts:115`); `pricing.test`; screen test "snaps to the minimum" |
| A11 | §14 minus at min stays | PASS | `StaffStepper.tsx` `disabled={value <= min}`; test |
| A12 | §14 trial params -> block modal; "Buy a Plan" replaces to subscription; Close/back returns | PASS | `UpgradePlanScreen.tsx:58-85`; test |
| A13 | §14 Plan Details entry -> no trial block | PASS | `mode === 'new'` never blocked; test "buying during a trial is allowed" |
| A14 | §14 Continue to Pay -> payment_summary with param table | DEVIATION-OK | B5 route-param contract (`mode`, `planId`, `staff`); test asserts the push |
| A15 | §14 iOS -> only "Plan Status" fallback | PASS | `PurchaseUnavailable.tsx` (plan name now capitalised as in v1); test |
| A16 | §14 live fetch fails -> staff 10 | PASS | `liveStaffLimit(undefined) = 10`; `pricing.test` |
| A17 | §14 core/prime/elite -> 3/4/5 chips | PASS | `planFeatureIds` (`planState.ts:135`); `planState.test` |
| A18 | §7.1 hasCurrentPlan | PASS | `quote.ts:buildQuote` |
| A19 | §7.2 minStaff | PASS | `pricing.ts:92`; tests (A7, A1) |
| A20 | §7.3 extraStaff = max(0, S - CS) in mode B | PASS | `pricing.ts:97`; `pricing.test` |
| A21 | §7.4 isPlanExpired | DEVIATION-OK | IST string compare, end date inclusive (FIX_POLICY B1, B5 Fixes) |
| A22 | §7.5 remainingMonths (calendar months, day ignored, min 1) | PASS | `pricing.ts:83`; `pricing.test` (4 / 1 / 1 / null cases) |
| A23 | §7.6 credit = 10 x current price x current months (0 if no plan / B / C / expired) | PASS | `pricing.ts:68`; `pricing.test`; DEFERRED product rule (B5 Deferred) |
| A24 | §7.7 validTill rule | DEVIATION-OK | month-end clamped instead of `setMonth` overflow (B5 Fixes); `pricing.test` 31 Jan + 1 mo = 28 Feb |
| A25 | §7.8 cost box mode A only with a current plan | DEVIATION-OK | preview also shown for mode B/C and no-current-plan (B5 Deviations) |
| A26 | §7.9 staff charge hand-off (mode B: extra x remaining months) | PASS | `quote.ts` `chargedStaff` / `chargedMonths`; tests (A8) |
| A27 | §7.10 worked examples (a)-(d) | PASS | `pricing.test` "buildQuote (the four worked examples)" re-verified; screen-level for (b), (c), (d) added |
| A28 | §7.11 features per plan; unknown -> Core set | PASS | A17 |
| A29 | §7.13 staff never below minStaff; no maximum | PASS | `StaffStepper.tsx` |
| A30 | §8 headers/banners/Duration/Staff/Cost/Features/Footer copy | PASS | `UpgradePlanScreen.tsx`, `CostBox.tsx`, `StaffStepper.tsx` |
| A31 | §8 trial modal copy incl. optional " on {date}" | PASS | `UpgradePlanScreen.tsx:65-84`; test |
| A32 | §4 F1 stepper snapping back on focus | DEVIATION-OK | B5 Fixes: initialised once (`staffOverride`) |
| A33 | §4 F2 stepper/dialog | PASS | A10, A11 |
| A34 | §4 F4 trial rule evaluated from params at mount | DEVIATION-OK | state from the subscription query (`trial-active`), B5 |
| A35 | §13 undefined/null params (NaN prices) | DEVIATION-OK | "Select a Plan First" empty state (B5 Fixes) |

## 7. payment_summary (`payment_summary.md`)

| # | Bullet / rule / copy / flow | Status | Evidence / fix |
|---|---|---|---|
| M1 | §14 15 staff, Rs 40, 12 mo: 7,200 / GST 1,296 / total 8,496, "Pay Rs 8,496" | PASS | `calcTotals` (`pricing.ts:56`); `pricing.test`; `CheckoutScreen.test` |
| M2 | §14 credit row "Plan Upgrade Credit - Rs x"; coupon base = charge - credit (floor 0) | PASS | `PriceBreakdown.tsx`; NEW `CheckoutScreen.test` (row-credit, "Coupon Discount (10% on Rs 8,100)") |
| M3 | §14 credit > charge -> after-credit / subtotal / gst / grand = 0 | PASS | `calcTotals`; `pricing.test`; NEW screen test |
| M4 | §14 10 % coupon on 8,100: 810 / 7,290 / GST 1,312 / 8,602 | PASS | `pricing.test`; NEW screen test posts `amount: 8602`, `couponCode: 'SAVE10'` |
| M5 | §14 first payment -> welcome coupon auto-applied + popup, "Great, Thanks!" | PASS | `useCoupon.ts`, `CheckoutScreen.tsx`; test |
| M6 | §14 not first payment -> no auto coupon / popup | PASS | `useCoupon.ts` (`isFirst ? first : null`); main test path |
| M7 | §14 `noCoupon` -> no coupon UI/link/discount and no coupon requests | PASS | `useCoupon(!noCoupon && canPurchase())`; test asserts both calls absent |
| M8 | §14 invalid coupon -> error (server message or "Invalid coupon"), no discount | DEVIATION-OK | server message shown; the fallback text reads "Invalid or expired coupon" (N7); an applied coupon is no longer lost on a failed attempt (B5 Fixes) |
| M9 | §14 valid coupon -> badge "{CODE} ({n}% off)" + discount row; Remove clears | PASS | `CouponSection.tsx`; test |
| M10 | §14 blank input -> Apply disabled | PASS | `CouponSection.tsx`; test |
| M11 | §14 "Contact {vendor}" -> mail to sales address with F6 subject/body | DEVIATION-OK | "Contact sales", address from `env.salesEmail`, hidden when unset, subject/body use "Clockyn" (B5 Deviations; FIX_POLICY E) |
| M12 | §14 Pay -> `/orders/create` `{amount=grandTotal, staff_limit, plan_id, coupon_code}` + sheet | PASS | `checkoutFlow.ts:runCheckout`; `api/billing.ts:createOrder`; `checkoutFlow.test` + screen test |
| M13 | §14 create-order failure -> "Error"/detail, no sheet | DEVIATION-OK | error toast with the server message (no `Alert`, FIX_POLICY B2); test |
| M14 | §14 close sheet -> "Payment Cancelled - You closed the payment window.", no verify | PASS | `CheckoutScreen.tsx` handleOutcome; test |
| M15 | §14 `payment.failed` -> "Payment Cancelled" with the description | PASS | `checkoutFlow.ts` (`result.error \|\| 'Payment failed'`); `checkoutFlow.test` |
| M16 | §14 payment success -> `/payments/verify` with ids, signature, email, `wants_gst_invoice=false` | PASS | `checkoutFlow.ts`, `api/billing.ts:verifyPayment`; tests |
| M17 | §14 verify success -> plan_id updated, success modal non-dismissable, Go to Dashboard replaces to home | DEVIATION-OK | `payment_completed` flag removed: caches invalidated instead (B5 route contract); session `planId` patched; `CheckoutScreen.test` |
| M18 | §14 verify failure -> "Verification Failed" + detail/default | PASS | `CheckoutScreen.tsx`; plus "Retry verification" (B5 Fixes, spec §13 risk) |
| M19 | §14 staff-only upgrade -> "{n} extra staff x ..." text | PASS | `PriceBreakdown.tsx`; NEW staff-only screen test |
| M20 | §14 iOS -> notice only, support email, no payment controls | PASS | `PurchaseUnavailable.tsx`; test (the "You selected" plan card is not reachable on iOS: DEVIATION-OK, B5 view-only policy) |
| M21 | §14 web checkout in an iframe / postMessage | PASS | `lib/platform/payment.tsx` (platform layer, B5 Known gaps: not exercised on a device) |
| M22 | §7 formulas: staffCharge unrounded; afterCredit floor; discount round half up on afterCredit; subtotal floor; GST round half up; grand = subtotal + GST | PASS | `pricing.ts:51-66` (identical operation order); tests incl. 12.5 x 10 and 0.5 -> 1 rounding cases |
| M23 | §7 amount sent = grandTotal; Razorpay paise = amount x 100 (rounded) | PASS | `checkoutFlow.ts:buildCheckoutOptions`, `paymentCore.ts:37`; tests |
| M24 | §7 coupon applies after credit; credit not sent; `staff_limit` = charged staff (extra in mode B) | PASS | `CheckoutScreen.tsx` `staffLimit: quote.chargedStaff`; tests |
| M25 | §7 welcome coupon only if server says first payment AND coupon exists; removable | PASS | `useCoupon.ts`, `api/billing.ts:getFirstCoupon`; tests |
| M26 | §7 coupon code trimmed; typing clears error | PASS | `useCoupon.ts` (`code = input.trim()`, `changeInput`) |
| M27 | §7 INR formatting | PASS | `formatINR` (Indian grouping) |
| M28 | §8 header, plan card, breakdown, coupon, totals, footer copy | PASS | `CheckoutScreen.tsx`, `PriceBreakdown.tsx`, `CouponSection.tsx` |
| M29 | §8 plan card badge `UPGRADING` | DEVIATION-OK | mode badge NEW PLAN / ADD STAFF / RENEWING (B5 Fixes; spec §13) |
| M30 | §8 "Pay Rs n"; "SSL Secured", "PCI DSS", "Cancel anytime" | PASS | `CheckoutScreen.tsx` footer |
| M31 | §8 welcome popup and success modal copy | PASS | `CheckoutScreen.tsx` (icon instead of emoji) |
| M32 | §8 Razorpay descriptor (org name else app name; order name else "{Plan} Plan Subscription") | PASS | `buildCheckoutOptions`; `checkoutFlow.test` |
| M33 | §8 alert titles/messages | DEVIATION-OK | `confirm`/toast instead of `Alert` (CONVENTIONS); same titles/messages |
| M34 | §4 F1 welcome coupon requests every mount | PASS | `useCoupon.ts` `staleTime: 0, gcTime: 0` |
| M35 | §4 F2 apply coupon: failed attempt removes an applied coupon; code not URL-encoded | DEVIATION-OK | B5 Fixes (kept; API client encodes) |
| M36 | §4 F4 pay: double-tap guard; auth missing | PASS | `CheckoutScreen.tsx` `stage !== 'idle'`; session required |
| M37 | §4 F5 verification chain + Meta "Subscribe" event | PASS | `logEvent('Subscribe')` in `CheckoutScreen.tsx` |
| M38 | §4 F8 manual close of checkout | PASS | `dismissed` outcome |
| M39 | Pay button disabled when grand total is 0 | Needs-decision | not in spec; defensive (N4) |

## 8. invoices (`invoices.md`)

| # | Bullet / rule / copy / flow | Status | Evidence / fix |
|---|---|---|---|
| I1 | §14 opens on History, `GET /invoice/history` with user_id + org_id | PASS | `useBillingData.ts:useInvoices`; test asserts `('user-1','org-1')` |
| I2 | §14 3 invoices -> "Invoice History (3)", cards show plan, PAID, paid date, staff, valid till | PASS | `InvoicesScreen.tsx`, `InvoiceCard.tsx`; test (2 rows) |
| I3 | §14 API error -> warning panel with the message + "Retry" | GAP-fixed | panel lacked the title "Could not load invoice history" and the "Retry" label ("Try again" shown). `InvoicesScreen.tsx` ErrorState `title` + `retryLabel`; test updated |
| I4 | §14 empty -> "No invoices found" | PASS | `InvoicesScreen.tsx`; test |
| I5 | §14 download: row spinner + disabled; success toast; Downloaded tab opens listing it first | PASS | `InvoicesScreen.tsx` `download`; test |
| I6 | §14 re-download -> one entry moved to top | PASS | `upsertDownload` (`downloads.ts:31`); `downloads.test` |
| I7 | §14 non-200 -> error toast, no registry entry | PASS | `FileOperationError` -> "Download failed"; test |
| I8 | §14 Android Open PDF; no viewer -> "No PDF viewer found. Try sharing the file instead." | DEVIATION-OK | toast instead of `Alert` (CONVENTIONS); NEW test pins the text |
| I9 | §14 iOS Open PDF -> share/open sheet | PASS | `openFile` platform layer |
| I10 | §14 Share -> OS sheet "Share Invoice"; unavailable -> "Sharing is not available on this device." | PASS | `InvoicesScreen.tsx` share; NEW test (also "Could not share file") |
| I11 | §14 long-press -> Delete -> file + entry removed, toast; Cancel keeps | DEVIATION-OK | explicit "Delete" row in the action sheet (B5 Deviations); NEW test "cancelling the delete dialog keeps the file and the entry" |
| I12 | §14 restart -> Downloaded tab persists | PASS | `useDownloadedInvoices.ts` (org-scoped key, dead files dropped: B5 Fixes) |
| I13 | §14 no downloads -> "No downloads yet" + "Go to History" | PASS | `InvoicesScreen.tsx` |
| I14 | §14 web: download opens/starts a browser download, nothing registered | DEVIATION-OK | browser download, no Downloaded tab (B5 Deviations); test |
| I15 | §14 back arrow | PASS | `Screen` back |
| I16 | §7 identity = invoice number; filename sanitising | PASS | `api/billing.ts:invoiceFileName` |
| I17 | §7 dates "dd Mon yyyy", "--" when empty | PASS | `formatDate` (`lib/datetime.ts:375`) |
| I18 | §7 every row PAID; plan colours; tab counts | PASS | `InvoiceCard.tsx` `planTone`, tabs |
| I19 | §8 header, helpers, empty copy, card strings | PASS | `InvoicesScreen.tsx`, `InvoiceCard.tsx` |
| I20 | §8 action sheet title `{number} Plan` / delete dialog message | DEVIATION-OK | "Invoice {number}" (B5 Fixes; spec §13 flags the bug) |
| I21 | §8 toast copy (downloaded / deleted / could not delete / failed download) | PASS | `InvoicesScreen.tsx` |
| I22 | §4 F1 load (no refresh on focus; Not authenticated fallback) | DEVIATION-OK | query + pull-to-refresh; auth always present behind the route guard |
| I23 | §4 F7 registry restore verifies files exist | DEVIATION-OK | B5 Fixes (spec §13) |
| I24 | §13 amount parsed but not shown; registry not cleared on logout | DEVIATION-OK | amount displayed; registry org-scoped, cleared by the store (B5 Fixes) |

---

## Fixes made

| # | Gap | Files changed | Tests added / changed |
|---|---|---|---|
| 1 | upgrade_plan §14: capacity upgrade / renew hint must read "Min 10 . Unlimited" (not "Current: n . Min 10 ...") | `src/features/billing/screens/UpgradePlanScreen.tsx` | `UpgradePlanScreen.test.tsx`: exact-text assertions for modes B and C (the old substring regex could not fail) |
| 2 | invoices §3/§8: history error panel title + "Retry" label | `src/features/billing/screens/InvoicesScreen.tsx` | `InvoicesScreen.test.tsx`: error panel updated; NEW tests for open/share failure wording and delete-cancel |
| 3 | subscription §3.2/§8: iOS view-only card wording ("... staff accounts", "Used", "No active plan", no billing dates); iOS fallback plan name capitalised | `src/features/billing/components/PlanStatusCard.tsx`, `src/features/billing/screens/SubscriptionScreen.tsx`, `src/features/billing/components/PurchaseUnavailable.tsx` | `SubscriptionScreen.test.tsx`: 2 new iOS tests |
| 4 | beyond §14: Android background-location refusal must open the OS settings | `src/features/settings/screens/PermissionsScreen.tsx` | `MoreAndPermissions.test.tsx`: refused vs granted background grant; hardware-back test for the privacy page |
| 5 | support §3/§8: legacy single reply is labelled "Admin Reply" (SHARED file, one string) | `src/api/support.ts` | `src/api/__tests__/supportSystem.test.ts` assertion; screen test in `SupportAndSuggest.test.tsx` |
| 6 | Money paths only pinned at function level; add screen-level execution of the spec's worked examples | tests only | `CheckoutScreen.test.tsx`: +5 tests (credit + coupon 8,602 and posted order; expired plan no credit; credit > charge = 0 and pay disabled; renew 3,540 with the current plan id; staff-only 1,510 / `staffLimit: 8`) |

Other tests added (conformance pins, no code change needed): `SupportAndSuggest.test.tsx` +7 (submit success clears form + back after the delay, server detail on failure, message-after-subject order, photo attach/send/remove/permission denied, legacy/blank author labels, limits 120/1000 + back after 1.8 s, "Sending..." + double press ignored).

Shared-code change (logged here): `src/api/support.ts` legacy-reply author label string only. No other file outside `src/features/settings` / `src/features/billing` was touched.

## Needs decision

| # | Item | Evidence | Why untouched |
|---|---|---|---|
| N1 | Settings scroll lock: v1 disabled scrolling while no accordion was open (§14 bullet 2) | `SettingsScreen.tsx` uses the standard scrollable `Screen` | UI quirk; locking scroll on small phones could clip content. Product to confirm it is intentionally dropped (not listed in B5 Deviations) |
| N2 | Company logo in the headers of settings / support / suggest / subscription (spec §3, F15) | B5 Known gaps; logo lives behind `features/company` hooks | needs a shared logo hook (cross-feature); not a minimal additive change |
| N3 | Android: once foreground location is ON the card shows no action, so "allow all the time" cannot be requested again from this screen (v1 re-ran foreground + background on every tap) | `PermissionCard.tsx` hides the button when granted; `permissionsLogic.ts:40` | product decision (add a second "Allow all the time" action using `hasBackgroundLocationPermission`) |
| N4 | Pay button is disabled when the grand total is Rs 0 (credit >= charge). v1 would create a zero-amount order | `CheckoutScreen.tsx` `disabled={... totals.grandTotal <= 0}`; new test pins it | needs a backend/product rule for a fully credited plan change |
| N5 | Non-integer price tiers with no coupon would give a fractional grand total (spec says integer rupees); the platform layer rounds paise | `calcTotals` (spec formula ported exactly), `paymentCore.ts:37` | only matters if the catalogue ever has fractional per-staff prices; backend to confirm |
| N6 | Coupon fallback wording: "Invalid or expired coupon" (api layer) vs spec "Invalid coupon" when the server omits a message; a network failure shows the shared network text instead of "Failed to validate coupon" | `api/billing.ts:97` (`reportsPlansBilling.test` pins it) | cosmetic; server always sends `message` |
| N7 | Already recorded as DEFERRED in B5 and still open (re-verified as correct v1 ports): client-side pricing/credit/renew rules (credit = 10 x current price x current duration; renew priced 12 months at the current tier and not extending `end_date` server-side; staff-stepper floor for modes B/C = 10), hard-coded plan rank map | `docs/changes/B5.md` Deferred / Backend needs | FIX_POLICY C: product/backend decision |
