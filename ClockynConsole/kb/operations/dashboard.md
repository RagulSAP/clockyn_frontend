---
title: Dashboard (Admin Overview)
summary: What every tile, chart and list on the console Dashboard shows, where each number comes from, and why it can differ from other pages.
category: Operations
audience: all
tags: dashboard, overview, home, stats, tiles, revenue, active today, plan distribution, recent organizations, active plans, free trial, numbers
page: dashboard.html
updated: 2026-11-15
related: organizations, organization-analytics, users, subscriptions-and-plans, payments, console-tour
---

The Dashboard is the first page after you sign in. Its title is "Admin Overview" and it gives live numbers across every organization (company) on Clockyn. Any operator can open it, and every block is read-only. Nothing on this page changes data.

## What loads and when

The page loads all five blocks when you open it and again when you press **Refresh** (the button next to the date, or the circular arrow in the top bar). It does not update by itself, so press Refresh if you leave it open for a while. If a block fails to load, the others stay on screen: the chart, plan and organization blocks show a "Try again" message, and the four tiles simply stay at a dash.

## The four tiles

Each tile is also a link to the page that holds the detail.

| Tile | What it shows | Where the number comes from |
|---|---|---|
| Organizations (links to Organizations) | Total registered | Every organization row, including inactive and deleted-by-console ones. |
| Users (links to Users) | Active across orgs | Every user with status Active, of any role. This includes each company's owner (admin), managers and employees. |
| Revenue (Month) (links to Payments) | Verified payments | The sum of payments with status PAID that were created in the current calendar month. The amount includes GST because it is what the customer paid. It is shown as ₹950, ₹12.5K (thousands) or ₹3.2L (lakhs). |
| Active Plans (links to Subscriptions) | Live subscriptions | The number of subscriptions whose stored status is ACTIVE. |

> **Note** The Dashboard "Active Plans" tile counts the stored status. The Organizations page corrects a plan whose end date has passed to Expired, so the two counts can differ for a day or two. See [Organizations](kb:organizations).

## Active Today

On the Dashboard, the **Active Today** card lists organizations where at least one person has punched in today (India date). Each chip shows the organization name, how many different staff punched in ("12 staff") and the time of the latest punch-in. The badge in the card title counts the chips ("5 orgs").

- Only organizations with status Active are included. The list shows at most 50, largest crowd first.
- It looks only at punches. A company with an expired plan still appears if its staff punch in.
- Clicking a chip opens that organization's [analytics page](kb:organization-analytics).

## Monthly Revenue chart

On the Dashboard, the **Monthly Revenue** chart groups PAID payments by calendar month for the last 12 months.

1. Use **6M** or **1Y** to choose how many bars to draw.
2. Hover (or tap) a bar to see the month and the exact rupee amount.
3. The subtitle shows the total for the period. The left axis shows the highest month and half of it.

A month with no PAID payment is not drawn at all (it does not appear as an empty bar), so "6M" means the last six months that had revenue. Labels are three-letter month names without the year. The most recent bar is green.

## Plan Distribution and Subscription Plans

The donut and the **Subscription Plans** card show how the ACTIVE subscriptions are spread across plans.

- Each plan row of the price table is listed separately, so the 1-month, 6-month and 12-month versions of "Core" are three entries. A plan with no active subscriptions still appears with 0.
- The small text such as "₹49/6mo" means ₹49 per staff per month, for a plan lasting 6 months. It is not a 6-month price.
- The centre of the donut is the total of all counts. The card also shows each plan's share as a percentage and a bar.

## Recent Organizations

This table shows the newest organizations first. It starts with five rows; **View All** shows every organization and **Show Less** goes back.

- **Plan**: the plan of the latest subscription, or "Free Trial" when the company never subscribed.
- **Users**: active managers and employees of the company (the owner is not counted).
- **Status**: Active, Free trial, Expired or Inactive, taken from the latest subscription. An Active plan whose end date has passed is shown as Expired.
- **Expires**: the end date of the latest subscription, or a dash when there is none (free-trial companies show a dash).
- Clicking a row opens the organization's analytics.

## The top bar

The date label shows today's date. The search box in the top bar of this page does not filter anything yet. The bell lists things that need attention (live chats, deletion requests, suggestions) and the round chat button at the bottom right opens Live Chat. See [Console tour](kb:console-tour).

## What can go wrong

- **A tile shows a dash:** that request failed. Press Refresh. If it keeps failing, the backend is unreachable or you are signed out; see [Troubleshooting](kb:troubleshooting).
- **Revenue looks too low or has gaps:** only payments with status PAID are added up. Failed or pending payments are left out, and months without a PAID payment are not drawn.
- **Counts disagree with another page:** the pages apply slightly different rules, explained in the questions below.

## Common questions

### Why does Active Plans here differ from Active plans on the Organizations page?
The Dashboard counts subscriptions whose stored status is ACTIVE. The Organizations page counts organizations whose plan is Active after treating a plan past its end date as Expired. A plan that ended yesterday but has not been marked Expired yet counts on the Dashboard only.

### Why is an Expired organization listed under Active Today?
Active Today only checks that someone punched in today at an organization with status Active. It does not look at the plan.

### Why does the Users tile include company owners?
It counts every user with status Active, whatever the role. The Users page hides owners from its table but its first tiles still count them.

### Why is a month missing from the revenue chart?
No payment with status PAID was created in that month. Empty months are skipped.

### Why does the search box at the top do nothing?
On this page it is a placeholder and has no search behind it. Use the search on the Organizations or Users pages.

### How current is the data?
It is as of the moment the page loaded or you last pressed Refresh.
