---
title: Coupons: create, edit, disable and how checkout applies them
summary: How to manage discount coupons on the Coupons page, and the rules the server applies when a customer uses one at checkout.
category: Billing & growth
audience: operator
tags: coupon, discount, promo code, percent, welcome coupon, deactivate, delete coupon, checkout, expiry, flat discount
page: coupons.html
updated: 2026-11-15
related: subscriptions-and-plans, payments, referrals-c2c, referrals-b2c
---

A coupon is a code that gives a percentage off a plan purchase. The Coupons page lets any operator create, edit, switch off and delete coupons. A few extra rules (expiry dates, caps, plan limits, flat amounts) exist on the server but have no fields in the console; they are covered below.

## What the page shows
- **Total Coupons**: every coupon created.
- **Active**: coupons whose status is Active. This number does not look at start or end dates.
- **Highest Discount**: the largest percentage among active coupons.
- The table has **Coupon ID**, **Coupon Name**, **Discount (%)**, **Status** (Active or Inactive) and the **Edit** and **Delete** buttons. The search box filters by coupon name.

## Add a coupon
Who can do it: any operator.
1. On the Coupons page click **Add Coupon**.
2. Enter **Coupon Name**, for example SAVE20. It is stored in capital letters.
3. Enter **Discount (%)**, from 0 to 100 (two decimals allowed).
4. Click **Add Coupon**. The new coupon is Active.

If the name is empty or the discount is outside 0 to 100 the form says "Please enter a valid coupon name and discount (0–100)."

> **Warning** The console accepts 0%, but a coupon with a discount of 0 or less is treated as invalid at checkout ("Invalid or expired coupon"). Use 1 or more.

## Edit, switch off or delete
- **Edit**: change the name, the discount, or the **Status**. Set Inactive to stop a coupon being used without losing it.
- **Delete**: asks "Delete coupon "NAME"? This cannot be undone." Invoices already issued keep the coupon code they used.

The database does not require coupon names to be unique. If two active coupons share a name (ignoring capitals), checkout uses the one with the lowest Coupon ID. Keep names unique.

## How checkout applies a coupon
The app sends the code and the server decides. Coupon codes are matched ignoring capitals. The server rejects a coupon in these cases:
- It is Inactive, or the code does not exist: "Invalid or expired coupon".
- It has a start date in the future: "This coupon is not active yet".
- Its end date has passed (the end date itself still works): "Invalid or expired coupon".
- It is limited to certain plans and the customer chose another: "This coupon is not valid for the selected plan".
- The order is below its minimum amount: "This coupon needs a minimum order of Rs N".
- The purchase is for adding staff: "Coupons do not apply to staff upgrades".
- The customer also applied a referral reward: "Use either a coupon or a referral reward, not both".

When it is accepted, the percentage is taken from the amount after any plan-change credit, rounded to a whole rupee (half up), and GST is added to what is left. Example: a 20% coupon on a ₹14,850 plan charge takes off ₹2,970, leaving ₹11,880. GST is ₹2,138, so the customer pays ₹14,018.

## Rules that are not in the console
The coupons table also has columns for a flat amount instead of a percentage, a cap on the discount, a minimum order amount, a start date, an end date and a list of plans. The server enforces them, but only a developer can set them in the database today. If you need one, ask a developer. A coupon created in the console has none of these, so it works as a plain percentage coupon on every plan.

## The welcome coupon
For an organization's first payment (the admin has no earlier paid order), the app looks up the **first active coupon in date range, lowest Coupon ID first**, and applies it automatically as a removable "Welcome Discount". So the active coupon with the lowest ID is effectively your welcome offer. Switching it off or deleting it moves the welcome offer to the next coupon. Check the Coupon ID order before you disable one.

## Where you can see coupon use
On the Subscriptions page, the **Coupon / Referral** column shows the coupon code used on an organization's latest invoice. Bulk invoice exports include the code.

## What can go wrong
- **"Invalid or expired coupon" for a coupon that looks Active**: check for a 0% discount, an end date, or a duplicate name with a lower ID that is limited to other plans.
- **The wrong coupon became the welcome offer**: it is the lowest-ID active coupon. Edit the statuses.
- **A deleted coupon still shows on an old invoice**: invoices store the code as text. That is expected.

## Common questions
### Can I give a coupon a fixed rupee value?
Not from the console. A developer can set a flat amount in the database.

### Does a coupon work on renewals?
Yes. Coupons work on a new purchase and on a renewal, but not on adding staff.

### Can a customer use a coupon and a referral reward together?
No. A purchase takes one or the other.

### Why did my coupon not change after I edited it?
Edits apply to future checkouts. Orders already created keep the price they were given.

### Is a coupon the same as a promoter code?
No. A promoter code is given at registration and creates a one-time reward. See [Referrals B2C](kb:referrals-b2c).
