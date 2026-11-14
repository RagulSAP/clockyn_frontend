# REQUIRE_AUTH=1 rollout (security finding S-01)

Status: code is ready and tested; the switch itself (environment variable on the service) is the owner's.

## What changed (this round)

Most of the work was already in the code base (bearer token in the API client, 401 handling, `?token=` on the sockets, authenticated
downloads, the policy in `core_functions/auth_policy.py`). This round re-verified every call and closed the remaining gaps.

App (`C:\POC\clockyn_frontend`)
* `src/lib/realtime/socketCore.ts`: a socket the server refuses with close code 4401 is no longer re-opened with the same
  token (before: a 1 s .. 30 s backoff loop against the server until a 401 on a normal request signed the user out). A later
  reconnect (foreground) happens only when the session holds a different token. Tests in `lib/realtime/__tests__/socketToken.test.ts`.
* `src/lib/api/client.ts`: the three unused "public" prefixes `/files/`, `/static/`, `/uploads/` are gone (the server has no such
  routes and no longer lists them as public).
* `src/lib/platform/__tests__/downloadAuth.test.ts` (new): proves attendance PDFs / invoices are downloaded WITH the bearer token on
  web (`fetch`) and native (`File.downloadFileAsync`), and that presigned S3 links never get it. DD-64 ("attendance PDFs are fetched
  without auth headers") was already fixed in code; `docs/DEFERRED_DECISIONS.md` is corrected.
* E2E mock server (`e2e/mock-server`): `MOCK_REQUIRE_AUTH=1` makes the mock enforce bearer tokens on every non-public route
  exactly like the real guard (public list mirrors `PUBLIC_RULES`, method aware). `loginAs` then seeds a session token
  (`tok-seed-<userId>`). Default behaviour is unchanged.

Backend (`C:\POC\clockyn_backend`)
* `core_functions/auth_policy.py`: removed the dead PUBLIC rules `/static/*`, `/files/*`, `/uploads/*` (no such route is mounted; a
  public rule without a route would silently make the first route someone adds under that prefix public).
* `tests/test_auth_route_sweep.py` (new): with `REQUIRE_AUTH=1` and a test secret, every route of the REAL FastAPI app that is not
  PUBLIC answers 401 without a token (no database is touched), operator routes refuse an anonymous call and an app token (403), all
  WebSockets refuse the handshake (4401), and every PUBLIC / OPERATOR / role rule matches a mounted route. This also pins the public
  list to the documented one.
* `tests/test_frontend_role_access.py` + `tests/data/frontend_*.json`: refreshed from this repo (they were generated from
  an earlier copy of the app and missed live-chat, referral, analytics, support FAQ / videos); `scripts/*frontend*.py` now default to this repo.

## What was verified

* Every `api.*` call goes through `src/lib/api/client.ts`, which attaches `Authorization: Bearer <session.accessToken>` to every
  non-public path (JSON, uploads via XHR, `authHeadersFor` for downloads). Calls before a session exists (OTP, trusted-device login,
  register, check-mobile / check-email, org-logo, referral validate, version check, config, device-change submit, logout) are PUBLIC on
  the server; the two calls that happen between login and `signIn` pass the new token explicitly (`accessToken` option).
* Static analysis of every call against the role policy (`test_frontend_role_access`): no screen of a role calls a route the policy
  denies that role (3 documented false positives of the import-graph analysis).
* 401: `onUnauthorized` runs once per session -> `signOut({reason:'expired'})` -> welcome screen + toast; the trusted-device token is
  kept (next sign-in is "Continue", no OTP). Queries do not retry 4xx. All timers stop with the session. 403 shows the server message
  and never signs out. Unsaved form state is lost on a forced sign-out (a 90 day token expiring is the only normal cause).
* Backend: full suite 3198 passed, 2 known unrelated failures (see the report), sweep above green.
* Browser E2E against the mock with `MOCK_REQUIRE_AUTH=1`: see the section "E2E evidence".

## E2E evidence (mock server enforcing bearer tokens)

`MOCK_REQUIRE_AUTH=1 npx playwright test -c e2e/playwright.config.ts --project=desktop <specs>` (isolated ports and
`E2E_ARTIFACTS`, see `e2e/README.md`). The mock answers 401 `Not authenticated` / `Token expired` to every request of the app that
carries no valid token on a non-public path, and the socket needs `?token=`.

* Ran with the switch ON (desktop project): `02-login-ui`, `q1-auth`, `q1-dashboard`, `q3-04-attendance`, `q3-01-punch`,
  `q2-reports-exports`, `q2-chat-direct`, `q1b-billing-checkout`, `q7-referral`, `q8-referral-checkout`, `q6-live-chat` (155 passed,
  4 failed), plus `q3-09-staff-chat` and `q2b-group-chat` (48 passed). `q4-auth-token` (explicit token / revoke / sign-out cases, it
  switches the mock mode itself) ran with the switch OFF: 10 passed.
* The 4 failures are not authentication problems: three tests of `q3-01-punch` (face punch result) fail identically with the switch OFF;
  the `q7-referral` sign-up field test types into an input and loses characters at random (it failed and passed in both modes on repeated
  runs). No app request in their traces got a 401.
* First run exposed only harness gaps (spec helpers calling the mock directly without a token, a seeded session without a token);
  fixed in the harness, not in the app.

## What could NOT be verified

* A real device (push `force_logout`, background location uploads with a token, native file download, native WebSocket close codes).
  Note: a handshake refused before `accept()` reaches a client as a failed connection (often close code 1006, not 4401), so the app
  also relies on the next HTTP 401 (the clickstream flush runs every 15 s while signed in) to sign out.
* The real backend + database + real Razorpay / MSG91 / S3 (the sweep stubs the pool; role / organisation checks are covered by the
  existing unit tests, not by live traffic).
* Old app builds that do not send a token get 401 on every non-public route after the switch (see "Safe order").
* Sessions created before `AUTH_TOKEN_SECRET` was set carry no token. They get 401 on the first request and are signed out once
  (welcome screen); a trusted device signs in again with one tap, others with an OTP. The app does not refresh tokens silently.

## Safe order

1. Check what is installed: if builds older than the first build with token support exist, raise `min_supported` (table behind
   `/version/check`) to the new build and publish it in the stores first. Wait until the share of old installs is acceptable.
   Old builds will be broken by the switch (every request 401), there is no server-side workaround.
2. Backend prerequisites: migration `033_user_auth_epoch.sql` applied; the admin console (operator API) uses its operator session
   token (`OPERATOR_ENFORCE` follows `REQUIRE_AUTH`, so the operator routes become enforced by the same switch).
3. Staging: deploy with `AUTH_TOKEN_SECRET` (>= 32 random characters, same value on every task) and `REQUIRE_AUTH=1`; run the smoke
   list below with an admin, a manager and a staff account on a real phone build, and with the web app. The service refuses to start
   if `REQUIRE_AUTH=1` and the secret is missing or short: that is intended.
4. Production, two steps: (a) set `AUTH_TOKEN_SECRET` (Secrets Manager + `primary.json`) with `REQUIRE_AUTH` still off. Tokens are issued
   at every login from now on, nothing is enforced. Let the new app build run for a few days so active users obtain a token.
   (b) set `REQUIRE_AUTH=1` and redeploy. Users who never logged in since (a) are signed out once.
5. Do it outside peak hours and watch the logs for 30 minutes.

Rollback: remove `REQUIRE_AUTH` (or set it to `0`) and redeploy; requests without a token pass again, tokens keep being issued. Do not
change `AUTH_TOKEN_SECRET` while rolling back: a new secret signs every user out. Changing it later is also a global sign-out.
Revocation of single-device users (staff / managers) after a device takeover can lag up to `AUTH_EPOCH_CACHE_SECONDS` (30 s) per process.

## Post-switch smoke test (10 minutes)

1. Admin web / phone: sign in with OTP; the home dashboard shows today's numbers (not an empty page or a login screen).
2. Admin: open Reports, download the monthly attendance PDF; it opens (an HTML/JSON error file means the download lost its token).
3. Admin: Billing > Invoices, open one invoice PDF; Billing > Subscription loads the plan.
4. Admin: Refer & Earn page loads; on the sign-up screen a typed referral code is validated before an account exists.
5. Admin: Chat, send a message, see it arrive on a second device live (socket connected with `?token=`); upload a chat image.
6. Admin: Support > Live Chat with Clockyn opens and sends a message; FAQ and Video Hub load.
7. Staff phone: sign in (trusted device "Continue"), punch in with the face camera, punch out; the attendance calendar loads.
8. Staff: Requests (submit a leave), Expenses (upload a bill photo), profile photo, change the push token (open the app twice).
9. Manager: open a screen granted by a permission (e.g. Attendance Reports) and one that is not granted; the second one shows the
   "Access denied. Required permission" message and does not sign anyone out.
10. Sign out and sign in again on the same device; open the app on a second phone with the same staff account: the first phone must
    land on the welcome screen.

What a 401 looks like in the logs: the uvicorn / load balancer access log shows `... 401` for the route; the response body is
`{"detail":"Not authenticated"}` (no / invalid / revoked token) or `{"detail":"Token expired"}` (90 day token ran out); the app
answers with "Your session expired. Please sign in again.". A 403 is logged by the `auth` logger as
`auth denied: actor=<user> role=<n> <METHOD> <path> reason=...` (role, manager permission or another organisation's id). A refused
socket logs `websocket refused: missing|invalid|expired|revoked`; 503 `Authentication temporarily unavailable` means the user lookup
failed (database), never "allowed". Expected right after the switch: a burst of 401s from old app builds and from sessions without a
token; a steady stream afterwards is a bug (look for `Authorization` missing from one call: the client always sends it, so the
suspects are a raw `fetch`, a link opened in a browser tab, or another service calling the API).
