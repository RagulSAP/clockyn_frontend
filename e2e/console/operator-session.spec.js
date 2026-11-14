'use strict';
/* Admin web console: operator session token (S-02). Runs against e2e/console/server.js (UI_ADMIN_APP + operator mock). */
const { test, expect } = require('@playwright/test');
const { check } = require('./static-check');

const API = 'http://127.0.0.1:' + (process.env.CONSOLE_API_PORT || 8891);
const EMAIL = 'admin@clockyn.test';
const KEY = 'clockyn_operator_session';
const EXPIRED_TEXT = 'Your session expired. Please sign in again.';

async function mockState(request, body) {
  const r = await request.post(API + '/__op/state', { data: body });
  expect(r.ok()).toBeTruthy();
}
async function mockLog(request) { return (await request.get(API + '/__op/requests')).json(); }

test.beforeEach(async ({ page, request }) => {
  await mockState(request, { reset: true });
  /* nothing leaves the machine: CDN libraries / fonts are answered empty */
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
});

async function login(page, { remember = false, email = EMAIL } = {}) {
  await page.goto('/pages/login.html');
  await page.locator('#email').fill(email);
  if (remember) await page.locator('#rememberMe').check({ force: true });
  await page.locator('#loginBtn').click();
  await expect(page.locator('#otpGroup')).toBeVisible();
  await page.locator('.otp-box').first().click();
  await page.keyboard.type('123456');
  await page.locator('#loginBtn').click();
  await page.waitForURL(/dashboard\.html$/);
}

const session = (page) => page.evaluate((k) => ({
  ses: window.sessionStorage.getItem(k), loc: window.localStorage.getItem(k),
  id: window.localStorage.getItem('clockyn_admin_id'), email: window.localStorage.getItem('admin_email'),
  role: window.localStorage.getItem('clockyn_admin_role'), remember: window.localStorage.getItem('remember_me'),
}), KEY);

test('static: operator-session.js once per page, before page scripts, no fetch bypass', () => {
  const { pages, problems } = check();
  expect(pages.length).toBe(18);
  expect(problems).toEqual([]);
});

test('login stores the token in sessionStorage (not localStorage), keeps the legacy keys, never shows it', async ({ page }) => {
  await login(page);
  const s = await session(page);
  const rec = JSON.parse(s.ses);
  expect(rec.token).toMatch(/^optok-/);
  expect(rec.email).toBe(EMAIL);
  expect(rec.role).toBe(1);
  expect(rec.expiresAt).toBeGreaterThan(Date.now() + 11 * 3600 * 1000);
  expect(s.loc).toBeNull();
  expect([s.id, s.email, s.role, s.remember]).toEqual([EMAIL, EMAIL, '1', '0']);
  expect(page.url()).not.toContain(rec.token);
  expect(await page.content()).not.toContain(rec.token);
});

test('login with Remember me stores the token in localStorage only', async ({ page }) => {
  await login(page, { remember: true });
  const s = await session(page);
  expect(s.ses).toBeNull();
  expect(JSON.parse(s.loc).token).toMatch(/^optok-/);
  expect(s.remember).toBe('1');
});

test('the login calls carry no credential even with a stale session around', async ({ page, request }) => {
  await page.goto('/pages/login.html');
  await page.evaluate((k) => {
    window.localStorage.setItem('clockyn_admin_id', 'old@x.test'); window.localStorage.setItem('admin_email', 'old@x.test');
    window.sessionStorage.setItem(k, JSON.stringify({ token: 'stale', email: 'old@x.test', expiresAt: Date.now() + 1e6 }));
  }, KEY);
  await login(page);
  const log = await mockLog(request);
  const calls = log.filter((r) => r.path.indexOf('/auth/admin-login') === 0);
  expect(calls.length).toBe(2);
  calls.forEach((c) => { expect(c.auth).toBe('none'); expect(c.adminId).toBe(''); });
});

