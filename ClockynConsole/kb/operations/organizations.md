---
title: Organizations (list, register, activate, deactivate, delete)
summary: How to read the Organizations list and how to register, deactivate, reactivate, delete and export companies, including what each action really does.
category: Operations
audience: operator
tags: organizations, companies, org, customers, register company, add organization, deactivate, activate, delete, status, free trial, expired, staff count, export, filter, sort
page: organizations.html
updated: 2026-11-15
related: organization-analytics, users, subscriptions-and-plans, account-deletion-requests, roles-and-permissions
---

The Organizations page lists every company registered on Clockyn with its owner contact, location, plan, status and headcount. From here you can open a company, register a new one on its behalf, switch a company off or on, delete it, and export the list. Any operator can use all of these actions; they are not limited to super admins.

## Summary tiles

| Tile | Meaning |
|---|---|
| Total organizations | All rows the backend returned (not just the ones filtered). |
| Active plans | Companies whose plan status is Active. A plan whose end date has passed counts as Expired, not Active. |
| Free trial | Companies whose plan status is Free Trial. This includes trials that have already ended and show "Expired" in the table. |
| Total employees | Sum of the Staff column over all companies. |

## Columns

- **Organization**: name, with "Joined" followed by a date underneath. That date is the company's last-changed date when it has one, otherwise its creation date.
- **Contact**: the owner's email and mobile.
- **Location**: district, with state and pincode underneath.
- **Plan**: plan of the latest subscription, or "Free Trial" when the company never subscribed.
- **Status**: Active, Free Trial, Inactive or Expired from the plan. A Free Trial whose end date is in the past and that has not paid shows as Expired.
- **Staff**: active managers and employees. The owner is not counted.
- **Plan period**: the plan end date, highlighted when it is within the next 30 days, and "from" and the start date below it.

> **Note** There is no "Deactivated" badge. A company that was deactivated keeps its plan status; the only sign is that its row offers **Activate** instead of **Deactivate**.

## Search, filter and sort

Who can do this: any operator.

1. Type in the search box at the top: it matches name, email, mobile, state, district and pincode.
2. Use the dropdowns for Status, State and District. Choosing a state narrows the district list.
3. Use the sort dropdown: Latest joined (default), Active Employee Punch In / Punch Out Count (today's punches of active staff), Employee Count, Free Trial Count, Active Count or Expired Count. The last three put matching companies first.
4. Refresh (top bar) reloads the list and clears all filters.

## Open a company

Click anywhere on a row (except the action buttons) to open the [organization analytics](kb:organization-analytics) page for it.

## Register a company on someone's behalf

Who can do this: any operator. Use it when a customer cannot register in the app.

1. Click **Add organization**.
2. Fill Company name and Company address (required), and optionally state, district, pincode and GST number.
3. Under Contact, enter the Mobile number and click **Get OTP**; the code goes to that number. Enter it and click **Verify**. Do the same for the Email ID. Both must show Verified.
4. Under Structure, enter at least one Branch (use **Add branch** for more). Departments are optional; if you add none, the department "General" is created.
5. Optionally upload a logo, or open **Add more details** for PAN, website, CIN, TAN, MSME and business category.
6. Click **Register Organization**. The list reloads.

The company name is also used as the owner's name on the new account.

## Deactivate or activate a company

Who can do this: any operator. You are asked to confirm, and the button uses your signed-in email as the "changed by" name.

1. Find the row and click **Deactivate** (or **Activate**).
2. Confirm in the browser prompt.

Deactivate marks the company and all of its users inactive. Managers and employees who are signed in are signed out. Each change is recorded with the operator's email.

> **Warning** **Activate** switches on every user of the company and its owner, including people who were switched off or removed earlier. Check with the customer before reactivating a company that had staff removed.

## Delete a company

Who can do this: any operator. Deleting needs a one-time code sent to your own login email.

1. Click **Delete** on the row. An OTP is sent to your email.
2. Enter the 6-digit code in "Confirm delete" and click **Delete**.

> **Warning** The confirmation says it cannot be undone. In practice the console marks the company inactive and every user of it as deleted (status 2); it does not erase rows. After you refresh, the company can reappear in the list as inactive. Permanent removal of an owner's data is done through [account deletion requests](kb:account-deletion-requests).

## Edit company details

The backend can update a company's name, address, GST, state, district, pincode and the owner's mobile and email, and the page contains an Edit dialog. At the moment no button on the page opens that dialog, so editing is not available from the console. Ask a maintainer if a customer needs a correction.

## Export

Use the export button above the table for Excel or PDF. The file contains the rows currently shown after filters and sorting, with Organization, Email, Mobile, State, District, Pincode, Plan, Status, Employees, Joined, Plan Start and Plan Expires.

## What can go wrong

- **"Couldn't load organizations":** the backend answered with an error or could not be reached. Press Try again; see [Troubleshooting](kb:troubleshooting).
- **Get OTP says failed:** the mobile must be 10 digits and the email must contain "@"; otherwise the backend message is shown.
- **Deleted company still listed:** expected, see the Delete warning above.

## Common questions

### Why does the Free trial tile count a company shown as Expired?
The tile counts the stored plan status. A trial that ended without payment is displayed as Expired in the table and filter, but the tile does not apply that rule.

### Why can I filter by Inactive but see no results?
That filter matches the plan status Inactive. A deactivated company keeps its plan status, so it is not matched.

### Does deactivating stop billing?
No. It only changes user and company status. The subscription is untouched.

### Can I see which operator deactivated a company?
Each change is stored with the operator's email (first 20 characters). It is not shown in the console.

### Why is the Joined date later than I expected?
It shows the last-changed date when one exists.
