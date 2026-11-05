# Clockyn E2E harness (web, Playwright + stateful mock backend)

Browser end-to-end tests run against the **web export** of the app (`expo export --platform web`) served statically, talking to an
in-memory **mock backend** that implements every endpoint family the app calls. No real backend, no network: third-party hosts
(map tiles, reverse geocoding, Razorpay `checkout.js`) are stubbed in the browser.

## Quick start

```bash
npm run e2e:build     # export the web app into e2e/.artifacts/web-dist (API base baked in: http://127.0.0.1:8787). Re-run after app changes.
npm run e2e           # headless, all specs, projects desktop + phone (starts the mock + static servers, reuses them if already running)
npm run e2e -- e2e/specs/00-smoke.spec.ts --project desktop -g "admin.staff"   # subset
npm run e2e:headed    # watch it run
npm run e2e:report    # open the HTML report (e2e/.artifacts/report)

npm run e2e:mock          # run only the mock backend (port MOCK_PORT, default 8787) for manual poking
npm run e2e:mock:check    # contract self-test of the mock (needs the mock running); also run first thing after changing it
npm run e2e:typecheck     # tsc for e2e/ (root `tsc --noEmit` excludes e2e)
```

Env: `MOCK_PORT` (8787), `E2E_WEB_PORT` (8788, + the next `E2E_WEB_PORTS`-1 ports, default 8), `E2E_WORKERS` (default 4, 2 on CI, max = web ports),
`E2E_API_BASE_URL` (build against another API origin), `E2E_BUILD_CLEAR=1` (clear the Metro cache), `E2E_WEB_ROOT` (serve another export).
Artifacts (all git-ignored under `e2e/.artifacts/`): `web-dist/`, `screenshots/<project>/<route>.png` (smoke), `test-results/` (failure screenshots + traces), `report/`.

## Architecture

```
e2e/
  mock-server/        node http + ws, zero build step. index.js (server, /__test control, WS), state.js (seed), domain.js (derivations),
                      routes/*.js (one module per endpoint family), lib/ (router, multipart parser, IST time, PDF/PNG generators),
                      fixtures.js (stable ids shared with the specs), selfcheck.js (contract test of the mock)
  serve.js            static server for the export with SPA fallback; listens on E2E_WEB_PORTS consecutive ports
  build.js            expo export with EXPO_PUBLIC_API_BASE_URL pointing at the mock
  playwright.config.ts  projects desktop (1280x800) + phone (390x844, touch); geolocation = Head Office; camera permission + fake media flags;
                        locale en-IN / Asia/Kolkata; webServer entries for mock + static server; testIdAttribute = data-testid
  support/            test.ts (the `test` to import), auth.ts, mock.ts, app.ts, ui.ts, theme.ts, collectors.ts (+ allowlist.json), external.ts, routeCases.ts, fixtures.ts
  specs/              00-smoke, 01-guards, 02-login-ui, 03-harness (self-tests) — add yours as NN-name.spec.ts
```

### Parallelism and isolation (important)
Each Playwright worker uses its **own web origin** (`http://127.0.0.1:8788 + workerIndex`). The mock keys all state by the browser `Origin`
(or an `x-e2e-tenant` header), so every worker has an independent database, request log, flags, clock and WebSocket registry. The `mock`
fixture resets the worker's tenant to the seed before every test. Specs may therefore mutate freely and run in parallel.
Always import from `../support` (it overrides `baseURL`, `page`, `mock`), never from `@playwright/test` directly.

## Fixtures

Seed is generated relative to the mock clock's "today" (IST). Org `org-0001` "Acme Traders". OTP for every login: **123456**.

| Role (`loginAs` key) | Mobile | User id | Notes |
|---|---|---|---|
| `admin` | 9000000001 | `adm-0001` | role 1, no device token, org `org-0001`, active **Elite** plan |
| `manager` | 9000000002 | `mgr-0001` | role 2, all 10 permissions, scope Head Office, device token `devtok-mgr-0001`, working today |
| `staff` | 9000000003 | `stf-0001` | role 3, face enrolled, **not punched in today** (use it for punch tests), token `devtok-stf-0001` |
| `fieldStaff` | 9000000004 | `stf-0002` | role 3 field staff, punched in today, today's odometer start reading, location trail |

* Other users: `mgr-0002` (Warehouse, only "Requests Management"), `stf-0003 … stf-0023` (inactive: 0005, 0011, 0019; field: 0002/4/6/8/10; face not enrolled: 0003, 0009).
  Today's states: absent / working / late / punched-out / two sessions / on leave, spread across both branches. Roughly 45 days of history (no Sundays).
