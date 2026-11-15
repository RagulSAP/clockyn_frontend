'use strict';
/* Dashboard "Subscriptions expiring" card + Organizations "Expiring" filter.
 * Runs against e2e/console/server.js (ClockynConsole + operator mock). Data comes from e2e/console/expiry-mock.js, which is switched on per test
 * with today's date IN INDIA (computed here, so the spec never goes stale) and works out the expected windows on its own.
 * The key test: the number the dashboard promises equals the rows the Organizations page lists, for all three windows.
 * Screenshots: set EXPIRY_SHOTS_DIR to a folder and the screenshot tests save PNGs there. */
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const API = 'http://127.0.0.1:' + (process.env.CONSOLE_API_PORT || 8891);
const SHOTS = process.env.EXPIRY_SHOTS_DIR || '';
const KEYS = ['today', '7d', '30d'];
const NEVER_LISTED = ['Deleted Today Inc', 'Trial Org', 'Yesterday Co', 'No Date Org', 'Past Month Ltd'];

const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

async function post(request, url, data) {
  const r = await request.post(API + url, { data });
  expect(r.ok()).toBeTruthy();
}
const expiryState = (request, body) => post(request, '/gen-dashboard/__expiry/state', body);

async function expected(request) {
  const r = await request.get(API + '/gen-dashboard/__expiry/expected');
  expect(r.ok()).toBeTruthy();
  return r.json();
}
/* expected organisation names of a window, soonest first, ties by name (what the page promises) */
function orderedNames(exp, key) {
  return exp.ids[key].slice().sort((a, b) => a.end.localeCompare(b.end) || a.name.localeCompare(b.name)).map((x) => x.name);
}

test.beforeEach(async ({ page, request }) => {
  await post(request, '/__op/state', { reset: true });
  await expiryState(request, { reset: true });
  await expiryState(request, { on: true, today: istToday() });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
});
test.afterEach(async ({ request }) => {
  await expiryState(request, { reset: true });          // leave nothing switched on for the other specs
});

async function login(page) {
  await page.goto('/pages/login.html');
  await page.locator('#email').fill('admin@clockyn.test');
  await page.locator('#loginBtn').click();
  await expect(page.locator('#otpGroup')).toBeVisible();
  await page.locator('.otp-box').first().click();
  await page.keyboard.type('123456');
  await page.locator('#loginBtn').click();
  await page.waitForURL(/dashboard\.html$/);
}
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
async function openDashboard(page) {
  const errors = collectErrors(page);
  await login(page);
  await expect(page.locator('#exp-row-today')).toBeVisible();
  return errors;
}
const rowsOf = (page) => page.locator('#orgs-tbody tr.row-link');
const namesOf = (page) => page.locator('#orgs-tbody tr.row-link .org-name-text').allTextContents();
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}

