---
title: B2C referrals: promoter codes for YouTube, Instagram and other channels
summary: How to create and manage promoter codes on the B2C Referral tab, what customers get, and how to read a promoter's detail view and insights.
category: Billing & growth
audience: operator
tags: b2c, promoter, promoter code, influencer, youtube, instagram, facebook, channel, referral code, discount, reward expiry, onboarded customers, insights
page: referrals.html
updated: 2026-11-15
related: b2c-commission-and-payouts, referrals-c2c, roles-and-permissions, coupons
---

A promoter code is a code you give to someone who promotes Clockyn on a social channel (YouTube, Instagram, Facebook and so on). A new company that types the code when it registers gets a percentage off Prime and Elite, and the promoter earns a commission (see [Commission and payouts](kb:b2c-commission-and-payouts)). Codes live on the **B2C Referral** tab of the Referrals page. Any operator can look; **only a super admin can create or edit codes**.

## What a customer experiences
- On the register screen the customer types the code in the optional **Referral code** box. The screen shows "Referred by CHANNEL NAME - N% off Prime and Elite". The channel name is what you entered in the **Channel name** field.
- A wrong code, or a code switched to Inactive, gives "This referral code is not valid" and the company is not created until the code is fixed or removed.
- The customer gets **one reward** of the code's percent, available immediately. There is no reward for the promoter's side other than commission.
- The reward follows the normal rules: used **once**, on a new plan or renewal of **Prime or Elite** (any duration), not on Core, not on adding staff, not together with a coupon.
- If the code has **Reward valid for (days after signup)**, the reward expires that many days after signup. An expired reward is no longer offered at checkout. If the customer already started an order while the reward was valid, that order keeps its discount even if the payment arrives after the expiry.
- A company can use only one code, only at registration. A promoter code and a friend's referral code cannot both be used.

## Create a code
Who can do it: super admin only. Other operators do not see the **New code** button.
1. On the B2C Referral tab click **New code**.
2. **Referral code**: type exactly 6 letters or digits. It is capitalised for you and anything else is removed as you type. You choose it, so a name like CHANL5 works, including characters such as 0, O, 1, I and L. It must not already be a promoter code or a customer's referral code (otherwise "This code is already in use").
3. Choose **Social platform**: YouTube, Instagram, Facebook, X (Twitter), LinkedIn, WhatsApp, Telegram, Blog / Website, or Other.
4. Enter **Channel name** (required; customers see it).
5. Optionally fill **Channel link** (must start with http:// or https://), **Contact person**, **Phone** (7 to 15 digits), **Email**, **Address** and **Other details**.
6. Enter **Customer discount (%)**: a whole number from 1 to 50, off Prime and Elite.
7. Optionally enter **Reward valid for (days after signup)**, from 1 to 3,650. Leave it empty for no expiry.
8. Choose **Commission**: No commission, Percent of the first paid plan, or Fixed amount per paid customer, and enter the value.
9. Click **Create code**. A toast says "Code CHANL5 created".

Several codes can belong to one channel; create one record each. Contact details are stored for your team only and are never sent to the app.

## Edit or deactivate a code
Who can do it: super admin only. Click **Edit** on the row, or **Edit** in the detail view.
- The **code cannot be changed**. To use a different code, create a new one and switch the old one to Inactive.
- **Status**: Inactive means new signups with the code are refused. Rewards already issued stay valid, and commission is still booked when those customers pay.
- A new **discount percent** and **reward validity** apply to future signups only; existing rewards keep what they were issued with.
- A new **commission** setting applies to customers who have not yet made their first payment.

## The tab
Eight tiles: **Promoters** (with the active count), **Signups**, **Paid customers** (with the percentage of signups), **Revenue** (plan amount without GST from these customers), **Discount given**, **Commission earned**, **Commission paid** and **Commission due**.

The **Promoter codes** table has **Promoter** (channel name, code and platform), **Contact**, **Discount** (percent and validity such as "30 days" or "No expiry"), **Commission** (such as "10% of first plan"), **Customers** (signups and paid), **Revenue**, **Due** and **Status**. Search matches code, channel, contact, phone and email; the status filter offers All statuses, Active and Inactive. **Export** saves the open tab as Excel or PDF.

## The detail view
Click a row to open the promoter. It shows the code with a **Copy** button, contact details, and:
- **Signups** and the last signup date; **Paid customers** with the conversion rate; **Revenue** (without GST, all paid orders of these customers); **Discount given** and how many rewards were used; **Rewards expired** (never used in time).
- **Sign-ups by month** for the last 6 months, with the green part showing customers who paid, and **Plans bought**.
- **Customers onboarded**: Organization, Signed up, Status (Signed up or Paid), First plan (plan name with the amount of the first payment), Reward (Available with its expiry date, Used with the ₹ taken off, Expired, or Void) and Commission.
- The commission section with payouts (see the payouts article).

The plan name in **First plan** is the organization's latest plan; the amount is its first payment.

## What can go wrong
- **"Only a super operator can create promoter codes."**: you are not a super admin.
- **Customer says the code is not valid**: check the code is Active, that they typed all 6 characters, and that they are registering a new company.
- **The customer's discount disappeared**: the reward expired, was already used, or the purchase was Core, a coupon purchase or an add-staff purchase.

## Common questions
### Can I change a code after creating it?
No. Create a new code and make the old one Inactive.

### What does Inactive do to customers who already signed up?
Nothing. Their rewards stay valid and commission is still booked.

### Why is the percentage limited to 50?
The console and server only accept 1 to 50 for any referral discount.

### Can two promoters share a code?
No. A code is unique across promoter codes and customer referral codes.

### Where do I see who signed up with a code?
In the detail view, under **Customers onboarded**.