test('API calls carry the Bearer token, including the ones that sent nothing before', async ({ page, request }) => {
  await login(page);
  await expect.poll(async () => (await mockLog(request)).filter((r) => r.path === '/gen-dashboard/stats').length).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  const log = (await mockLog(request)).filter((r) => r.path.indexOf('/auth/admin-login') !== 0 && r.method !== 'WS');
  const paths = log.map((r) => r.path);
  ['/gen-dashboard/me', '/company/deletion-requests', '/company/suggest-feature', '/gen-dashboard/stats', '/gen-dashboard/live-chat/unread-count']
    .forEach((p) => expect(paths).toContain(p));
  log.forEach((r) => expect([r.path, r.auth]).toEqual([r.path, 'bearer-valid']));
  /* the live-chat notifier keeps its own x-admin-id (legacy mode) next to the Bearer */
  expect(log.find((r) => r.path === '/gen-dashboard/live-chat/unread-count').adminId).toBe(EMAIL);
});

test('a page that sets x-admin-id itself keeps it and still gets the Bearer', async ({ page, request }) => {
  await login(page);
  await page.goto('/pages/settings.html');
  await expect.poll(async () => (await mockLog(request)).some((r) => r.path === '/auth/gen-admin-users')).toBeTruthy();
  const r = (await mockLog(request)).find((x) => x.path === '/auth/gen-admin-users');
  expect(r.auth).toBe('bearer-valid');
  expect(r.adminId).toBe(EMAIL);
});

test('a caller Authorization header is not overridden; non-API URLs are untouched', async ({ page, request }) => {
  await login(page);
  const seen = [];
  await page.route('**/js/theme.js*', (route) => { seen.push(route.request().headers()); route.continue(); });
  await page.evaluate(async (api) => {
    await fetch(api + '/gen-dashboard/stats', { headers: { Authorization: 'Bearer custom-one' } });
    await fetch('/js/theme.js?probe=1');
  }, API);
  const log = await mockLog(request);
  expect(log.filter((r) => r.path === '/gen-dashboard/stats').some((r) => r.auth === 'bearer-invalid')).toBeTruthy();
  expect(seen.length).toBe(1);
  expect(seen[0].authorization).toBeUndefined();
  expect(seen[0]['x-admin-id']).toBeUndefined();
});

test('the live chat socket uses ?token= and not admin_id', async ({ page, request }) => {
  await login(page);
  await expect.poll(async () => (await mockLog(request)).some((r) => r.method === 'WS')).toBeTruthy();
  const ws = (await mockLog(request)).find((r) => r.method === 'WS');
  expect(ws.auth).toBe('token-valid');
  expect(ws.adminId).toBe('');
});

test('a 401 sends the person to login once, with the message, and ends the session', async ({ page, request }) => {
  await login(page);
  await mockState(request, { enforce: true, revoke: true });
  const loginNavs = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame() && /login\.html/.test(f.url())) loginNavs.push(f.url()); });
  await page.goto('/pages/dashboard.html');            /* several parallel calls, all 401 */
  await page.waitForURL(/login\.html$/);
  await expect(page.locator('#errorText')).toHaveText(EXPIRED_TEXT);
  await page.waitForTimeout(800);
  expect(loginNavs.length).toBe(1);
  const s = await session(page);
  expect([s.ses, s.loc, s.id]).toEqual([null, null, null]);
});

test('a 401 on the live chat page also ends the session (not only the dashboard)', async ({ page, request }) => {
  await login(page);
  await mockState(request, { enforce: true, revoke: true });
  await page.goto('/pages/live_chat.html');
  await page.waitForURL(/login\.html$/);
  await expect(page.locator('#errorText')).toHaveText(EXPIRED_TEXT);
});

test('a 403 shows the server message and does not log out', async ({ page, request }) => {
  await login(page);
  await mockState(request, { force: { path: '/auth/gen-admin-users', status: 403, body: { detail: 'Only super admins can manage console users.' } } });
  await page.goto('/pages/settings.html');
  await expect(page.getByText('Only super admins can manage console users.')).toBeVisible();
  await page.waitForTimeout(600);
  expect(page.url()).toMatch(/settings\.html$/);
  const s = await session(page);
  expect(JSON.parse(s.ses).token).toMatch(/^optok-/);
  expect(s.id).toBe(EMAIL);
});

test('logout clears the token (sessionStorage and localStorage)', async ({ page }) => {
  await login(page, { remember: true });
  await page.evaluate((k) => window.sessionStorage.setItem(k, '{"token":"x"}'), KEY);   /* worst case: a copy in both */
  await page.locator('#sidebar-logout').click();
  await page.locator('#logout-confirm').click();
  await page.waitForURL(/login\.html$/);
  const s = await session(page);
  expect([s.ses, s.loc, s.id, s.email]).toEqual([null, null, null, null]);
});

