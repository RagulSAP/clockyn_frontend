'use strict';
/* Admin web console: pages/referrals.html (C2C Referral / B2C Referral tabs) against e2e/console/operator-mock.js + referral-mock.js. */
const { test, expect } = require('@playwright/test');

const API = 'http://127.0.0.1:' + (process.env.CONSOLE_API_PORT || 8891);

async function mockState(request, body) {
  const r = await request.post(API + '/__op/state', { data: body });
  expect(r.ok()).toBeTruthy();
}
const mockLog = async (request) => (await request.get(API + '/__op/requests')).json();

test.beforeEach(async ({ page, request }) => {
  await mockState(request, { reset: true });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
});

async function login(page, email) {
  await page.goto('/pages/login.html');
  await page.locator('#email').fill(email);
  await page.locator('#loginBtn').click();
  await expect(page.locator('#otpGroup')).toBeVisible();
  await page.locator('.otp-box').first().click();
  await page.keyboard.type('123456');
  await page.locator('#loginBtn').click();
  await page.waitForURL(/dashboard\.html$/);
}
async function openPage(page, email = 'admin@clockyn.test') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page, email);
  await page.goto('/pages/referrals.html');
  await expect(page.locator('#disc-card')).toContainText('Referral discount');
  return errors;
}
const tab = (page, name) => page.locator('#tab-' + name);

