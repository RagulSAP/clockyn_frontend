---
title: Subscriptions and plans (plan cards, free months, pricing rules)
summary: How to read the Subscriptions page, add or edit plans with free months and offer text, and how a purchase price is worked out.
category: Billing & growth
audience: operator
tags: subscriptions, plans, plan card, pricing, free months, offer text, duration, core, prime, elite, renewal, credit, gst, add plan, delete plan
page: subscriptions.html
updated: 2026-11-15
related: payments, coupons, referrals-c2c, glossary
---

The Subscriptions page has two parts: **Available plans** (what customers can buy) and **Organization subscriptions** (who has an active plan). Any operator can add, edit and delete plans; there is no super-admin restriction.

## The three tiles at the top
- **Active subscriptions**: subscriptions with status ACTIVE.
- **Pending payments**: orders started but not completed (status CREATED), including abandoned checkouts.
- **Failed payments**: payment records saved as FAILED. The backend saves a payment record only on success, so this normally shows 0; a failed attempt marks the order instead.

## Plan cards
Each card in **Available plans** is one plan at one duration, grouped under a heading per plan (Core, Prime, Elite first, then A to Z), shortest duration first.

Each card shows the plan name, the price ("₹49 / staff / month"), a duration badge, a green "N month(s) free" badge when there are free months, your offer text, and "N active · X% of subscribers". The price is **per staff per month** and the same on every duration of a plan. The saving comes from the free months.

## Add a plan
Who can do it: any operator.
1. On the Subscriptions page click **Add plan**.
2. Enter **Plan name** (the same name for every duration, for example Prime).
3. Enter **Amount (₹ per staff per month)**.
4. Enter **Duration (months)**, a whole number of 1 or more.
5. Enter **Free months**: months of the duration that are not charged. It must be a whole number from 0 to duration minus 1.
6. Optionally enter **Offer text** (up to 80 characters). Empty means the app shows "1 month free" itself.
7. Check the preview line, then click **Add Plan**.

Example: price ₹49, duration 6, free months 1 previews "Customer pays for 5 of 6 months = ₹245 per staff". Duration 12 with 2 free previews ₹490 per staff. The customer still gets the full 6 or 12 months of validity.

A plan name can exist only once per duration: a second "Core, 6 months" is refused with "A Core plan for 6 month(s) already exists. Edit that one instead."

## Edit or delete a plan
- **Edit**: the pencil opens the same form. Clearing the offer text removes it. A new price affects future purchases only; existing subscriptions keep their dates and staff limit.
- **Delete**: the bin asks for confirmation. A plan used by any subscription or order cannot be deleted ("Cannot delete: this plan has N subscription(s) and M order(s) linked to it."). Plans have no hide switch.

## How the app shows durations and savings
In the app, Plan Details shows each plan with a horizontally scrolling card per duration, labelled 1 Month, 6 Months or 1 Year, with the price "/staff/mo". A duration with free months also shows your offer text (or "1 month free") and "Save ₹X/staff" (price times free months). While a paid plan is active the app blocks a lower plan, and the same plan with an equal or shorter duration.

## How the price is worked out
The server works out every price; the app's amount is never charged.
- **Charge** = staff × price per month × **paid months** (duration minus free months). The staff charge is not rounded.
- A coupon or referral discount is taken off, rounded to a whole rupee (half up). Then **18% GST** is added, also rounded to a whole rupee.
- **Renewal** is always 12 months at the current plan, keeping its share of free months: 12 months with 2 free renews as 10 paid months, 6 months with 1 free also renews as 10, 1 month with 0 free renews as 12. Validity runs from the current end date while the plan is active, otherwise from today.
- **Changing plan** gives a credit if the current plan has not expired: 10 staff × the current plan's price × its paid months, taken off before any coupon or referral discount.
- **Adding staff** charges only the extra staff, at the monthly price, for the whole calendar months left (at least 1). For example 8 extra staff at ₹99 with 4 months left is 8 × 99 × 4 = ₹3,168 plus GST ₹570 = ₹3,738. No credit, coupon or referral reward applies, and the end date does not change.
- A purchase can use a coupon **or** a referral reward, not both.

| Case | Calculation | Total with GST |
|---|---|---|
| 10 staff, 6 months with 1 free, ₹49 | 10 × 49 × 5 = ₹2,450, GST ₹441 | ₹2,891 |
| 15 staff, 12 months with 2 free, ₹99 | 15 × 99 × 10 = ₹14,850, GST ₹2,673 | ₹17,523 |
| Core 12 months (2 free, ₹49) to Prime 12 months (2 free, ₹99), 10 staff | ₹9,900 − credit ₹4,900 = ₹5,000, GST ₹900 | ₹5,900 |

> **Warning** The credit uses the plan's current price, not what the customer paid. Editing a price changes the credit of customers who switch later.

## Organization subscriptions table
Who can see it: any operator. It lists only organizations whose subscription status is ACTIVE, soonest end date first.

- **Organization**: click the row to open Organization analytics.
- **Contact**: the admin's e-mail and mobile number. **Plan**: the plan name (not the duration). **Staff**: the staff limit bought.
- **Valid till** and **Status**: Active (green), or Expiring (orange) when 15 days or fewer are left or the date has passed.
- **Coupon / Referral**: the coupon or referral reward on the latest invoice, with "Referred by" or "Referrer of" and the other side's name (the channel name for a promoter code).
- **Invoice**: **PDF** downloads the latest invoice.

Search matches organization name, admin e-mail, coupon code and referral name.

## What can go wrong
- **409 on Add or Edit**: that plan and duration already exists. Edit the existing card.
- **"Free months must be less than the duration"**: lower the free months or raise the duration.
- **Cannot delete a plan**: it has subscriptions or orders. Keep it, or change it by editing.

## Common questions
### Why does a 12-month plan show the same price as a 1-month plan?
The price is per staff per month on every row. The 12-month plan is cheaper because 2 of its 12 months are free.

### Does adding staff get the free months?
No. Extra staff pay the monthly price for every month left.

### Why is the Failed payments tile 0?
It counts payment records marked FAILED, which the backend does not currently write. Failed attempts mark the order instead.

### Can I make a plan 15 months long?
Yes. Any whole number of months from 1 is accepted. The app labels it "15 Months".
