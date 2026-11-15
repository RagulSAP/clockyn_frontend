---
title: Settings page
summary: Every section of the Settings page (profile, light or dark theme, console users), who can use each, what saving does and the mistakes to avoid when adding or deleting users.
category: Reference
audience: all
tags: settings, profile, display name, theme, dark mode, light mode, users, add user, edit user, delete user, console users, operators, super admin, role
page: settings.html
updated: 2026-11-15
related: roles-and-permissions, signing-in, console-tour
---

The Settings page has three parts: **My Profile**, **Appearance** and **Users**. The first two are for everyone. The Users card, where people are added to and removed from the console, is for super admins. Settings is the only page where you manage who can sign in to the console.

## My Profile

Who can do this: any operator.

The card shows your initials in a circle, your name, a role badge (**Admin** for a super admin, **Staff** for role 2) and your e-mail address. The e-mail address is read only here. Below it is one field, **Display name**.

To change your display name:

1. Type the new name in **Display name**.
2. Click **Save Name**.
3. A green message "Name updated successfully." appears for about three seconds and your name changes in the top bar, the left menu and the card.

If the field is empty the page says "Name cannot be empty." and nothing is saved. A network or server problem shows "Network error. Try again." or the server's message in red. Your display name is also stored as the sender name of the replies you send in Live Chat, so use a name your colleagues recognise.

## Appearance

Who can do this: any operator. It affects this browser only.

Choose how the console looks on the device you are using: **Light**, **Dark** or **System** (follow the setting of the computer or phone). The change is applied at once, with a short colour fade, and is saved in the browser. It does not change what other people see and does not follow you to another computer. The moon or sun button in the top bar on every page switches between light and dark as a shortcut.

## Users (console users)

Who can do this: super admin only. For a Staff operator the whole card is hidden, and the server refuses the list even if asked.

The card is titled **Users** with the note "People who can sign in to this console" and a counter such as "4 users". The table has **Name**, **Email** and **Role**, plus an **Actions** column. Your own row has a **You** badge. Roles show as **Super Admin** (purple) or **Staff** (grey).

### Add a user

1. Click **Add User** at the top right of the page.
2. Enter **Name** and **Email**. The e-mail address is saved in lower case and must be the address that will receive the sign-in code.
3. Pick the **Role**: **Super Admin** or **Staff** (the default is Staff). The hint says Super Admins can add, edit and remove users and manage videos; they can also do the other super admin actions listed in [Roles and permissions](kb:roles-and-permissions).
4. Click **Save**.

The person can sign in straight away with a code sent to that address. Messages you may see: "Name is required.", "Enter a valid email address." and, from the server, "Email already exists".

### Edit a user

Click the pencil icon on the row, change the name, e-mail address or role and click **Save**. If you change an e-mail address, the old address stops working at once. If you change a role, the server applies it immediately; the person's screen shows or hides buttons after they sign in again.

### Delete a user

Click the bin icon. A box asks "Are you sure you want to delete ...? They will no longer be able to sign in to this console." Click **Delete** to confirm. The person is removed from the list and their next action sends them to the login page. Their past work (replies, payouts) remains.

> **Warning** The console does not stop you deleting your own row or the last super admin. If no super admin is left, a developer has to add one in the database.

## What can go wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| The Users card is missing | You are a Staff operator | Ask a super admin |
| The Add User button is missing but the card shows | Your screen still has an older role | Sign out and in again |
| "Email already exists" | The address is already a console user | Edit the existing row instead |
| "Only role_id=1 admins can perform this action" | Your role is not super admin | Ask a super admin |
| The new person says "Email not found" at sign-in | A typo in the e-mail address when adding | Edit the row and correct it |
| "Could not load users" with a Try again button | The server or network failed | Click Try again; see [Troubleshooting](kb:troubleshooting) |
| The Settings search box does nothing | It is a placeholder and does not filter anything | Use the cards below it |

## Common questions

### Can I change my role myself?
No. Only a super admin can change roles, and the Users card is where they do it.

### Can I change my e-mail address?
Not on your profile (it is read only). Ask a super admin to edit your row.

### Why does my role say Admin but the table says Super Admin?
They are the same role. The name box shows the role name sent by the server ("Admin") and the table uses "Super Admin". Do not confuse it with a company Admin in the Clockyn app.

### Is the theme the same on all my devices?
No. It is stored in the browser of each device.

### What happens to someone I delete who is signed in?
Nothing changes on their screen until their next action; then the server refuses it and they are sent to the login page.
