---
title: Troubleshooting the console
summary: Symptom, cause and fix for common operator problems: blank pages, sign-in loops, 401 and 403 errors, Failed to load and CORS errors, stale numbers, chat or bell issues and export problems.
category: Reference
audience: all
tags: troubleshooting, problem, error, not working, blank page, failed to load, cors, 401, 403, session expired, loop, stale, not refreshing, chat not updating, bell, export, environment, api, cache, ctrl f5
updated: 2026-11-15
related: signing-in, roles-and-permissions, console-tour, live-chat, how-the-console-works
---

Use this page when something on the console does not behave. Find your symptom in the table, then read the matching section. When you report a problem, say which page you were on, what you clicked and the exact message shown.

## Quick table

| Symptom | Most likely cause | First thing to try |
| --- | --- | --- |
| Page is blank or half drawn | An old copy of the page is cached, or a script did not load | Press Ctrl+F5 |
| Sent to the login page again and again | Session ends immediately | See "Session expired loops" below |
| "Your session expired. Please sign in again." | The server says your session is over | Sign in again |
| "Only role_id=1 admins can perform this action" | You used a super admin action | Ask a super admin |
| "Failed to load" or a network error on every page | The console cannot reach the server | See "Failed to load and CORS" below |
| Numbers look old | Only chat updates live | Click Refresh or reload |
| Chat does not update | The live connection is down | See "Chat not updating" below |
| Bell dot never goes away | It counts suggestions and other lists that never empty | See "Bell dot stuck" below |
| Export does nothing | The export libraries did not load | Check your connection |
| Data looks like another company's or is wrong | The console points to another environment | See "Wrong environment" below |

## Blank page or an old version of a page

After an update your browser may still hold the old files. Press **Ctrl+F5** (hard refresh). If all pages stay blank the site itself may be down: tell a developer. Open the console through its site address, not a downloaded file, because pages load shared scripts from the folders next to them.

## Session expired loops

**Symptom:** you sign in, land on a page, and are sent back to the login page, sometimes with "Your session expired. Please sign in again."

Causes and fixes:

1. **Your computer clock is wrong or jumped.** The console remembers when the session should end using your computer's clock. Fix the clock and sign in again.
2. **Your browser blocks site storage** (a private window with strict settings, or a setting that clears site data). The console cannot keep the session. Use a normal window or allow site data for the console address.
3. **Your console user was deleted or its e-mail changed.** The server checks you on every request. Ask a super admin.
4. **The server's signing secret changed.** Every operator is signed out once. Signing in again fixes it. If it repeats, tell a developer.
5. **You opened a second tab** without ticking Remember me. The session lives in the first tab only. Use the first tab, or tick **Remember me** on your own computer.

## 401 and 403 messages

- **401** means the server does not accept your session: expired, invalid or removed. The console clears everything and sends you to the login page with a message.
- **403** means you are signed in but not allowed to do that action. The console shows the server's message and does not log you out. See [Roles and permissions](kb:roles-and-permissions).
- **429** (too many attempts) appears when one internet address makes too many sign-in or code requests or fails operator checks too often. Wait a minute and try again.

## Failed to load and CORS errors

**Symptom:** many pages show "Failed to load", empty tables with a Try again button, or the browser's developer console mentions CORS.

- **The server is down or unreachable.** Try again in a minute; check your own connection; ask a developer whether the service is running.
- **CORS:** if the backend limits which web addresses may call it, the console's own address must be on its allowed list (the setting is `CORS_ALLOWED_ORIGINS`, with the exact address including `https://`). A developer has to add it. This often appears right after the console is moved to a new address.
- **Mixed content:** a console served over https cannot call a server address that starts with http.

## Numbers look old or do not match

Only the chat count updates by itself. Everything else loads when the page opens, so click the page's **Refresh** button or reload. Pages also use different filters and periods (Dashboard revenue is for the current month), so compare like with like.

## Chat not updating

The chat panel shows **Live** when the connection works and **Reconnecting** when it does not. While reconnecting, the console falls back to checking for new messages every 20 seconds and checks the count every minute even when it is connected. Reload the page if it stays on Reconnecting. If you hear no sound: the sound may be muted (the Live Chat page has the mute control), the browser may be blocking sound until you click anywhere on the page, or browser notifications may not be allowed (the Live Chat page has a button to allow them). The browser tab title shows the unread count in brackets, for example "(3)".

## Bell dot stuck

The dot is on while the total of three counts is above zero: unread chats, account deletion requests waiting, and the number of suggestions on the Suggestions list. The suggestions count is the size of the whole list, not the unread ones, so it stays above zero as long as any suggestion exists. This is a known limitation, not a fault of your computer. Open the bell to see which row causes the dot.

## Export does nothing

Export to Excel or PDF uses two small libraries that load from the internet. If a firewall blocks them, the page says the export library did not load. Check your connection or ask the network team to allow the address of those libraries. Export always contains the rows currently shown after your filters.

## Wrong environment

The console talks to the server named in `js/config.js` (the line that sets `API_BASE`). Nothing on screen shows which server that is; a commented-out line in the same file shows how developers point it at a local test server. If the data does not look like production, open the browser's developer tools (Network tab) and look at the address of the requests.

## Common questions

### Who do I tell when the whole console is down?
Tell a developer or your team lead and say that every page fails, not just one.

### Why does Export not include everyone?
It exports only the rows shown after your search and filters.

### I changed a plan and the app still shows the old price. Why?
Customers' apps load the plan list when they open the plan screen. Ask them to close and reopen it.

### Does a hard refresh sign me out?
No. Ctrl+F5 reloads the files only.