* Branches: `101` Head Office (12.9716, 77.5946, r150 — the browser geolocation), `102` Warehouse (r200). Departments `dept-101` Sales, `dept-102` Operations, `dept-103` Engineering. Shifts `1` General 09-18, `2` Morning 06-14, `3` Night 21-06.
* Requests: pending leave `req-001/002/005`, permission `req-101/102`, shift change `req-201/202`, device change `req-301`; plus approved/rejected examples. 8 pending in total (admin badge).
* Leads `lead-001…012` in every pipeline status (new, contacted, interested, converted, not_interested), 9 assigned (some to `stf-0001`/`mgr-0001`), 2 carry-forward requests, categories General/Retail/Wholesale/Corporate.
* Chat: 1:1 history (admin↔staff with unread, manager, staff↔staff), groups `grp-1` All Hands, `grp-2` Sales Team; announcements `ann-1…4` (all / selected / branch / dept).
* Payroll: payslips `ps-1`, `ps-2` with assigned staff; wage templates `dw-1`, `dw-2` (daily), `hc-1` (hourly); incentives `inc-c1` (count), `inc-t1`, `inc-o1`, `inc-b1`; 3 advances. Salary breakdown/monthly list are derived from these.
* Billing: plan catalogue Core/Prime/Elite, subscription (staff limit 50), 2 invoices, coupon `WELCOME10`, support subjects + 2 tickets.
* Exact constants: `mock-server/fixtures.js` (typed in `support/fixtures.ts`: `USERS`, `IDS`, `BRANCHES`, `GEO`, …). Live rows: `await mock.fixtures()` or `GET /__test/fixtures`.

## Control endpoints (`/__test/*`, per tenant)

| Endpoint | Purpose |
|---|---|
| `POST /__test/reset` `{…state patch}` | back to the seed (also clears failures, latency, clock, recorded requests) |
| `GET/POST /__test/state` | flags. Patch keys: `plan` (`elite`\|`prime`\|`core`\|`trial`\|`expired`\|`none`), `latencyMs`, `failNext` (`{path, method?, status?, body?, times?, networkError?}` — path is exact, `prefix*` or `re:<regex>`; `times:-1` = until cleared), `clearFailures`, `clock` (ISO, null = real), `forceLogout` (user ids, or `{add,remove}`), `faceMismatch`, `otp`, `noCoupon`, `birthdays` (user ids, opt-in birthday modal), `version` (`{update_required, force_update, …}`), `locationLogStatus`, `requireAuth` (bearer-token mode: protected paths answer 401 without an issued token, see `docs/changes/security-token.md`), `revokeTokens: true` (issued tokens answer 401 `Token expired`), `userPatch` (`{ <userId>: { <row fields> } }`, e.g. `face_registered: false`, `shift_id: 3`) |
| `GET /__test/requests?path=&method=&since=` / `DELETE` | recorded calls (method, path, query, JSON/form body, multipart file parts, status, `injected`); includes `WS` connects |
| `POST /__test/push` `{userId\|userIds, event}` | send a WebSocket frame to a user's open sockets (`{type:'new_message'|'new_group_message'|'read_update'|'group_created'|'announcement'|'request_submitted'|'badge_update', data…}`) |
| `GET /__test/sockets`, `/__test/pushes`, `/__test/fixtures`, `/__test/tenants`, `/__test/health` | introspection |

