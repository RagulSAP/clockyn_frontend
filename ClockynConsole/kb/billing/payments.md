---
title: Payments page, how a payment becomes a subscription, and payment flags
summary: How to read the Payments page and its tiles, download invoices, and what happens between a customer paying and the plan being activated.
category: Billing & growth
audience: operator
tags: payments, razorpay, invoice, revenue, bulk invoice, refund, failed payment, pending, webhook, amount mismatch, payment flag, export
page: payments.html
updated: 2026-11-15
related: subscriptions-and-plans, coupons, referrals-c2c, troubleshooting
---

The Payments page lists the payments customers have made through Razorpay, with revenue figures, two charts, invoice downloads and exports. Any operator can use it. It is read-only: nothing on this page changes a payment.

## What is listed
Every row is a payment record, one per successful payment. The backend writes a payment record only when a payment is confirmed. Failed or abandoned attempts are tracked on the **order**, not here (see "Failed and abandoned attempts" below).

| Column | Meaning |
|---|---|
| Payment ID | The Razorpay payment id. |
| Organization | The organization that paid. |
| Plan | The plan bought (name only). |
| Amount | What the customer was charged, **including GST**. |
| Status | Paid (green). Failed is red, Pending and Created are orange, but see the note above. |
| Date | The day the payment record was created. |

## The six tiles
The tiles recount whatever the filters leave on screen, except the last one.
- **Total Payments**: the number of rows shown.
- **Total Revenue**: the sum of Paid rows, GST included.
- **Pending**: rows with status Created, plus the number of organizations whose latest paid plan has expired (the tile caption says "Awaiting + expired trials"). It is not a list of unpaid orders.
- **Failed**: rows with status Failed.
- **Success Rate**: Paid rows divided by all rows shown. Because only paid rows are normally stored, it normally reads 100%.
- **Free Trial**: organizations that have never bought a plan (the console labels them Free Trial). This is not affected by the filters.

## Filters, charts and exports
- **Search** matches payment ID, organization and plan. The **status filter** offers Paid, Pending, Failed and Created.
- **Date range**: set **From** and **To**, or use the quick buttons Last 7D, Last 30D, Last 90D, This Month and All.
- **Monthly Revenue** bars (tabs 6M and 1Y) and the **Payment Status** donut redraw from the filtered rows.
- **Export** produces Excel or PDF of the filtered rows, named Clockyn_Payments_ plus today's date.

## Download invoices in bulk
Who can do it: any operator.
1. In **Bulk invoice download** choose **From** and **To**. The button stays disabled until both are set.
2. Click the download button and wait for the progress box.
3. A ZIP named clockyn_invoices_FROM_to_TO.zip downloads. It holds every invoice PDF issued in that range (by payment date) plus one consolidated Excel summary.

If nothing was invoiced in the range you see "No invoices found for the selected date range". A single organization's latest invoice is on the Subscriptions page, in the **Invoice** column.

## From checkout to an active plan
1. The app asks the server for a price. The server works it out (see [Subscriptions and plans](kb:subscriptions-and-plans)) and creates a Razorpay order. The order is stored with status CREATED and a snapshot of the price, staff count, GST and any coupon or referral reward.
2. The customer pays in the Razorpay window.
3. Two confirmations then race: the app calls a verify step (checking Razorpay's signature), and Razorpay calls the webhook (payment.captured or order.paid). Whichever arrives first activates the plan. The second finds it already done and changes nothing, so a plan is never activated twice.
4. Activation, in one step: the payment record is saved as PAID, a new subscription starts (ACTIVE, starting today, ending after the plan's full duration including free months), older subscriptions become INACTIVE, the free trial ends, any referral reward is marked used, the order becomes PAID, and an invoice numbered INV-year-number is created.
5. After activation, the first paid plan of a referred organization unlocks the referrer's reward (customer referral) or books the promoter's commission (promoter code).
6. The invoice is e-mailed to the customer. A failed e-mail is only logged; the plan stays active and the invoice can still be downloaded.

## Failed and abandoned attempts
- A Razorpay payment.failed event marks the **order** FAILED, unless that order is already paid.
- An order the customer never completes stays CREATED. These count in the **Pending payments** tile on the Subscriptions page.
- Neither appears in the payments list on this page.

## Payment flags
An order can carry a flag in the database column payment_flag. The console does not show it; ask a developer, or run a query such as `SELECT razorpay_order_id, org_id, amount, payment_flag FROM gen_orders WHERE payment_flag IS NOT NULL`.
- **AMOUNT_MISMATCH**: Razorpay reported a different amount or currency than the order. The plan is **not** activated and the app shows "This payment is under review. Please contact support." A person must check the payment in the Razorpay dashboard and decide.
- **REFERRAL_ALREADY_USED**: the order was priced with a referral reward that was already used by another order. The payment is honoured and the plan activates; the flag is only a note.

## Refunds
There is no refund feature in the console or the backend. Refund in the Razorpay dashboard. That does not cancel the subscription, remove the invoice, or take back a promoter commission already booked; handle those by hand.

## What can go wrong
- **Customer paid but has no plan**: check the Razorpay dashboard for the payment, then check for an AMOUNT_MISMATCH flag, then ask a developer to check the webhook (the webhook secret must be set on the server).
- **Revenue looks higher than expected**: Total Revenue includes 18% GST.
- **Pending tile is not zero**: it also counts organizations whose paid plan has expired, not just unpaid orders.

## Common questions
### Why do I only see Paid rows?
Only successful payments are saved as payment records. Failed attempts live on the order.

### Is Total Revenue before or after GST?
After. It is the full amount the customer paid.

### Where do I find one customer's invoice?
On the Subscriptions page, in the row's **Invoice** column. It is the latest invoice only.

### Can I resend an invoice e-mail?
The console has no resend button. Download the PDF and send it yourself.

### Why is the date range ignored by the Free Trial tile?
That tile counts organizations, not payments, so the filters do not apply.
