---
title: Dashboard (Admin Overview)
summary: What every tile, chart and list on the console Dashboard shows, including the Subscriptions expiring card, where each number comes from, and why it can differ from other pages.
category: Operations
audience: all
tags: dashboard, overview, home, stats, tiles, revenue, active today, plan distribution, recent organizations, active plans, free trial, numbers, expiring subscriptions, renewals, expiring today, expiring this week
page: dashboard.html
updated: 2026-11-15
related: organizations, organization-analytics, users, subscriptions-and-plans, payments, console-tour, daily-checklist
---

The Dashboard is the first page after you sign in. Its title is "Admin Overview" and it gives live numbers across every organization (company) on Clockyn. Any operator can open it, and every block is read-only. Nothing on this page changes data.

## What loads and when

The page loads all its blocks when you open it and again when you press **Refresh**. It does not update by itself. If a block fails to load, the others stay on screen: the chart, plan and organization blocks show "Try again", and the four tiles and the three Subscriptions expiring rows stay at a dash, because they come from the same request.

## The four tiles

Each tile is also a link to the page that holds the detail.

| Tile | What it shows | Where the number comes from |
|---|---|---|
| Organizations (links to Organizations) | Total registered | Every organization row, including inactive and deleted-by-console ones. |
| Users (links to Users) | Active across orgs | Every user with status Active, of any role, including each company's owner. |
| Revenue (Month) (links to Payments) | Verified payments | The sum of payments with status PAID created in the current calendar month, GST included. Shown as ₹950, ₹12.5K (thousands) or ₹3.2L (lakhs). |
| Active Plans (links to Subscriptions) | Live subscriptions | The number of subscriptions whose stored status is ACTIVE. |

> **Note** The Dashboard "Active Plans" tile counts the stored status. The Organizations page corrects a plan whose end date has passed to Expired, so the two counts can differ for a day or two. See [Organizations](kb:organizations).

## Active Today

On the Dashboard, the **Active Today** card lists organizations where at least one person has punched in today (India date). Each chip shows the organization name, how many different staff punched in ("12 staff") and the time of the latest punch-in.

- Only organizations with status Active are included, at most 50, largest crowd first. A company with an expired plan still appears if its staff punch in.
- Clicking a chip opens that organization's [analytics page](kb:organization-analytics).

## Monthly Revenue chart

On the Dashboard, the **Monthly Revenue** chart groups PAID payments by calendar month for the last 12 months. Use **6M** or **1Y** to choose how many bars to draw, and hover a bar for the exact amount. A month with no PAID payment is not drawn, so "6M" means the last six months that had revenue.

## Plan Distribution

On the Dashboard, the **Plan Distribution** donut shows how the ACTIVE subscriptions are spread across plans.

- Each plan row of the price table is listed separately, so the 1-month, 6-month and 12-month versions of "Core" are three entries. A plan with no active subscriptions still appears with 0.
- The small text such as "₹49/6mo" means ₹49 per staff per month, for a plan lasting 6 months. It is not a 6-month price.
- The centre of the donut is the total of all counts.

## Subscriptions expiring

On the Dashboard, the **Subscriptions expiring** card (next to Recent Organizations) tells you how many customers' paid plans are about to run out, so you can contact them before they lapse. Any operator can use it.

| Row | What it counts |
|---|---|
| Today | Organizations whose plan ends today. |
| Next 7 days | Plans ending from today up to 7 days from today. |
| Next 30 days | Plans ending from today up to 30 days from today. |

The rows are cumulative: today's plans are inside Next 7 days, and both are inside Next 30 days. Do not add the rows together.

**The exact rule.** An organization is counted when all three are true: its latest subscription is ACTIVE; the plan's end date falls in the window, counted from today's date in India (IST) with today included; and the organization is not deleted. These are not counted: free-trial companies, plans that have already expired, deleted organizations, and companies without a plan end date. A deactivated organization that still has an active plan is counted.

**Click a row.** It opens [Organizations](kb:organizations) with the matching Expiring filter. The list has exactly as many organizations as the number you clicked, because the card and the filter use the same rule. The **Today** number turns red when it is above zero. If the backend does not send the numbers, each row shows a dash.

### A renewal routine

1. Every morning click **Today** and **Next 7 days**; the list is sorted soonest first.
2. Contact each owner from the Contact column, or use the row's Chat icon ([Start a chat with a company](kb:start-a-chat-with-a-company)).
3. Once a week go through **Next 30 days**.
4. After the customer pays, the payment shows on [Payments](kb:payments) and the company leaves the list when you refresh.

## Recent Organizations

This table shows the newest organizations first. It starts with five rows; **View All** shows every organization and **Show Less** goes back.

- **Plan**: the plan of the latest subscription, or "Free Trial" when the company never subscribed.
- **Users**: active managers and employees (the owner is not counted).
- **Status**: Active, Free trial, Expired or Inactive, from the latest subscription. An Active plan past its end date shows as Expired.
- **Expires**: the end date of the latest subscription, or a dash. Clicking a row opens the organization's analytics.

## The top bar

The search box in the top bar of this page does not filter anything yet. The bell and the round chat button are explained in the [Console tour](kb:console-tour).

## What can go wrong

- **A tile or an expiry row shows a dash:** that request failed. Press Refresh. If it keeps failing, the backend is unreachable or you are signed out; see [Troubleshooting](kb:troubleshooting).
- **Revenue looks too low or has gaps:** only payments with status PAID are added up, and months without one are not drawn.
- **An organization you expected is missing from an expiry row:** it may be a free trial, already expired, deleted, or its latest subscription may be a newer one that ends later.
- **Counts disagree with another page:** the pages apply slightly different rules, explained below.

## Common questions

### Why does Active Plans here differ from Active plans on the Organizations page?
The Dashboard counts subscriptions whose stored status is ACTIVE. The Organizations page counts organizations whose plan is Active after treating a plan past its end date as Expired. A plan that ended yesterday but has not been marked Expired yet counts on the Dashboard only.

### How is Next 7 days different from the Expiring badge on Subscriptions?
They are separate rules. The Subscriptions page shows an orange Expiring badge at 15 days or fewer, and the Organizations page highlights an end date in orange within 30 days. This card counts exactly today, 7 days and 30 days from India's date.

### Why is a month missing from the revenue chart?
No payment with status PAID was created in that month. Empty months are skipped.
