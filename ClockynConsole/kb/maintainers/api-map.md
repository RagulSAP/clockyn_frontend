---
title: Console API map (page to endpoint to backend to tables)
summary: Table of every backend endpoint each console page calls, who may call it, the backend function behind it and the main database tables.
category: Maintainers
audience: maintainer
tags: api, endpoints, routes, backend, tables, gen-dashboard, require_operator, require_operator_super, map, reference
updated: 2026-11-15
related: how-the-console-works, security-settings, adding-a-page
---

Use this map to find which backend code and tables a console page depends on. Routes live in `C:\POC\clockyn_backend\router\` (mostly `gen_dashboard.py`, plus `gen_plans.py`, `gen_live_chat.py`, `company.py`, `support.py`, `auth.py` and `utils\email.py` for invoices). Functions are in `core_functions\`. "The operators table" below is the table of platform operators (their e-mail, name and role) that the operator login and the guard read.

**Guard column:** `op` = any operator (the router-wide `require_operator`), `super` = super admin only (`require_operator_super`, role 1), `role1` = role 1 always checked, `app` = an app route that is not an operator route, `public` = no login. While `OPERATOR_ENFORCE` is off, `op` routes stay open as they were before; `super` and `role1` routes always demand a login. See [security-settings](kb:security-settings).

## Every page (shell)

| Endpoint | Guard | Function and tables |
| --- | --- | --- |
| `GET /gen-dashboard/me?email=` | op | `get_admin_profile`: the operators table |
| `GET /company/deletion-requests` | op | `get_deletion_requests`: `account_deletion_requests` (sidebar badge) |
| `GET /company/suggest-feature` | op | `get_suggestions`: `email_log`, `org_info` (sidebar badge) |
| `GET /gen-dashboard/live-chat/unread-count`, `WS /ws/support-ops` | op | `op_unread_count`: `live_chat_message` (chat badge) |

## Login (`login.html`) and Settings

| Endpoint | Guard | Function and tables |
| --- | --- | --- |
| `POST /auth/admin-login`, `POST /auth/admin-login/verify-otp` | public, rate limited | the operators table and `email_otp_verification`; issues the operator token |
| `GET/POST /auth/gen-admin-users`, `PUT/DELETE /auth/gen-admin-users/{email}` | role1 | the operators table (Settings, operator accounts) |
| `PUT /gen-dashboard/me` | op | `update_admin_profile`: the operators table |

## Operations pages

| Page | Endpoint | Guard | Function and tables |
| --- | --- | --- | --- |
| Dashboard | `GET /gen-dashboard/stats`, `recent-orgs`, `plan-breakdown`, `monthly-revenue`, `active-orgs` | op | `get_super_admin_stats`, `get_recent_orgs`, `get_plan_breakdown`, `get_monthly_revenue`, `get_active_orgs_today`: `org_info`, `users`, `subscription`, `gen_payments`, `gen_plans`, `attendance` |
| Organizations | `GET /gen-dashboard/organizations` | op | `get_all_organizations`: `org_info`, `users`, `subscription`, `free_trial`, `gen_plans` |
| Organizations | `PUT /gen-dashboard/organizations/{id}`, `POST .../activate`, `POST .../deactivate`, `DELETE .../{id}` | op | `update_org_details`, `update_org_status`: `org_info`, `users` |
| Organizations (add) | `POST /auth/generate-otp`, `validate-otp`, `register-company`, `upload-org-logo/{id}` | public, public, public, app (admin role) | registration functions in `auth_function.py` |
| Org analytics | `GET /gen-dashboard/org-analytics/{id}`, `org/{id}/info`, `org/{id}/employees`, `org/{id}/attendance/{date}` | op | `get_org_analytics`, `get_org_info`, `get_org_employees`, `get_org_attendance_by_date`: `users`, `attendance`, `org_info`, `subscription` |
| Users | `GET /gen-dashboard/users`, `users/{id}/attendance-range` | op | `get_all_users`, `get_user_attendance_range`: `users`, `org_info`, `attendance` |
| Users | `DELETE /gen-dashboard/users/{id}` | none found | The Delete user button calls it, but no such route exists in `gen_dashboard.py` (verified by search), so it answers "Not Found" |
| Account deletion | `GET /company/deletion-requests`, `DELETE /company/delete-account/{user_id}` | op, app (owner only) | `get_deletion_requests`, `delete_user_account`: `account_deletion_requests` and many related data tables |

## Billing and growth pages

| Page | Endpoint | Guard | Function and tables |
| --- | --- | --- | --- |
| Subscriptions | `GET /gen-dashboard/org-subscriptions` | op | `get_org_subscriptions_list`: `subscription`, `gen_invoices`, `referral_reward`, `referral`, `b2c_partner` |
| Subscriptions | `GET /plans/all`, `POST /plans/`, `PUT/DELETE /plans/{id}` | op | `list_plans`, `create_plan`, `update_plan`, `delete_plan`: `gen_plans` |
| Payments | `GET /gen-dashboard/recent-payments`, `GET /invoice/bulk-download` | op | `get_recent_payments`: `gen_payments`, `gen_orders`; invoice zip in `utils/email.py` |
| Subscriptions, Payments | `GET /invoice/download` | public signed link | invoice PDF |
| Coupons | `GET/POST /plans/coupons`, `PUT/DELETE /plans/coupons/{id}` | op | `gen_coupons` |
| Referrals (C2C) | `GET /gen-dashboard/referrals`, `GET /gen-dashboard/referrals/config` | op | `operator_overview`, `get_config`: `referral`, `referral_reward`, `referral_config` |
| Referrals (C2C) | `PUT /referrals/config`, `POST /referrals/rewards/{id}/void` | super | `set_c2c_percent`, `void_reward` |
| Referrals (B2C) | `GET /referrals/b2c`, `GET /referrals/b2c/{id}` | op | `list_partners`, `partner_detail`: `b2c_partner`, `referral`, `gen_orders`, `b2c_payout` |
| Referrals (B2C) | `POST /referrals/b2c`, `PUT /referrals/b2c/{id}`, `POST .../payouts`, `POST .../payouts/{pid}/void` | super | `create_partner`, `update_partner`, `record_payout`, `void_payout` |

## Support pages

| Page | Endpoint | Guard | Function and tables |
| --- | --- | --- | --- |
| Suggestions | `GET /company/suggest-feature/with-replies`, `POST /company/suggest-feature/{id}/reply` | op | `suggestion_replies`, `email_log` |
| Tickets | `GET /support/requests/all`, `PUT /support/update/{id}` | op | `get_all_support_requests`, `update_support_request`: `admin_subject_request`, `ticket_replies` |
| Tickets | `POST /support/{id}/reply` | app (not an operator route) | `reply_to_ticket` |
| Live Chat | `/gen-dashboard/live-chat/threads` (list, messages, send, file, delete, read, status) | op | `op_*` functions: `live_chat_thread`, `live_chat_message` |
| Video Hub | `GET /gen-dashboard/support-videos`, `support-video-views` | op | `support_video`, `support_video_view` |
| Video Hub | `POST .../support-videos/upload-url`, `POST`, `PUT`, `DELETE .../support-videos/{id}` | super | `support_video` |
| FAQ Hub | `GET /gen-dashboard/faqs` | op | `support_faq` |
| FAQ Hub | `POST`, `PUT`, `DELETE /gen-dashboard/faqs` | super | `create_faq`, `update_faq`, `delete_faq` |
| Clickstream | `GET /gen-dashboard/clickstream/summary`, `events` | op | `clickstream_summary`, `clickstream_events`: `app_event` |
| none | `POST /gen-dashboard/clickstream/purge` | super | `purge_clickstream`: no page calls it yet |

## What can go wrong

- **A button answers "Not Found" or 405:** check this map; the backend route may not exist (see the Users delete row).
- **403 on a save:** the route is `super` and the signed-in operator has role 2.
- **401 on an app route under `REQUIRE_AUTH`:** the console sends an operator token, which app routes reject. See [security-settings](kb:security-settings).

## Common questions

### How do I find which table a screen reads?
Find the page above, then open the named function in `core_functions` and read its SQL.

### Why are plans under `/plans` but referrals under `/gen-dashboard`?
Plan and coupon administration shares the router that serves the mobile app's plan reads (`router/gen_plans.py`). Newer operator features were added under `/gen-dashboard`.

### Where is the operator guard decided?
In `core_functions/auth_policy.py` (the `OPERATOR_RULES` list) and `core_functions/operator_auth.py`.