/* ───────────────────────────── dashboard ───────────────────────────── */
test('the Subscription Plans card is gone and the Plan Distribution donut with its legend remains', async ({ page, request }) => {
  const errors = await openDashboard(page);
  await expect(page.locator('#plans-title')).toHaveCount(0);
  await expect(page.locator('#plans-grid')).toHaveCount(0);
  await expect(page.getByText('Subscription Plans', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Plan Distribution', { exact: true })).toBeVisible();
  await expect(page.locator('#donut-svg')).toBeVisible();
  const plans = await (await request.get(API + '/gen-dashboard/plan-breakdown')).json();
  expect(plans.filter((p) => p.plan_name === 'Core').length).toBeGreaterThan(1);           // several durations of the same plan ...
  await expect(page.locator('#donut-legend .donut-legend-item')).toHaveCount(plans.length);   // ... one legend entry each
  await expect(page.locator('#donut-legend')).toContainText('Core');
  await expect(page.locator('#donut-center-val')).not.toHaveText('—');
  await expect(page.locator('#expiry-title')).toHaveText('Subscriptions expiring');
  expect(errors).toEqual([]);
});

test('the three expiry rows show the numbers the rule gives and link to the Organizations filter', async ({ page, request }) => {
  const errors = await openDashboard(page);
  const exp = await expected(request);
  expect([exp.today, exp.within_7_days, exp.within_30_days]).toEqual([2, 5, 7]);       // the seed, so a wrong rule cannot hide behind itself
  await expect(page.locator('#exp-today')).toHaveText(String(exp.today));
  await expect(page.locator('#exp-7d')).toHaveText(String(exp.within_7_days));
  await expect(page.locator('#exp-30d')).toHaveText(String(exp.within_30_days));
  for (const k of KEYS) await expect(page.locator('#exp-row-' + k)).toHaveAttribute('href', 'organizations.html?expiring=' + k);
  await expect(page.locator('#exp-row-today')).toHaveAttribute('aria-label', /Today: 2 organizations\. Open the list/);
  await expect(page.locator('.expiry-row .expiry-label')).toHaveText(['Today', 'Next 7 days', 'Next 30 days']);
  expect(errors).toEqual([]);
});

test('the Today row is highlighted only while its count is above zero', async ({ page, request }) => {
  await openDashboard(page);
  await expect(page.locator('#exp-row-today')).toHaveClass(/\bhot\b/);
  await expect(page.locator('#exp-row-7d')).not.toHaveClass(/\bhot\b/);
  await expect(page.locator('#exp-row-30d')).not.toHaveClass(/\bhot\b/);
  await expiryState(request, { on: true, today: istToday(), hideToday: true });
  await page.reload();
  await expect(page.locator('#exp-today')).toHaveText('0');
  await expect(page.locator('#exp-row-today')).not.toHaveClass(/\bhot\b/);
  await expect(page.locator('#exp-row-today')).toHaveAttribute('aria-label', /Today: 0 organizations/);
  await expect(page.locator('#exp-7d')).toHaveText('3');                                 // tomorrow, +5 (inactive), +7
});

test('an old backend without the expiring block shows dashes and no script error', async ({ page, request }) => {
  await expiryState(request, { on: true, today: istToday(), expiring: false });
  const errors = await openDashboard(page);
  for (const k of KEYS) {
    await expect(page.locator('#exp-' + k)).toHaveText('—');
    await expect(page.locator('#exp-row-' + k)).not.toHaveClass(/\bhot\b/);
  }
  await expect(page.locator('#exp-row-today')).toHaveAttribute('aria-label', 'Today. Open the list');
  await page.locator('#exp-row-7d').click();                                              // the link still works
  await expect(page.locator('#expiry-filter')).toHaveValue('7d');
  expect(errors).toEqual([]);
});

/* ───────────────────────────── dashboard -> Organizations: the numbers must match ───────────────────────────── */
for (const key of KEYS) {
  test('clicking "' + key + '" opens Organizations with the filter and EXACTLY the promised rows, soonest first', async ({ page, request }) => {
    const errors = await openDashboard(page);
    const exp = await expected(request);
    const promised = Number((await page.locator('#exp-' + key).textContent()).trim());
    expect(promised).toBe(key === 'today' ? exp.today : key === '7d' ? exp.within_7_days : exp.within_30_days);

    await page.locator('#exp-row-' + key).click();
    await page.waitForURL(new RegExp('organizations\\.html\\?expiring=' + key + '$'));
    await expect(page.locator('#expiry-filter')).toHaveValue(key);
    await expect(rowsOf(page)).toHaveCount(promised);                                     // the key consistency check
    await expect(page.locator('#table-count')).toHaveText(new RegExp('^' + promised + ' org'));
    const names = await namesOf(page);
    expect(names).toEqual(orderedNames(exp, key));                                        // soonest end date first, then name
    for (const n of NEVER_LISTED) expect(names).not.toContain(n);                         // deleted, free trial, expired, no date, outside the window
    const hint = page.locator('#expiry-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText(key === 'today' ? 'ends today' : key === '7d' ? 'within the next 7 days (today included)' : 'within the next 30 days (today included)');
    await expect(hint.locator('b')).toHaveText(String(promised));
    expect(errors).toEqual([]);
  });
}

test('window edges: tomorrow and +7 are in 7 days, +8 is not; +30 is in 30 days, +31 is not; a deactivated organization still counts', async ({ page, request }) => {
  await login(page);
  const errors = collectErrors(page);
  await page.goto('/pages/organizations.html?expiring=7d');
  await expect(rowsOf(page).first()).toBeVisible();
  const week = await namesOf(page);
  expect(week).toEqual(['Second Today', 'Today Traders', 'Tomorrow Foods', 'Inactive Five', 'Week Mart']);
  await page.locator('#expiry-filter').selectOption('30d');
  const month = await namesOf(page);
  expect(month).toEqual([...week, 'Eight Day Stores', 'Month Works']);
  expect(errors).toEqual([]);
});

/* ───────────────────────────── the filter on the Organizations page ───────────────────────────── */
test('Clear filter removes the filter, the hint and the ?expiring parameter and shows every organization', async ({ page }) => {
  await login(page);
  const errors = collectErrors(page);
  await page.goto('/pages/organizations.html?expiring=today');
  await expect(rowsOf(page)).toHaveCount(2);
  await page.locator('#expiry-hint button').click();
  await expect(page.locator('#expiry-filter')).toHaveValue('');
  await expect(page.locator('#expiry-hint')).toBeHidden();
  expect(new URL(page.url()).search).toBe('');
  await expect(rowsOf(page)).toHaveCount(12);
  expect(errors).toEqual([]);
});

test('Refresh resets the filter', async ({ page }) => {
  await login(page);
  await page.goto('/pages/organizations.html?expiring=30d');
  await expect(rowsOf(page)).toHaveCount(7);
  await page.locator('.topbar-actions button[onclick="loadOrgs()"]').click();
  await expect(rowsOf(page)).toHaveCount(12);
  await expect(page.locator('#expiry-filter')).toHaveValue('');
  await expect(page.locator('#expiry-hint')).toBeHidden();
});

test('choosing the filter by hand works and is not tied to the link', async ({ page }) => {
  await login(page);
  await page.goto('/pages/organizations.html');
  await expect(rowsOf(page)).toHaveCount(12);
  await expect(page.locator('#expiry-hint')).toBeHidden();
  await page.locator('#expiry-filter').selectOption('7d');
  await expect(rowsOf(page)).toHaveCount(5);
  await expect(page.locator('#expiry-hint')).toContainText('within the next 7 days');
  await page.locator('#expiry-filter').selectOption('');
  await expect(rowsOf(page)).toHaveCount(12);
  await expect(page.locator('#expiry-hint')).toBeHidden();
});

test('it combines with the other filters and with a chosen sort', async ({ page }) => {
  await login(page);
  await page.goto('/pages/organizations.html?expiring=30d');
  await expect(rowsOf(page)).toHaveCount(7);
  await page.locator('#search-input').fill('mart');
  await expect(rowsOf(page)).toHaveCount(1);
  await expect(page.locator('#orgs-tbody .org-name-text')).toHaveText('Week Mart');
  await page.locator('#search-input').fill('');
  await page.locator('#status-filter').selectOption('EXPIRED');                          // paid-and-expiring AND expired = nothing
  await expect(rowsOf(page)).toHaveCount(0);
  await page.locator('#status-filter').selectOption('');
  await page.locator('#sort-by').selectOption('employees');                              // a chosen sort wins over "soonest first"
  const names = await namesOf(page);
  expect(names[0]).toBe('Month Works');                                                  // most employees among the 7 (the mock gives later rows more staff)
});

test('an unknown ?expiring value is ignored', async ({ page }) => {
  await login(page);
  const errors = collectErrors(page);
  await page.goto('/pages/organizations.html?expiring=foo');
  await expect(rowsOf(page)).toHaveCount(12);
  await expect(page.locator('#expiry-filter')).toHaveValue('');
  await expect(page.locator('#expiry-hint')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the empty result of a window says so', async ({ page, request }) => {
  await expiryState(request, { on: true, today: istToday(), hideToday: true });
  await login(page);
  await page.goto('/pages/organizations.html?expiring=today');
  await expect(rowsOf(page)).toHaveCount(0);
  await expect(page.locator('#orgs-tbody')).toContainText('No organizations found');
  await expect(page.locator('#expiry-hint b')).toHaveText('0');
});

/* ───────────────────────────── today in India, not in the browser ───────────────────────────── */
test.describe('browser in a far-away time zone', () => {
  test.use({ timezoneId: 'Pacific/Pago_Pago' });                                          // UTC-11: its date differs from India's for half the day
  for (const key of KEYS) {
    test('the "' + key + '" list still equals the dashboard count', async ({ page, request }) => {
      const errors = await openDashboard(page);
      const exp = await expected(request);
      const promised = Number((await page.locator('#exp-' + key).textContent()).trim());
      await page.locator('#exp-row-' + key).click();
      await expect(rowsOf(page)).toHaveCount(promised);
      expect(await namesOf(page)).toEqual(orderedNames(exp, key));
      expect(errors).toEqual([]);
    });
  }
});

/* ───────────────────────────── phone width ───────────────────────────── */
test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('dashboard and filtered Organizations have no horizontal overflow', async ({ page }) => {
    const errors = await openDashboard(page);
    await expect(page.locator('#exp-today')).toHaveText('2');
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.locator('#expiry-list').scrollIntoViewIfNeeded();
    await shot(page, 'dashboard-phone');
    await page.goto('/pages/organizations.html?expiring=7d');
    await expect(rowsOf(page).first()).toBeVisible();
    await expect(page.locator('#expiry-hint')).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await shot(page, 'organizations-expiring-phone');
    expect(errors).toEqual([]);
  });
});

test('screenshots of the dashboard and the filtered list (desktop)', async ({ page }) => {
  test.skip(!SHOTS, 'set EXPIRY_SHOTS_DIR to save screenshots');
  await openDashboard(page);
  await page.locator('#expiry-list').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot(page, 'dashboard-desktop');
  await page.goto('/pages/organizations.html?expiring=7d');
  await expect(rowsOf(page).first()).toBeVisible();
  await shot(page, 'organizations-expiring-desktop');
});
