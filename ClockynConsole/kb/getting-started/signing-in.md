---
title: Signing in to the console
summary: How an operator signs in with an e-mail code, how long a session lasts, what Remember me does, what happens when a session ends, and how to log out.
category: Getting started
audience: all
tags: login, sign in, otp, email code, one time code, password, session, remember me, timeout, expired, log out, logout, 401, 403, access
page: login.html
updated: 2026-11-15
related: roles-and-permissions, troubleshooting, settings-page
---

You sign in to the Clockyn Console with your e-mail address and a six-digit code that Clockyn e-mails to you. There is no password. Only e-mail addresses that a super admin has added to the console can sign in. This page explains each step, how long you stay signed in and what to do when something goes wrong.

## Sign in step by step

Who can do this: any operator whose e-mail address is on the console user list (Settings, Users).

1. Open the console. The login page shows the title **Welcome back** and an **Email** field.
2. Type your e-mail address. If you have signed in on this browser before, the field is already filled in.
3. Click **Send OTP**. The page changes to **Check your email**: "We sent a 6-digit code to ... It expires in 5 minutes." Your address is shown partly hidden (for example `a***@example.com`).
4. Open the e-mail and type the six digits into the six boxes. You can also paste the whole code into any box.
5. Optionally tick **Remember me** (see below).
6. Click **Verify OTP**. You land on the Dashboard.

If you mistyped the e-mail address, use the back button on the code step to return to the e-mail step.

## About the code

- The code has six digits and is valid for 5 minutes.
- The **Resend code** button is disabled for 30 seconds after each send. After that you can ask for a new code; the old one stops working.
- Five wrong codes lock the current code. You then have to wait until it expires (5 minutes) before a new one can be requested. The page shows "Too many incorrect OTP attempts."
- If your address is not on the list, the page shows "Email not found". Ask a super admin to add you.
- The server also limits how many codes and sign-in attempts one internet address can make per hour and per minute, so repeated attempts from one office network can be refused for a while.

## How long a session lasts

Two clocks run, and the shorter one wins.

| Clock | How long | What happens |
| --- | --- | --- |
| Idle timeout | 30 minutes without clicking, typing, moving the mouse or touching the screen | You are logged out and sent to the login page. The page checks once a minute. |
| Server session | Up to 12 hours by default (set by the developers, between 1 and 72 hours) | Once it has passed, the next page action sends you to the login page with the message "Your session expired. Please sign in again." |

**Remember me** switches off the 30-minute idle timeout and keeps your session in the browser's long-term storage, so it survives closing the tab and the browser. It does not extend the server session: after the server session length you still have to sign in again. Without Remember me, the session lives only in the current browser tab, so a second tab opened later may not be signed in; use the tab you signed in on, or tick Remember me on your own computer.

> **Tip** Do not tick Remember me on a shared or public computer.

## What you see when a session ends

- **"Your session expired. Please sign in again."** The server said your session is over (401), or the stored session time passed. Everything stored for the session is cleared and you are sent to the login page. Sign in again.
- **Logged out silently after being away.** That is the 30-minute idle timeout.
- **A message from the server saying you are not allowed to do something** (403, for example "Only role_id=1 admins can perform this action"). You are still signed in. Your role does not allow that action. See [Roles and permissions](kb:roles-and-permissions).
- **Removed from the console while signed in.** The server checks your account on every request, so if a super admin deletes you, your next action sends you back to the login page.

## Log out

Click the log-out icon at the bottom of the left menu (next to your name). A box asks **Log out of Clockyn?** and explains that you will need a code sent to your e-mail to sign in again. Choose **Log out** to confirm or **Stay signed in** to cancel. Logging out clears the session from the browser.

## Extra code checks for destructive actions

Deleting an account on the Account Deletion Requests page and deleting an organisation on the Organizations page ask for one more e-mail code, sent to your own address, before they go ahead. Type the six digits and confirm. This is a safety step and it works like the login code.

## What can go wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Email not found" | The address is not on the console user list, or it has a typo | Check the spelling; ask a super admin to add it under Settings, Users |
| "Invalid or expired OTP" | Wrong digits, or more than 5 minutes passed | Request a new code and use the newest e-mail |
| "Could not send OTP email. Please try again." | The e-mail service could not send the message | Wait a minute and try again; tell the developers if it keeps happening |
| No e-mail arrives | Spam folder, or the address is not the one the console has | Check spam; confirm the address with a super admin |
| "Network error. Please try again." | The browser could not reach the server | Check your connection; see [Troubleshooting](kb:troubleshooting) |
| Sent back to login again and again | The session is ending at once (clock wrong on your computer, or storage blocked) | See the session loop item in [Troubleshooting](kb:troubleshooting) |

## Common questions

### Why is there no password?
The console uses a one-time code sent to your e-mail, so there is no password to forget or leak. Anyone who can read your e-mail can sign in as you, so protect that mailbox.

### I signed in yesterday. Why am I asked again?
Either you did not tick Remember me and closed the tab, or the server session ended. Sessions last up to 12 hours by default.

### I changed my e-mail address. What now?
A super admin edits it under Settings, Users. The old sign-in stops working at once; sign in with the new address.

### What happens after a console update?
Sometimes an update changes how the session is stored. If so, you are sent to the login page once and sign in again. That is expected.
