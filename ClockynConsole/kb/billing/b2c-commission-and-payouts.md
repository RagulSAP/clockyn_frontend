---
title: Promoter commission, payouts and voiding a payout
summary: How a promoter's commission is earned and tracked, how to record or void a payout, and a month-end routine for paying promoters.
category: Billing & growth
audience: super_admin
tags: commission, payout, promoter payment, void payout, commission due, ledger, utr, month end, b2c, earned, paid
page: referrals.html
updated: 2026-11-15
related: referrals-b2c, payments, roles-and-permissions
---

Each promoter code can earn the promoter a commission. The console tracks what is earned, what you have paid out and what is still due, so you can pay promoters correctly. It records payments only; it does not move any money. Any operator can read the commission figures. **Recording and voiding payouts needs a super admin.**

## How commission is earned
- Commission is earned **once per customer**, at the moment the customer's **first paid plan** is activated. Renewals, later plan changes and added staff earn nothing more.
- It is based on the amount of that first purchase **excluding GST**, after any discount (the same amount shown as the plan amount on the invoice).
- The promoter's commission setting decides how much:
  - **No commission**: nothing is earned (the customer is still counted).
  - **Percent of the first paid plan**: that percentage of the amount excluding GST, rounded to 2 decimals (half up). A percentage can be set from above 0 up to 100.
  - **Fixed amount per paid customer**: the same rupee amount for every customer who pays. The server accepts up to ₹1,000,000.
- The amount is **booked at the first payment** using the promoter's setting at that moment and then never changes. Editing the commission later only affects customers who have not yet paid.
- The promoter being switched to Inactive does not stop commission for customers who already signed up.

Worked example: a customer registers with a 15% promoter code and buys Prime for 12 months (2 free) at ₹99 per staff for 15 staff. The charge is 15 × 99 × 10 = ₹14,850. The 15% discount is ₹2,228 (₹2,227.50 rounded half up). The amount excluding GST is ₹12,622. GST adds ₹2,272 and the customer pays ₹14,894. A promoter on "10% of the first paid plan" earns ₹1,262.20. A promoter on "Fixed ₹500" earns ₹500.

## The numbers on the screen
- **Commission earned**: the total booked for the promoter's customers.
- **Commission paid**: the total of payouts that are not voided.
- **Commission due** = earned minus paid (never below 0). The table's **Due** column also shows "of ₹ earned".
- The tiles on the B2C Referral tab add these up for every promoter.
- In the detail view the **Commission** section shows **Earned**, **Paid** (with "N payouts, M voided") and **Due**, then the payout list.

Example: three customers paid and earned ₹1,262.20, ₹980.00 and ₹1,320.00 for a promoter, so earned is ₹3,562.20. You paid ₹1,000 once, so due is ₹2,562.20.

## Record a payout
Who can do it: super admin only. Do this after you have paid the promoter by bank transfer or UPI.
1. On the B2C Referral tab click the promoter's row to open the detail view.
2. In **Commission** click **Record payout**. The button is greyed out with "Nothing is due" when due is 0.
3. **Amount paid (₹)** is pre-filled with the amount due. Change it if you paid less.
4. Set **Paid on**, the date you paid. It cannot be in the future.
5. Optionally add **Reference** (for example the UTR or transaction id, up to 100 characters) and **Note**.
6. Click Save. A toast says "Payout of ₹X recorded", and Paid and Due update.

The amount must be above 0 and **cannot be more than the commission due** ("The amount cannot be more than the commission due"). Two people recording a payout at the same moment cannot overpay: the server checks the amount again while it holds the promoter's record.

## Void a payout
Who can do it: super admin only. Use it when a payout was entered by mistake (wrong amount or promoter), is a duplicate, or the transfer bounced.
1. In the detail view find the payout in the list and click **Void**.
2. The dialog says "Void this payout of ₹X paid on DATE? The amount will count as due again."
3. Optionally enter a **Reason** (up to 300 characters, for example "wrong amount, transfer failed").
4. Click **Void payout**. A toast says "Payout voided".

What changes: the payout stays in the list, greyed with a struck-through amount and the note "Voided by NAME on DATE - reason". It no longer counts as paid, so **Commission due goes up** by its amount. A payout can be voided once only; a second attempt shows "This payout is already voided". A payout cannot be edited. To correct one, void it and record a new one.

## Ledger columns
**Paid on**, **Amount**, **Reference**, **Note**, **Recorded by** (the operator who recorded it) and **Status** (Paid or Voided).

## Month-end routine
1. Open the B2C Referral tab and look at the **Due** column; open each promoter with something due.
2. Check the **Customers onboarded** table: the customers marked Paid are the ones that earned commission.
3. Pay the promoter outside the console (bank or UPI) and keep the transaction id.
4. Click **Record payout**, enter the amount, date and reference, and save.
5. Check that **Due** is now 0 (or the unpaid remainder).
6. Click **Export** for a record, if finance asks.

## What the system does not do
- It does not send money. Recording a payout is a note that you paid.
- It does not take commission back if a customer is refunded or cancels. Refunds are handled in the payment gateway and by hand, so reduce a later payout yourself or leave a **Note**.
- It does not pay commission on renewals.

## What can go wrong
- **Record payout is greyed out**: nothing is due, or you are not a super admin.
- **"The amount cannot be more than the commission due"**: another payout has already used part of it. Reload the detail view.
- **Commission earned is 0 for a paid customer**: the promoter was set to No commission when that customer first paid, or the customer has not paid yet.
- **A customer paid but the promoter shows no commission**: the commission is booked in the same step as the plan activation. If it is missing, ask a developer to check the server log for "Referral qualification failed".

## Common questions
### Does the commission include GST?
No. It is calculated on the amount excluding GST.

### Do renewals earn commission?
No. Only the first paid plan of each customer does.

### I recorded the wrong amount. How do I fix it?
Void that payout, then record a new one with the right amount.

### Can I delete a payout?
No. You can void it, and the row stays in the ledger as a record.

### Why did Due go up after I voided a payout?
A voided payout no longer counts as paid, so that amount is owed again.
