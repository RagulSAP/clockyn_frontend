# Q1b - E2E report: Settings hub, More, Permissions, Support, Suggest, Billing

Run: `E2E_ARTIFACTS=e2e/.artifacts-q1b MOCK_PORT=8804 E2E_WEB_PORT=8840 E2E_WEB_PORTS=4 E2E_WORKERS=4 npx playwright test -c e2e/playwright.config.ts e2e/specs/q1b-`
Result (final, single run): **194 tests = 97 per project x (desktop, phone): 190 passed, 4 skipped** (the 4 phone-only layout checks are skipped on desktop by design), 0 failed.
Also green: `npx tsc --noEmit` (0 errors), `npm run check:brand`, eslint on all touched files, jest `src/features/billing src/features/settings src/components/ui` (17 suites / 216 tests).

## Specs

| Spec | Journeys | Result |
|---|---|---|
| `q1b-settings-hub.spec.ts` | nine sections in order, accordion one-at-a-time + nested Incentive group, every row navigates to the right route (18 leaf rows + 3 link sections), Incentive sheet (Count / Turnover), Fine/Deduction "Coming soon", Salary Structure gate under elite/prime/core/trial (open) and expired/none (gated subtitle + toast), gate fails open when plan-status fails, Appearance Light/Dark/System persists across reload and across screens (System follows OS), Logout confirm (cancel keeps session, confirm signs out + guard), manager lands on `/staff/settings` | pass |
| `q1b-more-support.spec.ts` | More menu, privacy page "not configured" state (env URL unset), in-screen back, request account deletion (cancel / success + sign-out ~1.5 s + single POST / failure keeps session and retries), Permissions status rows on web, Allow flips to ON + "All Active", blocked permission shows browser how-to text, Support list/statuses/replies, validation order, ticket without and with photo (multipart `photo` part, remove), submit and reply failures, legacy `reply` -> "Admin Reply", ticket list error + retry, Suggest feature (validation order, 120/1000 limits, payload, return to hub, server error) | pass |
| `q1b-billing-overview.spec.ts` | overview for active / expired / trial / no-plan, staff strip numbers vs mock data, trial lock modal (upgrade and renew, Buy a Plan, Close), "Select a Plan First" flow, subscription load failure + retry, Plan Details downgrade matrix (active Prime 6 months), catalogue grouping/labels, catalogue failure + retry, web: no web-portal link, purchase UI present, manager reaching the URL (recorded) | pass |
| `q1b-billing-pricing.spec.ts` | worked examples through the UI **and** `/__test/requests` payloads: new Prime 12m @40 x15 = 7,200 / GST 1,296 / **8,496**; WELCOME10 -> **7,646** (discount round at its own step, rounding case 11 x 45); plan change Core 6m @25 -> Prime 12m @40, 20 staff, credit 10x25x6 = 1,500 -> 9,558, with coupon **8,602**; renew 10 x 25 x 12 -> **3,540** (starts at 10 staff, valid till end + 12 months); staff-only 8 x 40 x 4 months -> **1,510** (extra staff sent, no coupon UI/requests); staff floor (live limit vs 10), edit dialog (snap to min, non-numeric ignored, no maximum), expired plan = no credit, invalid coupon / remove / welcome coupon auto-apply / no coupon configured, unknown plan | pass |
| `q1b-billing-checkout.spec.ts` | Razorpay stub: success from trial (order + verify payloads, queries refetched after verify, session `planId` patched / `isFreeTrial` cleared, new invoice listed, overview reflects plan), failure, dismissed (second attempt allowed), order creation failure, verification failure + "Retry verification" without a second order, renewal success; invoices list/amounts/validity, browser download (`Invoice_<n>.pdf` + request query), download failure, empty and error states | pass |
| `q1b-visual.spec.ts` | phone layout regressions (D1/D2 below), permission card clipping (D4), billing loading capture | pass (4 phone-only skipped on desktop) |

## Defects

