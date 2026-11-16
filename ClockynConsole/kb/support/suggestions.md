---
title: Suggestions (feature requests from companies)
summary: How feature ideas reach the Suggestions page, how to read, search and reply to them, and what the suggestion counter really counts.
category: Support
audience: operator
tags: suggestions, feature request, feedback, ideas, reply, suggest a feature, counter, badge
page: suggestions.html
updated: 2026-11-15
related: live-chat, console-tour
---

The Suggestions page lists the feature ideas that company admins send from the Clockyn app. You read them, filter them by company, and can write a reply. Any operator can use this page (it is not limited to super admins).

## How a suggestion reaches the Suggestions page
A company admin opens the app, goes to Settings > Beyond > Suggest a Feature and fills in two fields:

- **Subject** (up to 120 characters), for example "Add dark mode support".
- **Message** (up to 1000 characters).

They then tap **Send Suggestion**. The app adds the company name and the sender's e-mail at the top of the message ("From: Company (e-mail)"). Both fields are required. One user can send at most 10 suggestions per hour.

The suggestion is saved in the platform's e-mail log, which is what the console reads. The backend also e-mails it to every address that is marked active in the active-mail list, so the team gets an e-mail copy as well. If the sending address is not configured on the server, the e-mail is skipped but the suggestion is still saved and still appears on the page.

## What the Suggestions page shows
At the top are three tiles:

| Tile | Meaning |
|---|---|
| Total | Every suggestion ever received. |
| Companies | How many different organisations have sent at least one. |
| This Month | Suggestions received in the current calendar month. |

Below the tiles is a filter bar. **Search by subject, email or company...** also matches the text of the message. **All Companies** limits the list to one company. **Newest First / Oldest First** changes the order. A tag on the right shows how many suggestions match.

Each suggestion is a card with the sender's initials, the company name (or the e-mail, or the organisation id when the name is unknown), the sender's e-mail, the date and time, the subject, the message and a company chip. The list shows 15 cards per page; use the page numbers at the bottom.

## Reply to a suggestion
Who can do this: any operator.

1. Find the card (use the search box or the company filter).
2. Click **Reply** on the card. A box titled "Reply to Suggestion" opens and shows who it is from. Earlier replies, if any, appear under "Previous Replies".
3. Type your answer in **Your Reply**.
4. Click **Send Reply**. A green message "Reply sent successfully" appears and the list reloads.

You can reply more than once. After the first reply the card shows a **View 1 reply** link (or "View 2 replies" and so on) that expands the thread. Each reply shows your name, taken from your profile (it says "Admin" if your profile has no name), and the date.

> **Warning** The current Clockyn app has no screen that shows replies to suggestions. The reply is saved and the backend can serve it to the app, but the company will not see it today. If a company needs to know something, also answer through [Live Chat](kb:live-chat) or e-mail.

## What the suggestion counter counts
The number on the Suggestions item in the left menu, and the "Feature suggestions" line in the bell menu, is the **total number of suggestions in the list**. It is not the number of unread or unanswered ones, and it does not go down when you reply. Treat it as "how many suggestions exist", not "how many need attention".

## What this page does not have
There are no statuses (such as planned or done), no way to close or delete a suggestion, and no export button. If you need to track which ideas were accepted, keep that outside the console.

## What can go wrong
- **"Failed to load suggestions"** (with a Try again button): the page could not reach the backend. Click Try again. If it keeps failing, check your connection and tell a maintainer.
- **"Failed to send reply: Reply feature requires DB migration"**: the table that stores replies has not been created in this database. This is a set-up problem for a maintainer, not something you can fix in the console.
- **A company says it sent a suggestion but you cannot find it**: the sender may have hit the limit of 10 per hour, or the send failed on their phone. Ask them to try again and check the page after a refresh (the refresh icon in the top bar).
- **A card shows an organisation id instead of a name**: the organisation record could not be matched. Use the e-mail on the card to identify the company.

## Common questions
### Why does the suggestion counter not go down after I reply?
Because it counts every suggestion, not unanswered ones. Replying does not change it.

### Can the company see my reply?
Not in the current app. The reply is stored, but no app screen shows it yet. Use Live Chat or e-mail to reach the company.

### Can I mark a suggestion as done or delete it?
No. The page only lists, filters and replies.

### Who receives the e-mail copy of a suggestion?
Every address marked active in the active-mail list on the server. That list is managed in the database, not in the console.

### Is the search case sensitive?
No. It matches part of the subject, message, e-mail or company name in any letter case.

### How many suggestions can one person send?
Ten per hour. After that the app shows an error and they must wait.
