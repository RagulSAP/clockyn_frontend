---
title: Console security settings and rollout order
summary: The backend settings that protect the operator console routes, the rate limits, which routes carry personal data, recommended production values and the safe rollout order.
category: Maintainers
audience: maintainer
tags: security, operator, enforce, legacy, x-admin-id, api key, token secret, require_auth, rate limit, personal data, rollout, production, 401, 403
updated: 2026-11-15
related: how-the-console-works, deploying-the-console, api-map
---

The console talks to operator routes on the backend. How strictly those routes check the caller depends on a few environment settings. The defaults keep old behaviour so a rollout does not break anything, which also means a fresh deployment is not yet fully locked down. Production should use the recommended values below.

## How an operator is checked

The guard is `core_functions/operator_auth.py`. For each operator route it accepts, in this order:

1. **`X-Operator-Key` header** equal to `OPERATOR_API_KEY`. Meant for scripts and emergencies, never for the console's JavaScript. Key sent but not configured: 503. Wrong key: 403.
2. **Operator session token**: `Authorization: Bearer <token>`, issued by `POST /auth/admin-login/verify-otp` after the e-mailed code. The signature and expiry are verified and the operator is looked up in the operators table on every request, so removing an operator or changing the role takes effect at once. Expired: 401 "Token expired". Invalid: 401 "Not authenticated".
3. **Legacy header** `x-admin-id: <e-mail or phone>` that matches a row of the operators table. It proves nothing beyond knowing that address, so it exists only for the rollout.

An app user's token never works on operator routes, and an operator token is not accepted by app routes.

## The settings

| Setting | Meaning | Recommended in production |
| --- | --- | --- |
| `AUTH_TOKEN_SECRET` | Signing secret (at least 32 characters). The operator token key is derived from it. Unset or shorter: no operator token is issued. Changing it signs everyone out, in the app and the console. | Set, kept in the secrets store, never changed casually. |
| `OPERATOR_TOKEN_TTL_HOURS` | Operator token lifetime. Default 12, allowed 1 to 72. | Default. |
| `OPERATOR_ENFORCE` | `1`: operator routes demand a credential. `0`: never. Unset: follows `REQUIRE_AUTH`. | `1`. |
| `OPERATOR_LEGACY_ADMIN_ID` | `0` refuses the legacy header and the `?admin_id=` socket form. Default `1` accepts them. | `0`, after the console is deployed. |
| `OPERATOR_API_KEY` | Shared secret of at least 24 characters. Shorter counts as not configured. | Set for scripts only. |
| `REQUIRE_AUTH` | `1`: every non-public app route needs an app token. | `1`, after the app build that sends tokens is released. |
| `CORS_ALLOWED_ORIGINS` | Allowed web origins. Unset or `*` allows all. | The console's exact origin. |

While enforcement is off, operator routes that were open before stay open. Routes marked super admin and the operator account routes always demand a login.

## Rate limits that protect sign-in

Limits are in memory and per backend instance. `OTP_GENERATE` (20 per hour per IP) covers asking for a code, `AUTH_LOGIN` (30 per minute per IP) covers checking it, and `OPERATOR_FAIL` (20 per minute per IP) counts failed operator credentials: beyond it every request from that IP gets 429, even a correct one. A sign-in code is valid for five minutes and five wrong tries lock it until it expires.

## The start-up warnings

When the backend starts it logs `SECURITY:` warnings for each risky setting: `REQUIRE_AUTH` off, operator routes not enforced, or the legacy header still accepted. If enforcement is on with the legacy header off but neither a token secret nor a key is configured, every operator request is refused with 503. Check the logs after each deploy.

## Routes that carry personal data

- **Promoter contact details** (phone, e-mail, address): `GET /gen-dashboard/referrals/b2c` and `GET /gen-dashboard/referrals/b2c/{id}`.
- **User lists** with names, e-mails and phone numbers: `GET /gen-dashboard/users` and `GET /gen-dashboard/org/{id}/employees`.
- **Punch photos**: attendance endpoints return fresh pre-signed S3 links that the Users page opens.
- **Live chat** messages and attachments, **tickets**, **deletion requests** and **invoices**.

These are `op` routes, which are open to anyone while `OPERATOR_ENFORCE` is off. Turn enforcement on before real data is exposed.

## Recommended rollout order

1. Release the backend with none of `REQUIRE_AUTH`, `OPERATOR_ENFORCE` and `OPERATOR_LEGACY_ADMIN_ID` set. Check the logs for the `SECURITY:` lines.
2. Publish the console, press `Ctrl+F5`, sign in with the e-mailed code and open a few pages.
3. Release the new app build and raise the minimum supported version, so old builds update.
4. Test on staging with all three settings and a real phone build.
5. In production set `REQUIRE_AUTH=1`, `OPERATOR_ENFORCE=1` and `OPERATOR_LEGACY_ADMIN_ID=0`, then sign in to the app and console and open chat and a report.

## Known gaps to verify before turning `REQUIRE_AUTH` on

From reading the code (not tested on staging): three actions the console triggers are app routes, not operator routes. They are `DELETE /company/delete-account/{user_id}` (Account deletion page), `POST /support/{id}/reply` (Tickets reply) and `POST /auth/upload-org-logo/{id}` (adding an organisation's logo). With `REQUIRE_AUTH=1` the backend expects an app token on them, the console sends an operator token, the answer is 401, and the console treats any 401 as the end of the session and signs the operator out. Test these three on staging first, and give them operator routes if they fail.

## What can go wrong

- **Signed out after one action:** a 401 from an app route, as above.
- **Every operator call answers 503:** enforcement is on, the legacy header is off, and no token secret or key is set.
- **Everything answers 429 for one office:** too many failed credentials from that IP in a minute. Wait and fix the credential.

## Common questions

### Can I put the operator key in the console?
No. Anything in the console's JavaScript is visible to every visitor.

### Does removing an operator log them out immediately?
Yes. The operator is looked up in the operators table on every request.

### Why are there two sign-in headers?
`Authorization: Bearer` is the secure one. `x-admin-id` is kept only so an older console keeps working during a rollout.
