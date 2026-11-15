---
title: Tickets and bugs (support requests)
summary: How support tickets from companies arrive, what Open, In Progress and Resolved mean, and how to reply, resolve and reopen a ticket on the Ticketing and Bugs page.
category: Support
audience: operator
tags: tickets, ticketing, bugs, support request, issue, reply, resolve, reopen, status, attachment, photo
page: tickets.html
updated: 2026-11-15
related: live-chat, suggestions, faq-hub, troubleshooting
---

The Ticketing and Bugs page lists the support requests that company admins raise from the Clockyn app. You read each request, reply to the company in a conversation thread, and mark it resolved when it is done. Any operator can do all of this.

## How a ticket reaches the page
In the app, a company admin opens the Support area, then raises a request with three inputs:

- **Subject**: chosen from a list ("Select a subject"). The list is not typed free text.
- **Message**: describe the issue or question.
- **Attach Photo (optional)**: one picture, such as a screenshot.

Then they tap **Submit Request**. The ticket starts as **Open**. One user can raise at most 10 tickets per hour. The photo must be an image (up to 10 MB by default). If the photo upload fails on the server, the ticket is still saved, just without the picture.

There is no separate "bug" type. Tickets and bug reports share one list; the subject the company picked tells you which kind it is. The subjects in the list are stored in the database (the support subjects table, only rows marked active appear in the app). The console has no screen to edit them, so ask a maintainer to add or change a subject. There are no priority or assignee fields.

## The two tables and the tiles
Four tiles sit at the top: **Total** (all requests), **Open** (waiting for a reply), **In Progress** (being handled) and **Resolved** (closed requests).

**Active Tickets** holds every ticket that is not resolved. Columns: #, Organization, Submitted By (name and mobile), Subject, Message (a paperclip icon means a photo is attached), Created, Status and Actions. The **View** button shows a small number when the ticket already has replies.

**Resolved Tickets** holds the closed ones. It has the same columns except that the second-last column is **Resolved**, which is the time of the last update.

The filter bar has a search box (organisation name or id, subject, person name, mobile number) and a status drop-down: **All Status**, **Open**, **In Progress**, **Resolved**. The search applies to both tables; the status drop-down narrows the Active table.

## What the statuses mean
| Status | Meaning | How it gets there |
|---|---|---|
| Open | New, nobody has replied. | The company submits the ticket. |
| In Progress | Someone is handling it. | An operator replies to an Open ticket, or you reopen a resolved one, or the company answers a resolved ticket. |
| Resolved | Finished. | An operator clicks Mark Resolved. |

Sending a reply on an Open ticket moves it to In Progress automatically. **Reopen Ticket** puts a resolved ticket back to In Progress (not to Open).

## Reply to a ticket
Who can do this: any operator.

1. Find the ticket in Active Tickets and click **View**. A box titled "Ticket #number - subject" opens.
2. Read the details: Organization, Status, Submitted By, Last Updated, the **Original Message** and the photo, if any. Click the photo to enlarge it.
3. Read the **Conversation** list. Operator replies are marked "(Admin)".
4. Type your answer in the box "Type your reply to the organization...".
5. Click **Send Reply**. A green "Reply sent successfully!" appears and the thread updates.

Replies are saved with your profile name (or "Admin" when you have none). Replies cannot be edited or deleted. The company sees the thread in My Tickets inside the app.

## Resolve or reopen a ticket
Who can do this: any operator.

1. Open the ticket with **View**.
2. Click **Mark Resolved** to close it. It moves to the Resolved Tickets table and shows "Ticket marked resolved!".
3. To reopen, find it in Resolved Tickets, click **View**, then **Reopen Ticket**. It returns to Active Tickets as In Progress.

Reply first if the company needs to hear the outcome. Marking resolved does not send any message by itself.

## Getting alerted
The page does not play a sound, and the left menu and the bell do not show a ticket count. The backend does not send an e-mail or push message to your team when a ticket arrives. Open the page on a routine (see [Daily checklist](kb:daily-checklist)) and use the refresh button in the top bar or **Refresh** on the page to load new tickets. Live chat is the channel that alerts you instantly; see [Live Chat](kb:live-chat).

## What can go wrong
- **"Failed to load tickets"** with Try again: the backend is unreachable. Retry; if it persists, tell a maintainer.
- **"Failed to send reply: Reply feature requires DB migration"**: the replies table is missing in this database. A maintainer must set it up.
- **A company cannot pick a subject**: the subject list is empty in the database, so the app has nothing to offer. A maintainer must add subjects.
- **The server answers "Invalid subject" when a company submits**: the subject they chose was switched off after the app loaded the list. Ask them to reopen the screen and try again.
- **The photo is missing**: the picture is optional and its upload is best effort. Ask the company to send it through Live Chat.

## Common questions
### What is the difference between a ticket and a bug?
The console treats them the same. The subject chosen when the ticket was raised says which it is.

### How do I know a company has answered me?
The ticket moves back to In Progress if it was resolved, and the reply count on the View button grows. There is no alert, so check the page regularly.

### Can I assign a ticket to a colleague?
Not in the console. There is no assignee field. Agree internally who handles which company.

### Does Mark Resolved tell the company?
No. Send a reply first, then resolve.

### Why does a new reply from me turn Open into In Progress?
That is automatic: the first admin reply on an Open ticket means it is being handled.

### Can I delete a ticket?
No. Tickets can only be replied to, resolved and reopened.
