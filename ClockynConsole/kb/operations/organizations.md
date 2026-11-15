---
title: Organizations (list, filters, expiring plans, export)
summary: How to read the Organizations list, search, filter and sort it, find companies whose plan is about to expire, and export it.
category: Operations
audience: operator
tags: organizations, companies, org, customers, status, free trial, expired, staff count, export, filter, sort, expiring, renewal, expiring today, expiring this week, plan end date
page: organizations.html
updated: 2026-11-15
related: dashboard, organization-actions, organization-analytics, users, subscriptions-and-plans, account-deletion-requests, roles-and-permissions, start-a-chat-with-a-company
---

The Organizations page lists every company registered on Clockyn with its owner contact, location, plan, status and headcount. From here you can open a company, chat with its admin, find plans that are about to end, and export the list. Registering, deactivating and deleting companies are covered in [Register, deactivate, activate and delete organizations](kb:organization-actions). Any operator can use all of these actions.

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
2. Use the dropdowns for Status, Expiring, State and District. Choosing a state narrows the district list.
3. Use the sort dropdown: Latest joined (default), Active Employee Punch In / Punch Out Count (today's punches of active staff), Employee Count, Free Trial Count, Active Count or Expired Count. The last three put matching companies first.
4. Refresh (top bar) reloads the list and clears all filters, including Expiring.

## Expiring filter

On the Organizations page, the **Expiring** dropdown shows the customers whose paid plan is about to end. Its choices are **Any expiry**, **Expiring today**, **Expiring in 7 days** and **Expiring in 30 days**. Any operator can use it.

- **Opened from the Dashboard.** Clicking a row of the Subscriptions expiring card opens this page with the filter already chosen (the address ends in `?expiring=today`, `?expiring=7d` or `?expiring=30d`). An unknown value is ignored.
- **The rule.** A company is listed when its plan status is Active, it is not deleted, and its plan end date is from today up to the end of the window, counted from today's date in India (not your computer's date). Today is included, so "7 days" means today plus the next seven days. Free trials, Expired plans, deleted companies and companies with no plan end date never appear. A deactivated company with an active plan does appear.
- **Same numbers as the Dashboard.** The list has exactly as many companies as the number on the Dashboard row you clicked. See [Dashboard](kb:dashboard).
- **The hint bar.** While the filter is on, a line above the table says which window is shown and how many companies match, with a **Clear filter** button. Clear filter, choosing **Any expiry**, or **Refresh** all switch it off.
- **Order.** The list is sorted soonest end date first, then by name, unless you choose another sort.
- **Combining.** The filter works together with search, Status, State and District. Status Expired together with Expiring shows nothing, because an Expired plan is never in the expiring windows.

## Open a company

Click anywhere on a row (except the action buttons) to open the [organization analytics](kb:organization-analytics) page for it.

## Chat with a company

Who can do this: any operator. Click the **Chat** icon in the row's **Actions** cell. The support chat opens for that company, ready for your message. A deleted company or one with no active admin cannot be messaged. Details are in [Start a chat with a company](kb:start-a-chat-with-a-company).

## Register, deactivate, activate or delete a company

Every row has buttons to switch a company off or on and to delete it, and the page can register a new company for a customer. These actions, with their warnings, are explained in [Register, deactivate, activate and delete organizations](kb:organization-actions).

## Export

Use the export button above the table for Excel or PDF. The file contains the rows currently shown after filters and sorting, with Organization, Email, Mobile, State, District, Pincode, Plan, Status, Employees, Joined, Plan Start and Plan Expires.

## What can go wrong

- **"Couldn't load organizations":** the backend answered with an error or could not be reached. Press Try again; see [Troubleshooting](kb:troubleshooting).
- **A deleted company is still listed:** expected; see [Register, deactivate, activate and delete organizations](kb:organization-actions).

## Common questions

### Why does the Free trial tile count a company shown as Expired?
The tile counts the stored plan status. A trial that ended without payment is displayed as Expired in the table and filter, but the tile does not apply that rule.

### Why can I filter by Inactive but see no results?
That filter matches the plan status Inactive. A deactivated company keeps its plan status, so it is not matched.

### Why does Expiring in 30 days show fewer companies than the Expired filter?
They are different groups. Expiring lists paid plans that are still Active and end soon; Expired lists plans that have already ended.

### A company is about to expire but is not in the Expiring list. Why?
Check its Status: a free trial, an already Expired plan, a deleted company, or a missing plan end date is never listed. Its latest subscription may also be a newer one that ends later.

### How do I message a company's admin?
Click the Chat icon in the company's Actions cell and send the first message. See [Start a chat with a company](kb:start-a-chat-with-a-company).
