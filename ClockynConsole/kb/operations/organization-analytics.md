---
title: Organization analytics (one company's details, attendance and staff)
summary: How to read a single company's page: its details card, attendance tiles, bar chart, timeline, daily punch photos and employee list.
category: Operations
audience: operator
tags: organization analytics, org analytics, company details, attendance, present today, punch photos, employees, timeline, attendance rate, staff limit, copy org id, support
page: org_analytics.html
updated: 2026-11-15
related: organizations, users, dashboard, roles-and-permissions, glossary
---

The organization analytics page shows everything about one company in one place: who the owner is, which plan it is on, how many staff it has and how many punched in each day. You reach it by clicking an organization on the Organizations page, on a Dashboard chip or row, or by opening a link ending in `org_analytics.html?org_id=...`. Any operator can open it. It is read-only.

## Organization Details card

The card at the top has a status badge and these fields, each loaded from the company record:

| Field | Meaning |
|---|---|
| Org ID, Org Name | Identifier and name. |
| Admin Name, Phone, Email | The company owner's details. |
| GST Number, Address, State, District, Pincode | Company address data; "--" when empty. |
| Plan | The company's ACTIVE subscription plan, or "No Plan" when it has none. |
| Sub Status | Status of that subscription. Because only an ACTIVE one is read, it normally says Active. |
| Valid Till | End date of that subscription. |
| Staff Limit | Maximum number of staff the active plan allows. |

The badge shows the company status: **Active**, **Inactive** or **Deleted**. A small copy button next to Org ID, Org Name, Phone, Email and GST Number copies the value; this is the quickest way to get an Org ID for support work.

> **Note** The plan fields only read an ACTIVE subscription. A company whose plan has expired shows "No Plan" and "--" here, even though the Organizations list shows its expired plan.

## Tiles

- **Total Employees**: active managers and employees of this company (the owner is not counted).
- **Present Today**: how many different people punched in today, with the percentage of Total Employees underneath.
- **Avg Attendance**: the average number of people present per day over the days shown in the chart. It is a head count, not a percentage.

## Period buttons

**Last 7 / 14 / 30 Days** change the chart and the timeline together.

## Bar chart: Total Employees vs Active (Present) Employees

Each column is one day with a bar for people present (punched in) and a bar for absent, where absent is Total Employees minus present. Hover a column for the exact numbers. Click or press Enter on a column to open that day's punch photos.

The chart takes the last N days that have at least one punch. A day on which nobody punched in is missing, so a "Last 7 Days" chart can span more than seven calendar days.

## Attendance Timeline

One row per calendar day, newest at the bottom, with a bar and "present / total" and a percentage. The colour shows the attendance rate:

| Colour | Rate |
|---|---|
| Green | 80% or more |
| Blue | 60 to 79% |
| Amber | 40 to 59% |
| Red | under 40% |

A day with nobody present shows a dash. Click a row to open that day's punch photos.

## Day attendance and punch photos

Clicking a column or timeline row opens "Attendance" for that date with chips for Present, Absent and Total. Present staff appear as cards with the role, department, punch-in and punch-out times, hours worked and the two punch photos. Click a photo to enlarge it; Escape closes the photo first, then the dialog. Absent staff are listed as chips. The photo links are temporary signed links that are created each time you open the dialog.

## Employees table

Lists every manager and employee of the company, including inactive ones, sorted by name. Columns: Name, Emp ID, Role, Department, Branch, Mobile, Today In, Today Out and Status (Active or Inactive). Use the search box to filter by name, employee ID or department.

## What can go wrong

- **"Invalid organization":** the link has no `org_id`. Open the page from the Organizations list.
- **"Failed to load analytics":** the backend did not answer; press Try again or the refresh icon.
- **A person appears twice in the employees list or the day dialog:** the backend returns one row for each punch session of the day, so someone with two sessions today shows twice.
- **Present Today looks like yesterday just after midnight:** the page works out "today" from the browser's universal date, which is behind India time for the first hours after midnight.

## Common questions

### How do I find a company's Org ID?
Open its analytics page and use the copy button next to Org ID in the details card.

### Why does the Plan say "No Plan" when the company paid before?
The card reads only an ACTIVE subscription. If the plan has ended, nothing is shown there. Check the [Organizations](kb:organizations) list or the Subscriptions page for the expired plan.

### Why is Total Employees lower than the Employees table count?
Total Employees counts only active staff. The table also lists inactive staff.

### Can I change anything from this page?
No. It only shows data. Use Organizations to deactivate or register companies.

### What does Absent mean exactly?
Total Employees minus the people who punched in that day. It does not know about leave or holidays.
