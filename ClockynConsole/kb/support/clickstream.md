---
title: Clickstream (how people use the app)
summary: What the Clickstream page collects and shows across its four tabs (Overview, Behaviour, Business, Live stream), how every tile, chart and funnel is calculated, the privacy rules, and how to read it.
category: Support
audience: operator
tags: clickstream, analytics, usage, screens, taps, funnel, stickiness, sessions, active users, drop off, retention, privacy, purge, live stream, heatmap
page: clickstream.html
updated: 2026-11-15
related: video-views, organizations, faq-hub, security-settings
---

The Clickstream page shows how people really use the Clockyn app: who is active, which screens they open, what they tap, where they give up, and how that connects to sign-ups and revenue. Any operator can read it. Exports are available for the tab you are on.

## What the app collects
While someone is signed in, the app records:
- **Screen views**: the screen's route pattern only, such as `/admin/staff/edit`. Real ids in the address are never stored.
- **Taps**: the label of the button and the screen it was tapped on.
- **Session starts** and a few **key actions** (app opened, signed in, completed registration, subscribed to a plan, punched in or out).

It never records typed text. A label that looks like an e-mail address or contains a number of six or more digits is dropped on the phone, and the server replaces any that slips through with "[redacted]". Screen names are capped at 120 characters and button labels at 80. Which person and which company an event belongs to is taken from the signed-in session on the server, not from the phone.

Events are sent about every 15 seconds and when the app goes to the background. Offline, the phone keeps up to 200 events; a session ends after 30 minutes without activity. An event that arrives more than 24 hours late is stored with its arrival time. A build made with the analytics switch set to "off" sends nothing. Every event is counted; the page does not sample.

## The filters
At the top you choose the **period** (Last 7 days, Last 30 days or Last 90 days; 30 is the default), the **platform** (All platforms, Android, iPhone, Web) and the **role** (All roles, Admins, Managers, Staff). Each tile also shows the change against the previous period of the same length. All days and hours are in India time (IST).

## Overview tab
**Tiles**
| Tile | Meaning |
|---|---|
| Active people | Different people who used the app in the period. |
| Active organizations | Different companies with activity. |
| Sessions | Visits to the app (a new session starts after 30 idle minutes). |
| Time per session | Average time between the first and last event of a session (sessions with at least two events). |
| Screens per session | Screen views divided by sessions. |
| Daily stickiness | Average daily users divided by monthly users over the last 30 days. Below it: people active today, this week and this month. |

Other sections: **Daily activity** (people and sessions per day), **When they use it** (a weekday and hour grid; the darkest cells are the best moments for announcements), **What stands out** (up to nine plain-language findings, such as usage up or down by 10% or more, low or high stickiness, the busiest time and how many people are on the newest app version) and **Who uses the app** (people by platform, role and app version).

## Behaviour tab
- **Most opened screens**: views, people and average time on each screen.
- **Most tapped buttons**: taps and people, and the screen they were on.
- **Journeys**: the most common next screen after each screen.
- **Key actions**: sign-ins, registrations, punches and subscriptions reported by the app.
- **Where people drop off**: four funnels. A person is counted at a step only if they reached it after the previous step, using their first visit to each step in the period.

| Funnel | Steps |
|---|---|
| Add your team | Admin home, Staff list, Add / edit staff |
| Upgrade to a paid plan | Billing, Choose a plan, Checkout |
| Payroll adoption | Monthly salary, Salary sheet, Payslips |
| Getting help | Help tab, Videos, FAQ or chat |

## Business tab
Tiles: **New organizations**, **Staff added**, **On free trial** (right now), **Paying organizations** (active subscriptions), **Revenue** (total of paid orders created in the period, including GST) and **Checkout completion** (paid orders as a share of orders started). Below are **Feature adoption** (share of all companies that used attendance, requests, CRM leads, expenses, odometer, announcements or salary payments in the period), **New organizations** per day, where new admins came from, **Customers and revenue**, **Help and support** (video views and companies that wrote to live chat), **Most active organizations** (top 10) and **Gone quiet** (active in the earlier weeks but nothing in the last 7 days; top 10, worth a call).

## Live stream tab
The newest 200 events. Search by screen, button, company or person, and filter by **All events**, **Screen views**, **Taps** or **Session starts**. Columns: Time (IST), Event, What, Organization, Person, Device. Names are visible to operators only.

## How to read it
1. Start with **What stands out**, then check **Active people** against the previous period.
2. Open **Where people drop off**. A big fall between two steps (for example Choose a plan to Checkout) shows where to improve the screen or add a [FAQ](kb:faq-hub) or [video](kb:video-hub).
3. Compare **Most watched video** on [Video Views](kb:video-views) with the busiest screens.
4. Use **Gone quiet** to pick companies to contact.
5. Use the heatmap to time announcements.

## Retention and purge
Events stay in the database until they are purged. A super admin can delete old events through the backend with `POST /gen-dashboard/clickstream/purge?days=N`, which removes events older than N days (N must be at least 30; the default is 180). The console has no purge button, so ask a maintainer or run it as a super admin.

## What can go wrong
- **"No data yet" banner**: no event has been reported. The app only reports from builds that include the clickstream. Business numbers still work.
- **The page says the clickstream table does not exist yet**: the database set-up for events (migration 036) has not been applied. A maintainer must apply it.
- **Numbers differ from other pages**: Clickstream counts activity events, while other pages count records. Revenue here is paid orders including GST.
- **A person's name is blank in Live stream**: the user record is missing or the event had no matching account.
- **Old app versions are absent**: they send nothing, so they cannot appear.

## Common questions
### Is typed text ever stored?
No. Only screen patterns and button labels are stored, and e-mail-like or long-number labels are redacted.

### What is stickiness?
The average number of people active on a day divided by the number active in the month, as a percent. About 25% or more means people come back often; below 10% means occasional use.

### Can I see longer than 90 days?
The page offers 7, 30 and 90 days. The backend can report up to 180 days.

### Does it sample the data?
No. Every event that reaches the server is counted.

### How do I delete old events?
A super admin uses the purge endpoint (minimum 30 days). There is no button.
