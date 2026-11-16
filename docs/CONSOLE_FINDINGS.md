# Console and backend findings from writing the ClockynConsole Knowledge Base (2026-11-15)

Found by the agents that documented each page. They documented each item as it behaves TODAY and fixed nothing. Ranked by what matters most. "Verified" means read in the code; nothing here was run against a live system.

## Security
1. **RESOLVED 2026-11-16 (the ticket feature was removed; Live Chat replaces it).** ~~Ticket replies are not guarded.~~ `POST /support/{request_id}/reply` has no operator guard and the caller sets `is_admin` in the body: anyone who can call the API can post as "Admin" on any ticket. The app uses the same route, so the fix must tell the two senders apart.
2. **Two console actions use app routes** (a third, `POST /support/{id}/reply`, was removed on 2026-11-16 with the ticket feature), so with `REQUIRE_AUTH=1` they answer 401 and the console treats a 401 as the end of the session (the operator is signed out): `DELETE /company/delete-account/{user_id}`, `POST /auth/upload-org-logo/{id}`. Untested: check on staging before turning `REQUIRE_AUTH` on.
3. **Plan and coupon create/edit/delete are open to any operator**, while referral percent, payouts, voids and user management are super-admin only.
4. **No safety net for the last super admin:** the console lets you delete your own row or the last super admin.
5. **Any operator can delete live-chat messages**, which also removes them from the company's app.
6. **Reads show personal data to any operator** (promoter phone/e-mail/address, punch photos) while `OPERATOR_ENFORCE` is off (the default). Set `OPERATOR_ENFORCE=1` in production.

## Things that do not work
7. **Users page "Delete user" always fails:** `DELETE /gen-dashboard/users/{id}` has no backend route.
8. **Organizations page: Edit dialog has no button that opens it** (the dialog and endpoint exist).
9. **Users page "Today" column always shows a dash** (the users list carries no punch data).
10. **Deletion requests:** the page says oldest first but the backend returns newest first, and there is no Reject action.
11. **Clickstream purge has no button** (only a super-admin API call); the page offers 7/30/90 days though the backend allows 180.
12. **Suggestion replies** say "(shown to the user in the app)" but the app has no screen that reads them.

## Numbers that mislead
13. **Failed payments never reach the Payments page** (the backend records a payment only on success): the Failed tiles are always 0 and Success Rate always 100%.
14. **`payment_flag` is invisible in the console** (`AMOUNT_MISMATCH` stops a plan activating): add a column or filter.
15. **Active coupons tile ignores end dates;** coupon names are not unique; a 0% coupon is accepted then rejected at checkout.
16. **Payments "Pending" tile also counts organisations whose plan expired.**
17. **Dashboard vs Organizations "Active Plans"** differ (stored status vs end-date corrected).
18. **Multiple punch sessions in a day list a person twice**, inflating Present/Absent and "days with attendance".
19. **Suggestions badge/bell never reach zero** (nothing tracks "read"). (Tickets, which raised no alert at all, were removed on 2026-11-16.)
20. **Video Views loads only the 2000 most recent views** and every total is based on that.
21. **"Today" on the org analytics and users attendance dialogs uses the browser's UTC date,** wrong just after midnight in India.

## Behaviour to know
22. Activating a company re-activates every user including staff removed earlier; deleting a company is a soft delete that can reappear after refresh.
23. Plan credit on a plan change uses the plan's CURRENT price, not what the customer paid.
24. Limits that disagree: live chat page blocks files over 10 MB, the backend allows 25 MB; the 500 MB video limit exists only in the page.
25. Opening a second console tab without "Remember me" can sign you out; the Settings role hint understates super-admin rights; role labels differ ("Admin" vs "Super Admin").
26. A stale comment in `core_functions/auth_policy.py` says operator sign-in is "phone + SMS code"; it e-mails a code.
