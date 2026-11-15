---
title: Run and test the console locally
summary: How to serve ClockynConsole on your PC, point it at a backend, and run its checks (static check, brand check, Playwright e2e with mocks, backend tests, schema checks).
category: Maintainers
audience: maintainer
tags: local, run, serve, http.server, e2e, playwright, mock, tests, pytest, static check, ports, test results, developer setup
updated: 2026-11-15
related: how-the-console-works, adding-a-page, deploying-the-console
---

You can run the console on your own PC with any static file server, and you can test it without a real backend because the e2e tests use mock servers. This page covers both, and the checks to run before you commit.

## Serve the console on your PC

1. Open a terminal and go into the console folder: `cd C:\POC\clockyn_frontend\ClockynConsole`.
2. Start a static server from that folder: `python -m http.server 5500`. Run it from `ClockynConsole`, not from the repository root, so the relative paths in the pages resolve.
3. Open `http://localhost:5500/`. It redirects to `pages/login.html`.
4. Set the backend address in `js/config.js`: change `API_BASE` to your deployed service, or to `http://localhost:8080` for a backend running on your PC.
5. If the backend has `CORS_ALLOWED_ORIGINS` set, add `http://localhost:5500` (the exact origin including the port), or the pages show a CORS error.
6. Sign in with an operator e-mail address that exists in the backend's operator login table. The backend sends a six-digit code by e-mail. Open the page from `http://localhost:...`, not as a file, because video upload and notifications need a real origin.

## End-to-end tests (Playwright, no real backend)

`npm run e2e:console` runs Playwright against the console, served by `e2e/console/server.js`. That server serves the real `ClockynConsole` folder but replaces `/js/config.js` so `API_BASE` points at a mock backend. Nothing in `ClockynConsole` is modified.

- **Ports:** the web server uses `CONSOLE_WEB_PORT` (default 8890) and the mock API uses `CONSOLE_API_PORT` (default 8891).
- **The mock:** `e2e/console/operator-mock.js` answers the login and the operator routes. In the mock the sign-in code is always `123456`. The e-mail `admin@clockyn.test` is a super admin (role 1) and `staff@clockyn.test` is a normal operator (role 2). Test control is through `POST /__op/state` (mode, enforcement, expiry, forced responses) and `GET /__op/requests` (recorded calls, never the token itself).
- **Feature mocks:** larger features have their own mock file, hooked into `operator-mock.js` with one line: `e2e/console/referral-mock.js` (referrals, B2C codes, payouts), `e2e/console/plans-mock.js` (plans) and `e2e/console/shell-mock.js` (chat panel and bell counts). Add yours the same way.
- **Specs:** `e2e/console/*.spec.js`, one per area (operator session, referrals, plans, Video Hub, shell).
- **Run one spec:** `npm run e2e:console -- e2e/console/referrals.spec.js`.

### Do not run two Playwright runs at the same time

All runs write to the same folder, `e2e/.artifacts-console/test-results`, and reuse the same ports. Two runs at once delete each other's files and fail with `ENOENT` errors that have nothing to do with your code. If you must run in parallel, give each run its own ports and its own `--output` folder, for example `CONSOLE_WEB_PORT=8892 CONSOLE_API_PORT=8893 npm run e2e:console -- --output=e2e/.artifacts-console/mine`. Otherwise run them one after the other.

## Other checks to run

| Command (from `C:\POC\clockyn_frontend`) | What it checks |
| --- | --- |
| `npm run e2e:console:static` | Every page includes `operator-session.js` exactly once, after `config.js` and before `auth.js`, and no page bypasses the fetch wrapper. |
| `npm run check:brand` | No former product name appears anywhere in the repository, including these Markdown files. |
| `npm run kb:build` and `npm run kb:check` | Rebuild the knowledge base index and validate every KB document (front matter, links, size). |
| `npm run lint` | ESLint, which also covers the e2e files. |

Backend checks (from `C:\POC\clockyn_backend`, using your Python environment with the backend requirements installed):

- `python -m pytest -q` runs the backend tests. `tests/test_env_documented.py` needs a local `.env` file and fails without one.
- `python scripts/check_schema_consistency.py` compares `clockyn_ddl_latest.sql` with the migrations.
- `python scripts/sql_static_check.py` checks the SQL in the Python code against the schema.
- `python scripts/build_fresh_ddl.py --check` fails when `clockyn_ddl_fresh.sql` is out of date. Run it without `--check` to regenerate.

## What can go wrong

- **Many e2e tests fail with `ENOENT`:** another Playwright run was using the same results folder. Stop it and run again alone.
- **"Port already in use":** an old test server is still running. Stop it, or set different `CONSOLE_WEB_PORT` and `CONSOLE_API_PORT` values.
- **Login works but pages are empty locally:** the unknown routes of the mock answer an empty `{}`. Add the endpoint to a mock file if the page needs data.
- **A page fails the static check:** a script is in the wrong order or a page calls the backend without the shared fetch wrapper. The message names the file and line.

## Common questions

### Do the e2e tests need the real backend or a database?
No. They run against `operator-mock.js` and the feature mocks, so they cannot prove that backend SQL works. The backend tests and schema checks cover that part.

### How do I test a super admin and a normal operator?
Sign in with `admin@clockyn.test` for a super admin and `staff@clockyn.test` for a normal operator. The mock returns the matching role.

### Why do the specs use a Remember me or storage check?
The operator session spec checks that the token is in `sessionStorage`, or in `localStorage` when Remember me is ticked. Look at `e2e/console/operator-session.spec.js` for examples.

### Can I test the live chat socket?
The mock's WebSocket sends no frames, so tests simulate messages through the page's own event instead. Check real socket delivery once on a staging backend.