WebSockets: `/ws/chat/{uid}`, `/ws/group-chat/{gid}/{uid}`, `/ws/badge/{uid}` (answers `ping` with `pong`). The mock itself pushes `new_message`, `new_group_message`,
`read_update`, `group_created`, `announcement`, `request_submitted` (when a request is filed) and `badge_update` (when a staff member punches) as the real backend would.
Plan gating is enforced server-side like the real backend (403 `detail`; chat/group list answer HTTP 500 `"403: …"`).
Mutations change state: follow-up GETs reflect them (e.g. approve a request, then the admin list and the employee list show the new status; approving a device change clears the user's device token).
`mock` client (typed): `reset, state, setState, setPlan, requireAuth, revokeTokens, failNext, clearFailures, setLatency, forceLogout, takeOverDevice, setClock, fixtures, requests, clearRequests, lastRequest, waitForRequest, push, sockets, waitForSocket`.

## Writing a spec

```ts
import { test, expect, loginAs, visit, USERS, IDS } from '../support';

test('admin approves a pending leave', async ({ page, mock }) => {
  await loginAs(page, 'admin');                     // BEFORE the first navigation: seeds localStorage (auth store + onboarding/rate/plan-popup flags)
  await visit(page, '/admin/requests/leave');       // goto + wait for splash/guards gone + network idle
  await page.getByRole('button', { name: /approve/i }).first().click();
  const call = await mock.waitForRequest('/requests/update-status', { method: 'POST' });
  expect(call.body).toMatchObject({ status: 'approved' });
});
```

* **Selectors**: prefer `getByRole`/`getByText`; the UI kit forwards `testID` as `data-testid` (`page.getByTestId('login-action')`). Note `OTPInput`'s testID sits on the single hidden `<input>` (`fill` it directly).
* **Sessions**: `loginAs(page, role, { plan, permissions, freshLogin, showOnboarding, showPlanPopup, theme, session, storage })`. The seed is applied once per tab (a later sign-out stays signed out across reloads).
  `freshLogin: true` puts the app inside the 5-minute grace window of the single-device check (default: outside, so the session watcher runs). `loginViaUi(page, role)` drives the real screens. `readSession(page)`, `logoutViaUi(page, role)`.
* **Failures / plans**: `await mock.setPlan('expired')` (before `loginAs`, so the session carries the plan) · `await mock.failNext('/home/branches', { status: 503 })` · `await mock.setLatency(800)`.
* **Dark mode**: `setDarkMode(page, true)` (emulates `prefers-color-scheme`, no reload) or `loginAs(..., { theme: 'dark' })`.
* **Payments**: Razorpay is stubbed; `setCheckoutMode(page, 'success'|'dismiss'|'fail')` before navigating.
* **Uploads** (photos/files) are multipart: assert with `rec.files` on the recorded request; `file://`-less web pickers need `page.setInputFiles` on the hidden `<input type=file>`.
* **Time**: `mock.setClock('2026-11-02T09:30:00+05:30')` shifts the server clock (the browser clock is real).
* **Page issue collector** (automatic): the test **fails at teardown** on any uncaught page error, `console.error`, failed local request, or mock answer 404/405/5xx. Intentional ones:
  `issues.allow(/regex/)` inside the test (e.g. after `failNext`), or add a justified entry to `support/allowlist.json`; `test.use({ failOnPageIssues: false })` to opt out. Failure screenshots/traces are automatic.
* Route smoke covers every path of `src/config/routes.ts`; adding a route to the app without a case in `support/routeCases.ts` fails `00-smoke` ("registry coverage").

## Known limitations

* Web only. Native-only behaviour (background location task, FCM push, native camera/permission dialogs, native maps, haptics) is a no-op/different on web and not covered.
* Face recognition is simulated by the mock (always matches unless `faceMismatch`); the browser camera is Chromium's fake device. Photo bytes are not inspected (only size/field names).
* Report/invoice downloads return a tiny valid PDF; Excel/CSV/PDF exports built client-side (`xlsx`, `expo-print`) are not content-checked.
* Salary breakdown numbers are plausible derivations from the seeded templates, not the real payroll engine; `/salary/monthly-list`, `/api/daily-wages`, `/api/hourly-charges`, `/api/wages`, `/api/attendance-rule`, overtime report are modelled from the app's contract (not routed in the backend repo snapshot) — verify against the deployed service.
* Manager scoping is implemented only where the app passes a manager's own user id (`/home/*`, `/addstaff/branches`); the admin request list is not scoped.
* `POST /company/request-deletion` only records the request (the real backend deactivates the account) so the seeded users stay usable.
* WebSocket delivery is best effort (no ack/retry); the app reconnects with backoff, the mock does not drop sockets unless asked (`failNext … networkError` only affects HTTP).
* One Chromium engine; no WebKit/Firefox. Max parallelism = number of web ports (`E2E_WEB_PORTS`, default 8).
* The mock is lenient about which org/user id is passed for org scope (it resolves any id to the primary org); assert on `mock.requests()` when the exact id matters.

## Harness changes outside `e2e/` (log)

* `package.json`: devDependencies `@playwright/test`, `ws`, `@types/ws`; scripts `e2e`, `e2e:build`, `e2e:headed`, `e2e:report`, `e2e:mock`, `e2e:mock:check`, `e2e:typecheck`.
* `eslint.config.js`: added an `e2e/**` override (Node globals, console allowed, Playwright fixture callbacks) so `npm run lint` stays clean.
* No application source was changed.
