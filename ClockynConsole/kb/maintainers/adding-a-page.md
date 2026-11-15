---
title: Add a new page to the console
summary: Step-by-step checklist for adding a console page - file skeleton, script order, sidebar entry, API calls, role checks, tests, and the knowledge base document.
category: Maintainers
audience: maintainer
tags: new page, add page, nav item, sidebar, layout.js, static check, script order, skeleton, checklist, developer
updated: 2026-11-15
related: how-the-console-works, api-map, running-and-testing-locally, security-settings
---

Adding a page is mostly copying an existing one and changing the content. The rules that matter are the script order, the sidebar entry, how the page calls the backend, and the tests. Follow the steps in order.

## Steps

1. **Copy a page of similar shape** into `ClockynConsole/pages/`, for example `coupons.html` for a table with a form. Rename it in lower case with underscores (`my_page.html`).
2. **Set the head.** The first script in `<head>` is `../js/theme.js` (so the theme is applied before painting), then `<link rel="stylesheet" href="../css/dashboard.css">`. Set a title such as `Clockyn — My Page`. Use the colour variables of `dashboard.css` (for example `var(--surface)` and `var(--border)`) so light and dark themes both work.
3. **Write the body skeleton** shown below. The sidebar element must be followed at once by the `layout.js` script.
4. **Add the scripts at the bottom in this order:** `../js/config.js`, `../js/operator-session.js`, `../js/auth.js`, then your own script.
5. **Add a sidebar item** in `js/layout.js`: add an entry to the `NAV` list (key, label, href) and an icon with the same key in the `ICONS` object (Lucide icon nodes). If the page belongs to an existing item instead, map it in `ACTIVE_BY_FILE`.
6. **Call the backend with plain `fetch(API_BASE + '/path')`.** The wrapper in `js/operator-session.js` adds the operator token for you. Do not use `XMLHttpRequest`, `navigator.sendBeacon`, `EventSource`, `window.open` on a backend address or `new WebSocket`. For a socket use `ClockynOperator.wsUrl('/ws/...')` as `live-chat-notify.js` does.
7. **Escape everything you insert as HTML.** Pages define a small escaping helper for this (named `esc()` or `escHtml()`). Never put raw server text into `innerHTML`.
8. **Hide actions for normal operators.** Read the role with `localStorage.getItem('clockyn_admin_role') === '1'` (super admin) and only render create, edit and delete buttons for it. This is only about what is shown: the backend route must also be guarded with `require_operator_super` (see [security-settings](kb:security-settings)).
9. **Write the e2e test.** Add `e2e/console/my_page.spec.js`, and a mock file `e2e/console/my_page-mock.js` if the page needs data, hooked into `operator-mock.js` with one line. See [running-and-testing-locally](kb:running-and-testing-locally).
10. **Run the checks:** `npm run e2e:console:static`, `npm run check:brand`, `npm run e2e:console`.
11. **Document it.** Add a knowledge base file with `page: my_page.html` in its front matter and update [api-map](kb:api-map) with the page's endpoints. Run `npm run kb:build` and `npm run kb:check`.

## Body skeleton

```html
<body>
  <aside class="sidebar" id="app-sidebar" data-active="my_page"></aside>
  <script src="../js/layout.js"></script>

  <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>
  <div id="toast" role="status" aria-live="polite"></div>

  <div class="main">
    <header class="topbar">
      <button class="hamburger-btn" type="button" onclick="toggleSidebar()" aria-label="Open menu">...</button>
      <span class="topbar-title">My Page</span>
      <div class="topbar-actions">
        <button type="button" class="icon-btn" aria-label="Notifications">...</button>
        <div class="topbar-user-pill">
          <div class="avatar" id="topbar-avatar">SA</div>
          <div class="topbar-user-info">
            <div class="topbar-user-name" id="topbar-user-name">Super Admin</div>
            <div class="topbar-user-role" id="topbar-user-role">Super Admin</div>
          </div>
        </div>
      </div>
    </header>
    <div class="content">
      <div class="page-header"><div><h1>My Page</h1><p>One line about it.</p></div></div>
    </div>
  </div>

  <script src="../js/config.js"></script>
  <script src="../js/operator-session.js"></script>
  <script src="../js/auth.js"></script>
  <script>
    function handleLogout() { showLogoutModal(); }
    function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('open'); }
    function closeSidebar() { document.querySelector('.sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('open'); }
  </script>
</body>
```

The `Notifications` button in the topbar is enhanced automatically by `layout.js`, and the theme toggle is added by `auth.js`, so you only need the markup above.

## What the static check enforces

`e2e/console/static-check.js` fails when a page includes `operator-session.js` more than once, puts it before `config.js` or after `auth.js`, runs another script before it (only `theme.js`, `layout.js`, `config.js` and CDN scripts from `cdnjs.cloudflare.com` or `cdn.sheetjs.com` are allowed first), calls the backend in an inline script before it, or uses one of the bypass patterns from step 6. The two reviewed exceptions are the S3 upload in `videos.html` and the photo `window.open` in `users.html`.

## What can go wrong

- **Page redirects to the login straight away:** `auth.js` found no `clockyn_admin_id` in `localStorage`, so it logged out. Sign in first.
- **Sidebar item is not highlighted:** the `data-active` value does not match the `key` in `NAV`.
- **The static check complains about a script:** check the order in step 4 and that no page script appears above `operator-session.js`.
- **Icon is blank:** the key has no entry in the `ICONS` object of `layout.js`.

## Common questions

### Do I need to register the page anywhere else?
Only `layout.js` (sidebar) and the tests. There is no route table: the file name is the URL.

### Can I add a page without a sidebar item?
Yes, like `org_analytics.html` and `delete_account.html`. Map the file to the item it belongs to in `ACTIVE_BY_FILE`.

### How do I show different content to super admins?
Read the role as in step 8 for display, and guard the backend route with `require_operator_super`. Never rely on the hidden button alone.
