---
title: C2C referrals: customer-to-customer rewards, the discount percent and voiding
summary: How the customer referral programme works, how to read the C2C Referral tab, change the discount percent (super admin) and void a reward.
category: Billing & growth
audience: operator
tags: referral, refer and earn, c2c, customer referral, reward, discount percent, referrer, referred, void reward, top referrers, pending, available, used
page: referrals.html
updated: 2026-11-15
related: referrals-b2c, subscriptions-and-plans, coupons, roles-and-permissions
---

Refer & Earn lets one company invite another to Clockyn. This is the "C2C" (customer to customer) programme, shown on the **C2C Referral** tab of the Referrals page. Any operator can read it. Changing the discount percent and voiding a reward need a super admin (the console calls this a super operator).

## How the programme works
- Every organization has one permanent 6-character referral code. It is created the first time the admin opens Settings > Refer & Earn in the app, or right after the company registers.
- A new company can type a code in the optional **Referral code** box on the register screen. A wrong code is refused before the company is created. The code can only be entered while registering, never afterwards, and a company can use only one code. A company cannot use its own code.
- Signing up with a code creates a **referral** and **two rewards**, both for the same percent:
  - the **referred** company's reward is **Available** straight away;
  - the **referrer's** reward is **Pending** until the referred company's **first paid plan** is activated, then it becomes Available.
- A reward is used **once**, on a **new plan or a renewal of Prime or Elite** (every duration). It does not work on Core, or on adding staff, and not together with a coupon. At checkout the oldest available reward is used first, and one reward is used per purchase.
- The discount is that percent of the plan charge after any plan-change credit, rounded to a whole rupee (half up), with GST added afterwards. Example: 10% off a ₹14,850 charge is ₹1,485, leaving ₹13,365; GST is ₹2,406, so the customer pays ₹15,771.

## The discount percent
The percent is stored in the database, not in the app, and starts at 10. The **Referral discount** card at the top of the C2C tab shows it ("N% off for the new customer and for the referrer"), with who changed it last and when.

To change it (super admin only):
1. On the C2C Referral tab click **Edit** on the Referral discount card.
2. Enter **Discount for both sides (%)**, a whole number from 1 to 50.
3. Click Save. A toast says "Referral discount is now N%".

> **Note** A change affects **new** referrals only. Every reward keeps the percent it was issued with, including the Pending reward of someone who signed up an hour earlier. The app shows the current percent on Settings > Refer & Earn and on the register screen.

Other operators do not see the Edit button. If a call is made anyway the page says "Only a super operator can change the referral discount."

## The tiles
| Tile | Meaning |
|---|---|
| Total referrals | Organizations that signed up with a customer's code. |
| Converted (paid) | Referred organizations that have bought a plan. |
| Conversion rate | Converted divided by total. |
| Discount given | The total ₹ value of rewards already used. |
| Rewards issued | Both sides of every referral. |
| Available | Rewards ready to use at checkout. |
| Pending | Referrer rewards waiting for the referred company's first paid plan. |
| Used | Rewards already applied to a purchase. |

These tiles cover customer referrals only. Promoter codes are counted on the B2C tab.

## Top referrers and the table
**Top referrers** lists up to 10 organizations ordered by paid referrals, then by referrals. The green part of each bar is the share that went on to pay.

The **All referrals** table has these columns: **Referrer** (with the code used), **Referred org**, **Signed up** (with "Paid" and the date once they pay), **Status**, **Referrer reward** and **Referred reward**. Search matches either organization's name or code; the status filter has All statuses, Signed up and Paid. The table shows at most the latest 2,000 referrals. **Export** saves the open tab as Excel or PDF.

Status means: **Signed up** (blue) the referred company has not bought a plan yet; **Paid** (green) its first paid plan has been activated.

Reward badges: **Pending** (orange), **Available** (green), **Used** (purple, with plan, the ₹ taken off and the invoice number), **Void** (grey) and **Expired**. Expired only appears for promoter rewards.

## Void a reward
Who can do it: super admin only. The **Void** button appears next to a reward that is Available or Pending.
1. Click **Void** next to the reward.
2. Read the dialog: it names the reward, the percent and both organizations, and warns "A voided reward can no longer be used at checkout. This cannot be undone."
3. Click **Void reward**.

A reward that is already Used or Void cannot be voided; the page shows the server's message and refreshes.

## What can go wrong
- **No Edit or Void buttons**: you are not a super admin. Ask one.
- **A customer says their reward is missing at checkout**: check that they chose Prime or Elite, that it is not the Core plan or an add-staff purchase, that no coupon is applied, and that the reward is not Pending or Void.
- **The referrer's reward stays Pending**: the referred company has not paid yet. It unlocks on that company's first paid plan only.

## Common questions
### Why can I not see the Void button?
Only a super admin can void rewards. Other operators see the table without action buttons.

### Does changing the percent change rewards already issued?
No. Each reward keeps the percent it had when it was issued.

### Can a company add a referral code after registering?
No. The code can only be entered at registration.

### Does the reward work on the Core plan?
No. Only Prime and Elite, for a new plan or a renewal.

### Where do I see a company's own referral code?
In the Referral code chip next to the referrer's name in the table, once someone has used it.

### Can a company get more than one reward?
Yes, one for each company it refers. They are used one per purchase.
