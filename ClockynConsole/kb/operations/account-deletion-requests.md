---
title: Account deletion requests (review and delete an owner's account)
summary: How a company owner asks for deletion in the app, how an operator handles the request in the console, what the deletion removes for good, and a checklist to run first.
category: Operations
audience: operator
tags: account deletion, delete account, deletion request, privacy, data removal, right to erasure, owner, one-time code, otp, anonymise, retention, irreversible
page: delete_account.html
updated: 2026-11-16
related: users, organizations, roles-and-permissions, troubleshooting, security-settings
---

An account deletion request is a company owner asking Clockyn to erase their account and all company data. The owner sends it from the app. It then waits in the console, on the Account Deletion Requests page, until an operator deletes the account. Any operator can do this, and each deletion is confirmed with a one-time code sent to the operator's own login email.

> **Warning** Deleting an account is permanent. The console has no undo and no recycle bin. Run the checklist below before every deletion.

## How the owner sends a request

1. In the Clockyn app, the owner opens **More options**, then the **Privacy Policy** page, and taps **Request Account Deletion**.
2. The app asks them to confirm: "Your deletion request will be sent to the admin. Once reviewed, all your data will be permanently deleted."
3. The app shows "Deletion request submitted. An admin will process it." and signs the owner out a moment later.

Only the owner can send a request for their own account. If a request is already waiting, sending it again changes nothing; the owner is told it was already submitted. The request itself only adds a pending line to the list. Nothing is removed until an operator deletes it.

## Where you see requests

- **Users page:** a red badge on the "Account deletion requests" row shows the count, and the Users item in the left menu shows the same number.
- **Account Deletion Requests page** (open it from that row): the table "Pending deletion requests" has Organization, Mobile, Email, Requested At and an action button **Delete Account**. Only pending requests are listed. The newest request is at the top, even though the page subtitle says oldest are handled first.

There is no Reject button and no way to mark a request as declined or on hold. A request leaves the list only when its account is deleted.

## Delete an account

Who can do this: any operator. You need access to your own login email.

1. On the requests page, click **Delete Account** in the row. The console emails a 6-digit code to your login email. If it says "Session expired", sign in again first.
2. In the "Confirm account deletion" dialog, enter the code under "Verification code".
3. Click **Delete Account**. The console first checks the code ("Invalid or expired OTP." if it is wrong), then deletes.
4. You see "Account deleted" and the list reloads without that row.

## What is deleted

By default the backend does a **hard delete**. For each company owned by the requester it removes:

- all the company's staff and managers, with their attendance, payroll and pay slips, travel and odometer records, requests and leave dates, wages and incentives, and manager permissions;
- the company's leads, shifts, holidays, activity log, additional company details, departments and branches, and the company record itself;
- the owner's own user record and additional details;
- the company's Refer & Earn data: its referral code (so the code stops working) and every reward it holds. A reward that was waiting for this company's first payment is voided. A friend's reward that was already earned is kept, and so are the promoter (B2C) referral records, because they carry the promoter's commission.

Afterwards the pending request is marked as deleted, and the stored face data of the owner and staff is removed (a best-effort step; failures are only logged). Orders, payments, invoices and subscription records are not in the deletion list, so billing history stays.

A maintainer can switch the backend to **anonymise** mode (setting ACCOUNT_DELETE_ANONYMISE, off by default). In that mode rows stay but personal data is blanked: users become "Deleted user" with placeholder phone and email, the company becomes "Deleted company", leads lose their customer contact details, and punch photos and face data are removed. Billing records stay untouched. The company's referral code and rewards are deleted in this mode too, so an anonymised company cannot remain a valid referrer. Ask a maintainer which mode is on before you describe it to a customer.

## Staff removed by a company admin

When a company admin removes a staff member in the app, the person is only marked deleted at first. After a retention period (30 days by default) a backend purge removes them, or anonymises them if they have payroll history. A super admin starts that purge through the backend; the console has no button for it.

## Checklist before you delete

1. The request really came from the owner. Compare the Mobile and Email with the company on [Organizations](kb:organizations).
2. The company has no open billing question, refund or invoice request. Billing records stay, but you cannot reconstruct company data later.
3. The owner knows the data cannot be restored, and you have noted any legal or finance record you must keep.
4. You are deleting the right row: check the organization name, mobile and email in the row.

## What can go wrong

- **No email code arrives:** the console uses the email you signed in with. Check spam, then press Delete Account again for a new code.
- **"Invalid or expired OTP.":** the code is wrong or too old. Close the dialog and start again.
- **"Deletion failed." or "Failed to delete account":** the deletion is done in one transaction, so nothing was removed. Try once more and tell a maintainer if it repeats.
- **"not authenticated" (error 401):** the deletion endpoint is an app route, not an operator route. When the backend demands app access tokens (REQUIRE_AUTH on), the console cannot call it. A maintainer must fix this before you can delete.

## Common questions

### Can I reject a request or put it on hold?
Not in the console. A request stays in the list until the account is deleted.

### What does the owner see after requesting?
The app confirms the request and signs them out. The company data stays in place until you delete it.

### Does deleting remove invoices and payments?
No. Orders, payments, invoices and subscriptions are not part of the deletion.

### Why is the newest request at the top?
The list is sorted newest first. The subtitle that says oldest first does not match.

### Who gets the verification code?
The operator who is deleting, at their own login email. It is not sent to the customer.

### Can the console restore a deleted account?
No. Only a database backup could, and that needs a maintainer.
