---
title: Users (managers and employees across all organizations)
summary: How to search, filter and export users across companies, read their attendance and punch photos, and what the Users page cannot do.
category: Operations
audience: operator
tags: users, employees, managers, staff, search user, attendance, punch photo, export, role, status, delete user, deletion requests, emp id
page: users.html
updated: 2026-11-15
related: organizations, organization-analytics, account-deletion-requests, roles-and-permissions, glossary
---

The Users page lists the managers and employees of every organization in one table. Use it to find a person by name, phone, email or company, to check whether they are active, and to look at their recent attendance and punch photos. Any operator can open it. Company owners (admins) are not shown in the table.

## Page layout

1. **Account deletion requests** row at the top: a red badge such as "3 requests" and a link to [Account Deletion Requests](kb:account-deletion-requests). The same number appears as a badge next to Users in the left menu.
2. **Four tiles**: Total users, Admins, Managers, Employees.
3. **All users** table with filters, and an export button.

## The tiles

All four tiles count every user the backend returns, including owners. So "Total users" can be larger than the number in the table's badge ("All users" counts only managers and employees), because owners are hidden from the table. Admins means company owners. Managers are team leads (role 2) and Employees are staff (role 3).

## The table

| Column | Meaning |
|---|---|
| User | Initials, name and "ID:" followed by the employee id. Clicking the avatar or name opens attendance. |
| Contact | Email and mobile. A dash means none stored. |
| Organization | The company, with department and branch underneath. |
| Role | Manager or Employee. |
| Status | **Active** (status 1) or **Inactive** (anything else, including removed users). |
| Today | See the note below. |
| Joined | The date the user record was created. |
| Actions | A trash button, see "What the page cannot do". |

> **Note** The Today column is meant to show "In 09:12" or "Absent", but the users list does not include punch data yet, so it currently shows a dash for everyone. Use the attendance dialog instead.

## Search and filter

Who can do this: any operator.

1. Type in the top search box. It matches name, email, mobile, organization, employee ID, department, branch and role name.
2. Choose a Role (All roles, Admin, Manager, Employee) and a Status (All status, Active, Inactive).
3. Refresh in the top bar reloads the list and clears the filters.

The Role option "Admin" always gives an empty table because owners are not displayed.

## Check someone's attendance and punch photos

Who can do this: any operator.

1. Click the person's avatar or name.
2. The dialog opens with the last five days pre-filled. Change **From** and **To** and click **Apply** for another range.
3. Each card shows the date, hours worked, the punch-in and punch-out times (India time) and the two photos.
4. Click a photo to open it in a new browser tab.

The photos are temporary signed links created when you open the dialog (valid for 7 days). If a photo cannot be loaded the card shows "Unavailable". The summary line says "N day(s) with attendance", but it actually counts punch sessions, so a person with two sessions on one day gives two cards.

## Export

The export button creates an Excel or PDF of the filtered rows with Name, Emp ID, Email, Mobile, Organization, Department, Branch, Role, Status and Joined. The export is built from the filtered list before owners are hidden from the table, so it can contain company owners even though the table does not show them.

## What the page cannot do

The Actions column has a trash button labelled "Delete user" and a confirmation that says the deletion is permanent. At the moment it does not work: the backend has no endpoint for it, so the browser shows a message such as "Not Found" and nothing is deleted. Do not promise customers an individual user deletion from here. To remove an owner and their data, use [account deletion requests](kb:account-deletion-requests). Staff are removed by their own company admin in the app.

You also cannot edit a user, reset a password or change a role from this page.

## What can go wrong

- **"Couldn't load users":** the backend returned an error or could not be reached. Press Try again.
- **Attendance dialog says "No attendance records":** nothing was recorded in that range, or the dates are the wrong way round.
- **Photo shows "Unavailable":** the stored photo is missing or the signed link failed.

## Common questions

### Why can I not find a company owner here?
Owners are filtered out of the table. Find the company on [Organizations](kb:organizations) and read the owner's name, phone and email there.

### Why is Today always a dash?
The users list does not carry today's punch time. Open the attendance dialog for the person instead.

### What does Inactive mean?
The user's status is not Active. That covers staff switched off, removed users and everyone in a deactivated company. Inactive users cannot sign in.

### Why did Delete user fail?
The delete action is not connected to the backend yet.

### Does the export respect my filters?
Yes, it exports what the current search, role and status filters leave. It can include owners.