| # | Severity | Defect | Evidence | Fix | Regression test |
|---|---|---|---|---|---|
| D1 | High (visual) | Phone: Upgrade configurator - the Features card is clipped and the Staff Limit card overlaps it (column children had `flex: 1`, shrinking against the viewport-height content) | screenshot `phone/upgrade-plan-change-credit-light.png` (before fix) | `flex: isDesktop ? 1 : undefined` in `UpgradePlanScreen.tsx` (+ `testID`s `upgrade-features-card` / `upgrade-staff-card`) | `q1b-visual` "upgrade configurator: cards stack without overlapping" |
| D2 | Medium (visual) | Phone: large blank stretch between cards on Payment Summary, Billing overview and Support (same `flex: 1` cause) | screenshots `phone/checkout-plan-change-credit-light.png`, `phone/billing-none-dark.png`, `phone/support-dark.png` | same change in `CheckoutScreen`, `SubscriptionScreen`, `SupportScreen` | `q1b-visual` payment summary / overview / support adjacency checks |
| D3 | Medium (a11y, cross-cutting) | Web: selected / checked / expanded state of every `Touchable`-based control (SegmentedControl incl. Appearance, Switch, Radio, Tabs, filter chips) was not exposed: react-native-web 0.21 ignores `accessibilityState` | `aria-checked` missing on the Appearance radios | `Touchable.tsx` also passes `aria-checked/selected/expanded/busy` derived from `accessibilityState`; Plan Details tier boxes (plain `Pressable`) get `aria-selected` | `q1b-settings-hub` Appearance (`aria-checked`), `q1b-billing-overview` tier `aria-selected` |
| D4 | Low (visual) | Permission cards: the 4 px status bar was not clipped by the card's rounded corners | `phone/permissions-partial-dark.png` | `overflow: 'hidden'` on the card | `q1b-visual` permission card overflow |
| D5 | Low (mock fidelity) | Mock subscription for trial / no-plan returned a paid-looking start/billing date and no "Free Trial" plan name (real backend: `plan_name 'Free Trial'` during trial, no start/billing date without a paid row) | no-plan overview showed Billing Date / trial plan named "No Active Plan" | `e2e/mock-server/domain.js` mirrors the backend placeholder | covered by overview trial / none tests |

Mock additions (additive, `e2e/mock-server`): `/__test/state` accepts `catalogue` (replacement plan tiers) and `subscription` (patch of the paid row); `domain.catalogue(s)` is used by `get_plans`, `orders/create`, `payments/verify`, `subscriptionData`. Helpers: `e2e/support/q1b.ts`.

## Screenshots reviewed (Read tool)
Settings hub desktop light / phone dark; billing active desktop light, no-plan phone dark, Plan Details phone light, trial-lock modal desktop dark, upgrade phone (found D1), checkout phone (D2) and desktop, permissions phone dark (D4), support phone dark (D2) and desktop error state, invoices phone dark. Remaining shots are generated (`e2e/.artifacts-q1b/q1-shots/<project>/`) but only partly viewed after the fix.

## Open decisions / observations
1. **Manager (role 2) can open `/admin/billing` (and the other admin routes) by URL** - the role guard allows roles 1-2 on `/admin/*` and billing has no admin-only check, so a manager reaching the URL sees the purchase UI. Managers have no entry point (they use `/staff/settings`). Product decision: restrict billing to role 1? Spec test only records the state (`manager-billing-actions` attachment).
2. "Buy a Plan" on the trial lock does `router.replace(billing)` over an existing billing screen, so two overview instances are on the stack (v1 behaviour kept, back returns to the first).
3. Notification permission in headless Chromium reads `denied`; the web screen then offers "How to enable" (correct), tests pin `default`/`granted` where needed.
4. Ticket / suggestion submit calls `router.back()` after 1.5 / 1.8 s: when the screen was opened by a direct URL (no history) the result depends on the browser; tests enter through the hub.

## Coverage gaps (not covered)
- Privacy policy with `EXPO_PUBLIC_PRIVACY_POLICY_URL` set (iframe + "Open in browser"): the web build is baked without env vars; only the "not configured" state is e2e-tested (the configured branch is jest-covered only).
- iOS view-only branch, Android-only web-portal link, native invoice Downloaded tab / share / delete / open (not reachable on web; web behaviour asserted instead: no tab, card not actionable).
- Real Razorpay / WebView; photo upload failure inside the 30 s timeout wording.
- Hover/focus states, keyboard navigation, real contrast measurements (visual review only), skeleton frames (a loading capture is produced, not asserted).
- Per the lead's speed request: no exhaustive validation permutations; manager-role variants limited to the two checks above; dark screenshots reviewed only for hub, billing and a few screens.
