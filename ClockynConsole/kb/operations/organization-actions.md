---
title: Register, deactivate, activate and delete organizations
summary: How to register a company on its owner's behalf and how to deactivate, reactivate or delete a company from the Organizations page, including what each action really does.
category: Operations
audience: operator
tags: register company, add organization, deactivate, activate, delete organization, switch off company, reactivate, edit company, otp, soft delete, remove company
page: organizations.html
updated: 2026-11-15
related: organizations, account-deletion-requests, roles-and-permissions, users
---

These are the actions that change a company from the Organizations page: register one for a customer, switch it off or on, and delete it. Any operator can do all of them; none is limited to super admins. Reading the list, filtering and exporting are in [Organizations](kb:organizations).

## Register a company on someone's behalf

Who can do this: any operator. Use it when a customer cannot register in the app.

1. Click **Add organization**.
2. Fill Company name and Company address (required), and optionally state, district, pincode and GST number.
3. Under Contact, enter the Mobile number and click **Get OTP**; the code goes to that number. Enter it and click **Verify**. Do the same for the Email ID. Both must show Verified.
4. Under Structure, enter at least one Branch (use **Add branch** for more). Departments are optional; if you add none, the department "General" is created.
5. Optionally upload a logo, or open **Add more details** for PAN, website, CIN, TAN, MSME and business category.
6. Click **Register Organization**. The list reloads.

The company name is also used as the owner's name on the new account.

## Deactivate or activate a company

Who can do this: any operator. You are asked to confirm, and the button uses your signed-in email as the "changed by" name.

1. Find the row and click **Deactivate** (or **Activate**).
2. Confirm in the browser prompt.

Deactivate marks the company and all of its users inactive. Managers and employees who are signed in are signed out. Each change is recorded with the operator's email.

> **Warning** **Activate** switches on every user of the company and its owner, including people who were switched off or removed earlier. Check with the customer before reactivating a company that had staff removed.

## Delete a company

Who can do this: any operator. Deleting needs a one-time code sent to your own login email.

1. Click **Delete** on the row. An OTP is sent to your email.
2. Enter the 6-digit code in "Confirm delete" and click **Delete**.

> **Warning** The confirmation says it cannot be undone. In practice the console marks the company inactive and every user of it as deleted (status 2); it does not erase rows. After you refresh, the company can reappear in the list as inactive. Permanent removal of an owner's data is done through [account deletion requests](kb:account-deletion-requests).

## Edit company details

The backend can update a company's name, address, GST, state, district, pincode and the owner's mobile and email, and the page contains an Edit dialog. At the moment no button on the page opens that dialog, so editing is not available from the console. Ask a maintainer if a customer needs a correction.

## What can go wrong

- **Get OTP says failed:** the mobile must be 10 digits and the email must contain "@"; otherwise the backend message is shown.
- **Deleted company still listed:** expected, see the Delete warning above.
- **A reactivated company has staff back that you removed:** Activate switches on every user; see the Activate warning above.

## Common questions

### Does deactivating stop billing?
No. It only changes user and company status. The subscription is untouched.

### Can I see which operator deactivated a company?
Each change is stored with the operator's email (first 20 characters). It is not shown in the console.

### Can I undo a delete?
Not from the console. The company and its users are marked inactive or deleted, but no rows are erased, so ask a developer if a company was deleted by mistake.

### Why can I not edit a company's name or address?
The Edit dialog exists but no button opens it yet. Ask a maintainer to make the correction.

### A customer cannot register in the app. What can I do?
Register the company for them with **Add organization**, as described above, then tell them to sign in with the same mobile number or email.