test('two tabs: C2C Referral is the default, B2C Referral lists the promoter codes', async ({ page }) => {
  const errors = await openPage(page);
  await expect(tab(page, 'c2c')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#pane-b2c')).toBeHidden();
  await expect(page.locator('#kpis')).toContainText('Total referrals');
  await tab(page, 'b2c').click();
  await expect(tab(page, 'b2c')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#pane-c2c')).toBeHidden();
  await expect(page.locator('#b-body')).toContainText('TECH55');
  await expect(page.locator('#b-body')).toContainText('Tech With Ravi');
  await expect(page.locator('#b-body')).toContainText('15% off');
  await expect(page.locator('#b-body')).toContainText('30 days');
  await expect(page.locator('#b-body')).toContainText('10% of first plan');
  await expect(page.locator('#b-kpis')).toContainText('Commission due');
  await tab(page, 'c2c').click();
  await expect(page.locator('#pane-c2c')).toBeVisible();
  expect(errors).toEqual([]);
});

test('C2C discount percent comes from the server and a super admin can change it', async ({ page, request }) => {
  await openPage(page);
  await expect(page.locator('#disc-card')).toContainText('10% off');
  await page.locator('#disc-edit').click();
  await expect(page.locator('#cfg-modal')).toHaveClass(/open/);
  await expect(page.locator('#cfg-percent')).toHaveValue('10');
  await page.locator('#cfg-percent').fill('80');
  await page.locator('#cfg-save').click();
  await expect(page.locator('#cfg-err')).toContainText('whole number from 1 to 50');
  await page.locator('#cfg-percent').fill('12');
  await page.locator('#cfg-save').click();
  await expect(page.locator('#cfg-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#disc-card')).toContainText('12% off');
  await page.reload();
  await expect(page.locator('#disc-card')).toContainText('12% off');
  const puts = (await mockLog(request)).filter((r) => r.method === 'PUT' && r.path === '/gen-dashboard/referrals/config');
  expect(puts.length).toBe(1);
});

test('Escape closes the dialog and the page works from the keyboard', async ({ page }) => {
  await openPage(page);
  await page.locator('#disc-edit').click();
  await expect(page.locator('#cfg-modal')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#cfg-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#disc-edit')).toBeFocused();
});

test('a super admin creates a promoter code; client rules and a duplicate code are refused', async ({ page, request }) => {
  await openPage(page);
  await tab(page, 'b2c').click();
  await expect(page.locator('#b-body')).toContainText('TECH55');
  await page.locator('#b-new').click();
  await expect(page.locator('#pf-modal')).toHaveClass(/open/);

  /* nothing is sent while the form is invalid */
  await page.locator('#pf-code').fill('ab');
  await page.locator('#pf-save').click();
  await expect(page.locator('#pf-code-err')).toContainText('exactly 6 letters or digits');
  await expect(page.locator('#pf-platform-err')).toContainText('Choose a platform');
  await expect(page.locator('#pf-channel-err')).toContainText('Enter the channel name');
  await expect(page.locator('#pf-percent-err')).toContainText('whole number from 1 to 50');
  expect((await mockLog(request)).filter((r) => r.method === 'POST' && r.path === '/gen-dashboard/referrals/b2c').length).toBe(0);

  /* the code box upper-cases and drops characters that are not A-Z / 0-9 */
  await page.locator('#pf-code').fill('insta-9x!');
  await expect(page.locator('#pf-code')).toHaveValue('INSTA9');
  await page.locator('#pf-platform').selectOption('instagram');
  await page.locator('#pf-channel').fill('Reels by Meera');
  await page.locator('#pf-contact').fill('Meera');
  await page.locator('#pf-phone').fill('98765 11111');
  await page.locator('#pf-email').fill('meera@example.com');
  await page.locator('#pf-percent').fill('20');
  await page.locator('#pf-days').fill('45');
  await page.locator('#pf-ctype').selectOption('fixed');
  await page.locator('#pf-cvalue').fill('500');
  await page.locator('#pf-save').click();
  await expect(page.locator('#pf-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#toast')).toContainText('INSTA9');
  await expect(page.locator('#b-body')).toContainText('Reels by Meera');
  await expect(page.locator('#b-body')).toContainText('₹500 per paid customer');
  await expect(page.locator('#b-body')).toContainText('45 days');

  /* the same code again: the server's 409 is shown at the code field */
  await page.locator('#b-new').click();
  await page.locator('#pf-code').fill('INSTA9');
  await page.locator('#pf-platform').selectOption('youtube');
  await page.locator('#pf-channel').fill('Another');
  await page.locator('#pf-percent').fill('10');
  await page.locator('#pf-save').click();
  await expect(page.locator('#pf-code-err')).toContainText('already in use');
  await expect(page.locator('#pf-modal')).toHaveClass(/open/);
});

test('editing keeps the code fixed and can deactivate a promoter', async ({ page }) => {
  await openPage(page);
  await tab(page, 'b2c').click();
  await page.locator('button[data-edit="1"]').click();
  await expect(page.locator('#pf-code')).toHaveValue('TECH55');
  await expect(page.locator('#pf-code')).toHaveJSProperty('readOnly', true);
  await expect(page.locator('#pf-percent')).toHaveValue('15');
  await expect(page.locator('#pf-days')).toHaveValue('30');
  await page.locator('#pf-days').fill('');
  await page.locator('#pf-status').selectOption('inactive');
  await page.locator('#pf-save').click();
  await expect(page.locator('#pf-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#b-body')).toContainText('Inactive');
  await expect(page.locator('#b-body')).toContainText('No expiry');
  await page.locator('#b-status').selectOption('active');
  await expect(page.locator('#b-body')).toContainText('No matching promoter codes');
});

test('the detail view shows customers, insights and the ledger; a payout reduces the commission due', async ({ page }) => {
  await openPage(page);
  await tab(page, 'b2c').click();
  await page.locator('button[data-open="1"]').click();
  const detail = page.locator('#pd-body');
  await expect(page.locator('#pd-modal')).toHaveClass(/open/);
  await expect(detail).toContainText('TECH55');
  await expect(detail).toContainText('Sharma Traders');
  await expect(detail).toContainText('Green Mart');
  await expect(detail).toContainText('Expired');
  await expect(detail).toContainText('ravi@example.com');
  await expect(detail).toContainText('No payouts recorded yet');
  await expect(detail.locator('.ins', { hasText: 'Due' })).toContainText('₹490');
  await expect(detail.locator('a[href="https://youtube.com/@techwithravi"]')).toHaveAttribute('rel', /noopener/);

  await page.locator('#pd-payout').click();
  await expect(page.locator('#pp-amount')).toHaveValue('490');
  await page.locator('#pp-amount').fill('900');
  await page.locator('#pp-save').click();
  await expect(page.locator('#pp-amount-err')).toContainText('cannot be more than the commission due');
  await page.locator('#pp-amount').fill('200');
  await page.locator('#pp-ref').fill('UTR123');
  await page.locator('#pp-save').click();
  await expect(page.locator('#pp-modal')).not.toHaveClass(/open/);
  await expect(detail).toContainText('UTR123');
  await expect(detail.locator('.ins', { hasText: 'Due' })).toContainText('₹290');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pd-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#b-body')).toContainText('₹290');
});

test('a normal operator sees everything read-only: no edit, create or payout buttons', async ({ page }) => {
  await openPage(page, 'staff@clockyn.test');
  await expect(page.locator('#disc-card')).toContainText('10% off');
  await expect(page.locator('#disc-edit')).toHaveCount(0);
  await tab(page, 'b2c').click();
  await expect(page.locator('#b-body')).toContainText('TECH55');
  await expect(page.locator('#b-new')).toBeHidden();
  await expect(page.locator('button[data-edit]')).toHaveCount(0);
  await page.locator('button[data-open="1"]').click();
  await expect(page.locator('#pd-body')).toContainText('Sharma Traders');
  await expect(page.locator('#pd-payout')).toHaveCount(0);
  await expect(page.locator('#pd-body button', { hasText: 'Edit' })).toHaveCount(0);
});

test('B2C search filters the list through the server', async ({ page, request }) => {
  await openPage(page);
  await tab(page, 'b2c').click();
  await expect(page.locator('#b-body')).toContainText('TECH55');
  await page.locator('#b-search').fill('zzzz');
  await expect(page.locator('#b-body')).toContainText('No matching promoter codes');
  const gets = (await mockLog(request)).filter((r) => r.path === '/gen-dashboard/referrals/b2c' && r.method === 'GET');
  expect(gets.length).toBeGreaterThanOrEqual(2);
});

/* ── void payout ── */
async function openDetailWithPayouts(page, amounts) {
  await tab(page, 'b2c').click();
  await page.locator('button[data-open="1"]').click();
  await expect(page.locator('#pd-modal')).toHaveClass(/open/);
  for (const amount of amounts) {
    await page.locator('#pd-payout').click();
    await page.locator('#pp-amount').fill(String(amount));
    await page.locator('#pp-ref').fill('UTR' + amount);
    await page.locator('#pp-save').click();
    await expect(page.locator('#pp-modal')).not.toHaveClass(/open/);
    await expect(page.locator('#pd-body')).toContainText('UTR' + amount);
  }
}
const dueTile = (page) => page.locator('#pd-body .ins', { hasText: 'Due' });
const paidTile = (page) => page.locator('#pd-body .ins').filter({ has: page.getByText('Paid', { exact: true }) });

test('a super admin voids a payout: the amount is due again and the row shows Voided', async ({ page, request }) => {
  const errors = await openPage(page);
  await openDetailWithPayouts(page, [200]);
  await expect(dueTile(page)).toContainText('₹290');
  await expect(paidTile(page)).toContainText('₹200');
  await expect(page.locator('#pd-body button[data-void-payout]')).toHaveCount(1);

  await page.locator('#pd-body button[data-void-payout]').click();
  await expect(page.locator('#vp-modal')).toHaveClass(/open/);
  await expect(page.locator('#vp-text')).toContainText('Void this payout of ₹200');
  await expect(page.locator('#vp-text')).toContainText('The amount will count as due again.');
  await expect(page.locator('#vp-reason')).toBeFocused();
  await page.locator('#vp-reason').fill('Wrong <b>amount</b>');
  await page.locator('#vp-confirm').click();

  await expect(page.locator('#vp-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#toast')).toContainText('Payout voided');
  const row = page.locator('#pd-body tr.row-voided');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Voided');
  await expect(row).toContainText('Wrong <b>amount</b>');                         /* shown as text, never as markup */
  await expect(row.locator('b')).toHaveCount(0);
  await expect(row.locator('.amt')).toHaveCSS('text-decoration-line', 'line-through');
  await expect(page.locator('#pd-body button[data-void-payout]')).toHaveCount(0);   /* a voided row has no Void button */
  await expect(dueTile(page)).toContainText('₹490');
  await expect(paidTile(page)).toContainText('₹0');
  await expect(paidTile(page)).toContainText('0 payouts, 1 voided');

  await expect(row).toContainText('Voided by admin@clockyn.test');
  const posts = (await mockLog(request)).filter((r) => r.method === 'POST' && /\/payouts\/1\/void$/.test(r.path));
  expect(posts.length).toBe(1);

  /* the promoter table behind the dialog shows the new due amount too */
  await page.keyboard.press('Escape');
  await expect(page.locator('#pd-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#b-body')).toContainText('₹490');
  expect(errors).toEqual([]);
});

test('the void dialog: Escape closes it and focus returns; an empty reason shows no reason; Cancel sends nothing', async ({ page, request }) => {
  await openPage(page);
  await openDetailWithPayouts(page, [100]);
  const btn = page.locator('#pd-body button[data-void-payout]');
  await btn.click();
  await expect(page.locator('#vp-modal')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#vp-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#pd-modal')).toHaveClass(/open/);                       /* only the top-most dialog closed */
  await expect(btn).toBeFocused();
  await btn.click();
  await page.locator('#vp-cancel').click();
  await expect(page.locator('#vp-modal')).not.toHaveClass(/open/);
  expect((await mockLog(request)).filter((r) => /\/void$/.test(r.path)).length).toBe(0);
  await btn.click();
  await page.locator('#vp-confirm').click();
  await expect(page.locator('#pd-body tr.row-voided')).toHaveCount(1);
  await expect(page.locator('#pd-body tr.row-voided')).not.toContainText(' - ');      /* no reason: the server stored none and the row shows none */
  expect((await mockLog(request)).filter((r) => /\/void$/.test(r.path)).length).toBe(1);
});

test('voiding a payout that is already voided shows the server message and refreshes the ledger', async ({ page, request }) => {
  await openPage(page);
  await openDetailWithPayouts(page, [200]);
  await page.locator('#pd-body button[data-void-payout]').click();
  /* the payout is voided behind the page's back (another operator) before this dialog is confirmed */
  const other = await request.post(API + '/gen-dashboard/referrals/b2c/1/payouts/1/void', { data: {}, headers: { 'x-admin-id': 'admin@clockyn.test' } });
  expect(other.ok()).toBeTruthy();
  await page.locator('#vp-confirm').click();
  await expect(page.locator('#toast')).toContainText('This payout is already voided');
  await expect(page.locator('#vp-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#pd-body tr.row-voided')).toHaveCount(1);              /* the ledger now shows the current state */
  await expect(page.locator('#pd-body button[data-void-payout]')).toHaveCount(0);
  await expect(dueTile(page)).toContainText('₹490');
});

test('a normal operator sees payouts (voided ones greyed) but no Void button', async ({ page, request }) => {
  await openPage(page);
  await openDetailWithPayouts(page, [200, 50]);
  await page.locator('#pd-body button[data-void-payout]').first().click();
  await page.locator('#vp-confirm').click();
  await expect(page.locator('#pd-body tr.row-voided')).toHaveCount(1);
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await openPage(page, 'staff@clockyn.test');
  await tab(page, 'b2c').click();
  await page.locator('button[data-open="1"]').click();
  await expect(page.locator('#pd-body tr.row-voided')).toHaveCount(1);
  await expect(page.locator('#pd-body tr.row-voided')).toContainText('Voided');
  await expect(page.locator('#pd-body button[data-void-payout]')).toHaveCount(0);
  await expect(page.locator('#pd-body button', { hasText: 'Void' })).toHaveCount(0);
  /* and the server refuses the call anyway */
  const denied = await request.post(API + '/gen-dashboard/referrals/b2c/1/payouts/2/void', { data: {}, headers: { 'x-admin-id': 'staff@clockyn.test' } });
  expect(denied.status()).toBe(403);
});
