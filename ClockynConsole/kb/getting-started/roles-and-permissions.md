---
title: Roles and permissions
summary: The two console roles (super admin and Staff operator), which actions only a super admin can do, how roles are set, and why a console operator is not a company Admin in the Clockyn app.
category: Getting started
audience: all
tags: roles, permissions, super admin, role 1, role 2, staff, operator, admin, access, cannot see button, read only, who can, add user, authorization
page: settings.html
updated: 2026-11-15
related: signing-in, settings-page, referrals-c2c, referrals-b2c, video-hub, faq-hub
---

Everyone who signs in to the Clockyn Console is an **operator**, and every operator has one of two roles: **super admin** (role 1) or **Staff** (role 2). Most of the console works the same for both. A short list of sensitive actions is reserved for super admins. This page lists them exactly, explains how roles are set and warns about a common mix-up with the word "Admin".

## Console operator or company Admin?

These are two different things.

- A **console operator** works for Clockyn and signs in to this console. Operators are stored in a separate list that only the console uses. Their roles are **super admin** and **Staff**.
- A **company Admin** is the owner of a customer company and uses the Clockyn app. In the app, role 1 is Admin (the organisation owner), role 2 is Manager and role 3 is Staff (an employee). You see these roles on the Users page of the console and in its role filter.

The numbers happen to overlap: role 1 in the console means super admin, role 1 in the app means company Admin. They are different lists of people. A company Admin can never sign in to the console, and an operator is not a member of any customer company.

Labels also differ a little. The name box in the top right and the sidebar footer show **Admin** for a super admin and **Staff** for role 2. The user table under Settings shows **Super Admin** and **Staff**. All of them mean the same two roles.

## Who can do what

Who can do this: this table is the rule on both the page (the buttons) and the server (the real check).

| Area | Any operator | Super admin only |
| --- | --- | --- |
| Reading pages, searching, filtering, exporting | Yes | Yes |
| Dashboard, Organizations, Users, Payments | View, search, export, and the actions on the page | Same |
| Subscriptions: plans | Add, edit and delete plans | Same |
| Coupons | Add, edit and delete | Same |
| Live Chat, Ticketing and Bugs, Suggestions | Read and reply | Same |
| Account deletion requests: delete an account | Allowed (asks for an extra e-mail code) | Same |
| Organizations: edit, activate, deactivate or delete an organisation | Allowed (deleting asks for an extra e-mail code) | Same |
| Users: delete a manager or employee | Allowed (the browser asks you to confirm) | Same |
| Referrals: change the C2C discount percent | No | Yes |
| Referrals: void a reward | No | Yes |
| Referrals: create or edit a B2C promoter code | No | Yes |
| Referrals: record or void a promoter payout | No | Yes |
| Video Hub: upload, edit or delete a guide video | No | Yes |
| FAQ Hub: add, edit, rename a category or delete an FAQ | No | Yes |
| Settings: add, edit or delete console users | No | Yes |
| Settings: see the Users list | No (the panel is hidden) | Yes |
| Change your own display name | Yes | Yes |

Two further actions exist only as server operations for the developers and have no screen: purging old clickstream data, and permanently purging staff who were deleted long ago. Both need a super admin or the operator API key.

> **Warning** Plans, coupons and deleting organisations can change what customers pay or lose their data, yet any operator can do them. Treat these screens with care even if you are not a super admin.

## What "read only" means

If you are a Staff operator you see the same pages as a super admin. The buttons that need super admin rights (New code, Edit, Void, Upload video, Add FAQ, Add User and similar) are simply not shown. If you somehow call one anyway, the server refuses it with the message "Only role_id=1 admins can perform this action" and nothing changes. Your session stays active.

## How roles are set and where operators live

Operators are stored in the operators table of the database, also called the operator login table (columns: e-mail, name, role id and an older phone number). A super admin manages them in **Settings, Users**:

1. Open Settings. The **Users** card ("People who can sign in to this console") lists every operator.
2. Click **Add User**, enter the **Name** and **Email** and pick the **Role**: **Super Admin** or **Staff**. The default is Staff.
3. Click **Save**. The person can now sign in with a code sent to that e-mail.

Use the pencil icon to edit a person and the bin icon to delete one. Deleting asks you to confirm and warns that the person will no longer be able to sign in.

The server looks you up in this table on every request and uses the role stored there. So:

- Deleting an operator takes effect at once: their next action sends them to the login page.
- Changing a role takes effect at once on the server. The buttons on the person's screen update the next time they sign in, but the server already enforces the new role in the meantime.

## What can go wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| A button you were told about is missing | Your role is Staff, or you signed in before your role was changed | Ask a super admin to check your role, then sign out and in again |
| "Only role_id=1 admins can perform this action" | You tried a super admin action | Ask a super admin to do it |
| The Users card on Settings is missing | The card is hidden for Staff | Normal for role 2 |
| You deleted your own console user by mistake | There is no guard against deleting yourself | Another super admin must add you again |
| Nobody can add users | No super admin remains | A developer has to add a super admin directly in the database |

## Common questions

### Why can I not see the Void button on a referral reward?
Voiding is a super admin action. If your role is Staff the button is not shown. Ask a super admin.

### Can a Staff operator change a customer's plan?
The console has no screen that buys a plan for a customer. What any operator can do is edit the plan catalogue (price, duration, free months). See [Subscriptions and plans](kb:subscriptions-and-plans).

### How many super admins should we have?
At least two, so one can fix the other's access, and no more than needed.

### Is a company Admin able to sign in here?
No. Company Admins use the Clockyn app. Only people added under Settings, Users can use the console.

