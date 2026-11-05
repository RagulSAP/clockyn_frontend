# Checkout shows the server quote (`POST /orders/quote`)

The server prices every order (`core_functions/pricing.py`; `/orders/create` ignores the client amount). The payment
summary now displays the numbers the server will charge, so flat / capped / minimum-amount coupons are shown correctly.
Older servers keep working: without the route the screen shows the local pricing exactly as before.

## What changed

| Area | Change |
|---|---|
| `src/api/billing.ts`, `src/types/api/billing.ts` | `billingApi.quote(input, { signal? })` + `mapOrderQuote` + types `QuoteOrderInput` / `OrderQuote`. Body `{user_id, org_id, plan_id, staff_limit, coupon_code, mode}`; the breakdown is read from `data` (money as numbers in rupees, `discount_percent` is `null` for flat coupons). **Never throws**: 404 / 405 (no route), network, timeout, abort, any other error, `success:false` or a payload without `grand_total` all answer `null`. |
| `features/billing/hooks/useServerQuote.ts` (new) | Fetches the quote for plan / staff / coupon / mode. First request at once, later input changes debounced 300 ms, the superseded request is aborted and a late response for old inputs is dropped (sequence + key check). Exposes `quote`, `loading`, `preview(over)` (one-off, used by the coupon Apply) and `settle()` (quote for the inputs as they are now). |
| `features/billing/utils/serverQuote.ts` (new) | Pure glue: `quoteToTotals`, `withServerQuote` (credit, months, price, validity over the local quote), discount / badge labels, coupon notice. |
| `screens/CheckoutScreen.tsx` | Displays the server breakdown (staff charge, credit, discount, subtotal, GST, grand total, valid till) when a quote is available, else the local numbers. While a quote is loading only the grand total shows a small spinner and is dimmed. Pay posts the displayed amount; if the quote is still on its way Pay first settles it (`settle()`), so the amount sent is the server's. `mode` is still sent. If the server says the applied coupon cannot be used, Pay shows its message instead of creating an order that the server would refuse. |
| `hooks/useCoupon.ts`, `components/CouponSection.tsx` | Apply asks the quote first and uses its verdict (`coupon_applied` / `coupon_message`); `null` falls back to the percent-only `validateCoupon` (unchanged). The badge reads `CODE (P% off)` for plain percent coupons and `CODE (₹N off)` for flat / capped ones; an applied coupon the server later refuses (for example the minimum amount is no longer met after a change) shows the server message under the badge. |
| `components/PriceBreakdown.tsx` | Optional `discountLabel` and `totalLoading` props (defaults keep the old wording). |
| Mock (`e2e/mock-server`) | `routes/billing.js` quote now follows `Coupon.discount_for`: percent (default) or flat, optional `max_discount` and `min_amount`; `discount_percent` is `null` without a percent coupon. `index.js`: `POST /__test/state { coupon: {...} }` patches the single coupon row (for example `{coupon_name:'FLAT500', discount:0, discount_type:'flat', flat_amount:500}`). `selfcheck.js`: flat / minimum-amount / capped checks. |

## Changes (configurator)

* `screens/UpgradePlanScreen.tsx` now shows the server quote too: it calls `useServerQuote` (same first-at-once / 300 ms debounce / abort / stale-drop behaviour, `couponCode: null`, `chargedStaff` = the extra staff for a capacity upgrade; not requested while a capacity upgrade has no extra staff, during the trial lock or when purchases are unavailable). The banner price / valid-till and `CostBox` (new optional `serverQuote` prop: staff charge, credit, "You pay" = `afterCredit`) show the server numbers; while the quote loads or when it is unavailable (`null`) the local estimate is shown as before. What Continue to Pay passes to the checkout (`mode`, `planId`, `staff`) is unchanged and comes from the local selection.
* Tests: `UpgradePlanScreen.test.tsx` (mocks `billingApi.quote`; default `null` keeps the old local assertions): server numbers replace the local ones, fallback on `null`, staff change re-quotes and navigation params stay local, capacity upgrade quotes only the extra staff and nothing before there is any.

## Fallbacks

* No quote route / network error / timeout / any quote failure: local `calcTotals` numbers, coupon box uses `validateCoupon` (percent only), Pay posts the local total. Nothing else changes.
* The order amount is display-only for the server (it recomputes); the screen still posts the amount it shows, with `mode`.

## Tests

* Unit: `src/api/__tests__/reportsPlansBilling.test.ts` (mapper, request body, fallback on 404 / 405 / 422 / 500 / network / timeout / `success:false` / non-JSON), `features/billing/__tests__/useServerQuote.test.tsx` (first fetch, loading, stale response dropped and aborted, debounce, fallback, disabled, `settle`), `serverQuote.test.ts` (labels, totals, merge), `CheckoutScreen.test.tsx` (flat coupon display and posted amount, server verdict for an unusable code, server numbers replacing local ones, refused applied coupon blocks the order, fallback). The existing tests only gained a `billingApi.quote` mock that answers `null` (the old, local path).
* Playwright (`e2e/specs/q1b-billing-checkout.spec.ts`): flat coupon shows the server total (7,906) and the created order carries it; a minimum-amount coupon shows the server message. `q1b-billing-pricing.spec.ts`: the invalid-code assertion now checks the `/orders/quote` request (the verdict comes from the quote; `/plans/coupon/validate` is only the fallback).

## Not done

* Coupons: the configurator estimate is before coupon and GST (the quote is requested without a coupon); coupon discounts are shown on the payment summary only.
* The welcome coupon (`/plans/coupon/first`) is still a percent coupon in the app's model; its verdict is taken from the quote like any other code.
