---
title: How the console works (architecture)
summary: Explains how ClockynConsole is built (static HTML, CSS and JavaScript, no build step), what each shared script does, how a page is structured and how data and sign-in flow to the backend.
category: Maintainers
audience: maintainer
tags: architecture, static site, layout.js, auth.js, operator-session.js, config.js, fetch wrapper, session, how it works, developer, code layout
updated: 2026-11-15
related: api-map, security-settings, adding-a-page, running-and-testing-locally
---

ClockynConsole is the web tool Clockyn's own team uses to run the platform. It is plain static files: HTML pages, one stylesheet, and a few shared JavaScript files. There is no framework, no bundler and no build step, so what is in the folder `ClockynConsole/` is exactly what a browser loads.

## Folder layout

All paths are inside `C:\POC\clockyn_frontend\ClockynConsole`.

| Path | What it is |
| --- | --- |
| `index.html` | Redirects to `pages/login.html`. |
| `pages/*.html` | One self-contained file per screen. Each has its own inline `<style>` and `<script>`. |
| `css/dashboard.css` | The shared stylesheet (layout, tables, modals, tabs, light and dark colour variables). |
| `css/login.css` | Styles of the login page only. |
| `js/config.js` | Defines `API_BASE` (the backend address) and `LOGO_URL`. |
| `js/operator-session.js` | Stores the operator token and wraps `window.fetch` so every backend call is authenticated. |
| `js/auth.js` | Idle timeout, logout, profile loading, theme button, and the sidebar badge counters. |
| `js/layout.js` | The shared shell: sidebar, floating Live Chat button and panel, and the notification bell. |
| `js/live-chat-notify.js` | The Live Chat socket, unread count, tab title, chime and browser notifications. |
| `js/theme.js` | Light, dark or system theme. Loaded in `<head>` so the page never flashes the wrong theme. |
| `js/export.js` | Excel and PDF export helpers (SheetJS and jsPDF are loaded from a CDN by the pages that export). |
| `assets/` | Logo image and notification sound. |
| `kb/` | This knowledge base (Markdown files). |

## How a page is structured

Every page in `pages/` follows the same skeleton:

1. In `<head>`: `../js/theme.js`, then `../css/dashboard.css`.
2. In `<body>`: an empty `<aside class="sidebar" id="app-sidebar" data-active="...">` followed at once by `<script src="../js/layout.js">`. The script writes the sidebar markup immediately, so there is no flash.
3. A `.main` block with `<header class="topbar">` and `<div class="content">` holding the page.
4. At the bottom, in this order: `../js/config.js`, `../js/operator-session.js`, `../js/auth.js`, then the page's own script. The order matters and is checked by `e2e/console/static-check.js`.

## The shell (`js/layout.js`)

- **Sidebar:** built from a `NAV` list in the script. `data-active` says which item is highlighted. Pages that belong to another item are mapped in `ACTIVE_BY_FILE` (`org_analytics` to Organizations, `delete_account` to Users, `video_views` to Video Hub).
- **Floating chat button:** a button at the bottom right of every page except `live_chat.html`. It opens a panel that holds `live_chat.html?embed=1` in an iframe. The iframe is created on first open and kept alive. `window.ClockynLiveChatPanel` exposes `open`, `close`, `toggle` and `isOpen`.
- **Bell:** every topbar button labelled "Notifications" opens a "Needs your attention" list. The counts are read from badges that other scripts fill: unread chats (`.nav-livechat-badge`), account deletion requests (`.nav-users-badge`) and feature suggestions (`.nav-suggestion-badge`).

## Sign-in and the session

1. `login.html` calls `POST /auth/admin-login` with an e-mail address. The backend e-mails a six-digit code that is valid for five minutes.
2. `login.html` then calls `POST /auth/admin-login/verify-otp`. The answer carries `email`, `role_id` and, when the server has a token secret, `access_token` and `expires_in`.
3. `ClockynOperator.set(...)` in `js/operator-session.js` stores the session record under the key `clockyn_operator_session`: in `sessionStorage` normally, or in `localStorage` when "Remember me" is ticked. `login.html` also writes `admin_email`, `clockyn_admin_id`, `clockyn_admin_role` and `remember_me` to `localStorage`.
4. From then on `js/operator-session.js` wraps `window.fetch`. For URLs that start with `API_BASE` it adds `Authorization: Bearer <token>`. When there is no token (an old backend) it adds the legacy header `x-admin-id: <email>`. Other URLs are untouched.
5. Any 401 from the backend ends the session: the console clears storage, stores the message "Your session expired. Please sign in again." and goes to `login.html`. A 403 means "signed in but not allowed" and logs nobody out.
6. `js/auth.js` also logs out after 30 minutes without activity (`SESSION_DURATION`), checked every minute, unless "Remember me" is on. The operator token itself lives for `OPERATOR_TOKEN_TTL_HOURS` on the backend (default 12 hours).

## How data flows

The mobile app and the console talk to the same backend. The app writes organisations, users, orders and support messages; the console reads and manages them through operator routes. Most console routes live under the prefix `/gen-dashboard`. Others are `/plans`, `/company`, `/support`, `/invoice` and `/auth`. The `gen_` names (the `gen_*` tables, the `gen_*.py` files, the `/gen-dashboard` URLs) are an older naming that was kept on purpose and is listed as "revisit later" in the rename checklist, so do not rename them as part of other work.

See [api-map](kb:api-map) for every page and endpoint, and [security-settings](kb:security-settings) for the guards.

## What can go wrong

- **A page loads but every call fails:** `API_BASE` in `js/config.js` points at the wrong backend, or the backend's CORS list does not include the console's origin.
- **Signed out right after a call:** the backend answered 401. Some routes are app routes, not operator routes, and reject an operator token when `REQUIRE_AUTH` is on. See [security-settings](kb:security-settings).
- **Sidebar missing:** the page lacks the `<aside id="app-sidebar">` element or the `layout.js` script right after it.

## Common questions

### Where do I change the backend address?
In `ClockynConsole/js/config.js`, the `API_BASE` constant. Use the address of the backend you want, with no trailing slash needed.

### Why is there no build step?
The console is a small set of static pages, so it is copied to a web host as is. This keeps deploys simple but means shared code must stay plain browser JavaScript.

### Where is the super admin check on the page?
Pages hide super-admin-only buttons by reading `localStorage.getItem('clockyn_admin_role') === '1'`. This is only about what is shown. The backend enforces the rule on every route.

### Why does Live Chat have no sidebar item?
It moved to the floating chat button. The full page `live_chat.html` still exists and is reachable through "Open full page" in the panel.