test('the 30-minute idle logout clears the token too', async ({ page }) => {
  await login(page);
  await page.evaluate(() => window.localStorage.setItem('session_last_activity', String(Date.now() - 31 * 60 * 1000)));
  await page.reload();
  await page.waitForURL(/login\.html$/);
  const s = await session(page);
  expect([s.ses, s.loc, s.id]).toEqual([null, null, null]);
});

test('a token past expiresAt is treated as signed out without calling the server', async ({ page, request }) => {
  await login(page);
  await page.evaluate((k) => {
    const r = JSON.parse(window.sessionStorage.getItem(k)); r.expiresAt = Date.now() - 1000;
    window.sessionStorage.setItem(k, JSON.stringify(r));
  }, KEY);
  const before = (await mockLog(request)).length;
  await page.goto('/pages/dashboard.html');
  await page.waitForURL(/login\.html$/);
  await expect(page.locator('#errorText')).toHaveText(EXPIRED_TEXT);
  const after = (await mockLog(request)).slice(before);
  expect(after.map((r) => r.method + ' ' + r.path)).toEqual([]);
  const s = await session(page);
  expect([s.ses, s.loc, s.id]).toEqual([null, null, null]);
});

test('old backend (login answers no access_token): works as before with x-admin-id and admin_id', async ({ page, request }) => {
  await mockState(request, { mode: 'old' });
  await login(page);
  const s = await session(page);
  expect(JSON.parse(s.ses)).toEqual({ email: EMAIL, role: 1 });       /* no token stored */
  expect([s.id, s.role]).toEqual([EMAIL, '1']);
  await expect.poll(async () => (await mockLog(request)).some((r) => r.method === 'WS')).toBeTruthy();
  await page.waitForTimeout(500);
  const log = (await mockLog(request)).filter((r) => r.path.indexOf('/auth/admin-login') !== 0);
  expect(log.length).toBeGreaterThan(3);
  log.filter((r) => r.method !== 'WS').forEach((r) => { expect(r.auth).toBe('none'); expect(r.adminId).toBe(EMAIL); });
  const ws = log.find((r) => r.method === 'WS');
  expect([ws.auth, ws.adminId]).toEqual(['none', EMAIL]);
  expect(page.url()).toMatch(/dashboard\.html$/);
});

test('new backend in legacy mode (token issued, routes not enforcing): works', async ({ page, request }) => {
  await mockState(request, { mode: 'token', enforce: false });
  await login(page);
  await expect.poll(async () => (await mockLog(request)).some((r) => r.path === '/gen-dashboard/stats')).toBeTruthy();
  expect(page.url()).toMatch(/dashboard\.html$/);
});

test('enforced backend: the whole dashboard loads with the token', async ({ page, request }) => {
  await mockState(request, { enforce: true });
  await login(page);
  await expect.poll(async () => (await mockLog(request)).filter((r) => r.path.indexOf('/gen-dashboard/') === 0).length).toBeGreaterThan(4);
  await page.waitForTimeout(500);
  const log = await mockLog(request);
  expect(log.filter((r) => r.status === 401).length).toBe(0);
  expect(page.url()).toMatch(/dashboard\.html$/);
});

test('every page loads signed in without script errors and sends only Bearer-carrying API calls', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  const pages = ['clickstream', 'coupons', 'dashboard', 'delete_account', 'faqs', 'live_chat', 'org_analytics', 'organizations', 'payments',
    'referrals', 'settings', 'subscriptions', 'suggestions', 'tickets', 'users', 'video_views', 'videos'];
  for (const p of pages) {
    await page.goto('/pages/' + p + '.html');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/pages/' + p + '.html');
  }
  const log = (await mockLog(request)).filter((r) => r.method !== 'WS' && r.path.indexOf('/auth/admin-login') !== 0);
  expect(log.length).toBeGreaterThan(pages.length);
  expect(log.filter((r) => r.auth !== 'bearer-valid').map((r) => r.method + ' ' + r.path)).toEqual([]);
  expect(errors.filter((m) => !/xlsx|XLSX|jspdf|jsPDF|autotable/i.test(m))).toEqual([]);
});
