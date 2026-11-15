---
title: Deploy the console and its backend changes
summary: How to publish ClockynConsole as static files, the safe order with database migrations, backend and app, what to set for CORS and caching, and how to roll back.
category: Maintainers
audience: maintainer
tags: deploy, release, publish, hosting, static files, cache, ctrl+f5, cors, migrations, migrate.py, rollback, order, 038, 039, 040, 041
updated: 2026-11-15
related: running-and-testing-locally, security-settings, how-the-console-works
---

The console has no build step, so deploying it means copying the folder `ClockynConsole/` to wherever it is hosted. The harder part is the order: the console, the backend, the database and the app are separate deploys and several features need the database changed first.

## What you publish

Publish the whole `ClockynConsole/` folder: `index.html`, `pages/`, `css/`, `js/`, `assets/` and `kb/`. Before you publish:

1. Open `js/config.js` and check that `API_BASE` is the backend you want, not an old or test address. The repository's `config.js` is what gets deployed.
2. Run `npm run e2e:console:static`, `npm run check:brand` and `npm run e2e:console` from `C:\POC\clockyn_frontend` (see [running-and-testing-locally](kb:running-and-testing-locally)).
3. If you changed or added knowledge base files, run `npm run kb:build` so `kb/index.json` is current.

## The safe order

Always in this order, because each step depends on the one before:

1. **Database first.** Apply pending migrations with `python migrate.py --all` (preview with `python migrate.py --all --dry-run`, list with `python migrate.py --status`). Or start the backend with `RUN_MIGRATIONS=1`, which runs the same function at start-up and never stops the app if it fails. If your PC cannot reach the database, the run guide `clockyn_run_commands.html` shows how to run `python migrate.py --all` as a one-off task of the backend service.
2. **Backend.** Deploy the new backend. The new code expects the new tables and columns.
3. **Console.** Publish the new console files.
4. **App.** Release the new app build last. Older app builds keep working with a newer backend.

## Migrations 038 to 041 in short

| File | What it does | Safe before the new backend? |
| --- | --- | --- |
| `038_drop_legacy_table_prefix.sql` | Renames three tables (settings, manager permissions, subscription) and their keys, indexes and sequences. | No. Old code fails after it and new code fails before it, so run it right before the new backend starts. |
| `039_plan_free_months.sql` | Adds `free_months` and `offer_text` to `gen_plans`, plus a unique index per plan name and duration. | Yes. |
| `040_b2c_referral.sql` | Adds the promoter tables, the C2C percent table and new columns on `referral` and `referral_reward`. | Yes, but the new backend fails without it. |
| `041_b2c_payout_void.sql` | Adds the void columns to `b2c_payout`. | Yes. |

Each migration runs in its own transaction and is safe to run twice. A lock stops two processes from migrating at once.

## Hosting settings that matter

- **CORS on the backend:** if `CORS_ALLOWED_ORIGINS` is set, it must contain the console's exact origin including the port. Unset or `*` allows every site.
- **Video upload:** the S3 bucket's CORS rules must allow the console's origin and the `PUT` method, or "Upload to storage failed" appears.
- **Caching:** the pages and scripts change with every release, so serve `.html` and `.js` with short or no caching. After a release, press `Ctrl+F5` once to be sure you see the new files.
- **Sign in again:** after a release that changes the session code, operators sign in once more with the e-mailed code.

The recommended production security settings and their own rollout order are in [security-settings](kb:security-settings).

## Rollback

- **Console:** publish the previous copy of the folder. Older console files keep working with a newer backend; the newer screens and buttons simply do not appear.
- **Backend:** redeploy the previous image. Migrations 039, 040 and 041 only add things, so the old backend ignores them. Migration 038 does not roll back by itself: reverse it by running the same rename block with the old and new names swapped.
- **Data in the new B2C tables:** if you roll the backend back while promoter referrals exist, the older C2C overview counts those referrals in its totals. Roll forward again rather than deleting rows.

## What can go wrong

- **New buttons answer "Not Found":** the console was published before the backend. Deploy the backend, then reload.
- **Checkout or registration errors after a backend deploy:** migration 040 was not applied. Run `python migrate.py --status` and apply it.
- **Everything shows old behaviour after a deploy:** the browser or host is caching old files. Press `Ctrl+F5` and check the host's cache headers.

## Common questions

### Do I need to restart anything for a console-only change?
No. Copy the files and reload. There is no server process for the console.

### Which deploy can I skip if I only changed documentation?
A change that only touches `kb/` needs no backend, database or app change. Run `npm run kb:build`, then publish the console files.

### Can I run migrations while users are online?
Migrations 039 to 041 only add columns and tables and are quick. Migration 038 should be run right before the backend starts, so keep the gap short.
