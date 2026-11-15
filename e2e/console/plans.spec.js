'use strict';
/* Admin web console: pages/subscriptions.html, the plans section (free months + offer text) against e2e/console/operator-mock.js + plans-mock.js. */
const { test, expect } = require('@playwright/test');

const API = 'http://127.0.0.1:' + (process.env.CONSOLE_API_PORT || 8891);

async function mockState(request, body) {
  const r = await request.post(API + '/__op/state', { data: body });
  expect(r.ok()).toBeTruthy();
}
const planLog = async (request) => (await request.get(API + '/plans/__log')).json();

test.beforeEach(async ({ page, request }) => {
  await mockState(request, { reset: true });
  expect((await request.post(API + '/plans/__reset')).ok()).toBeTruthy();
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
async function openPage(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page, 'admin@clockyn.test');
  await page.goto('/pages/subscriptions.html');
  await expect(page.locator('.pt-tile').first()).toBeVisible();
  return errors;
}
const tile = (page, id) => page.locator('.pt-tile[data-plan-id="' + id + '"]');
const group = (page, key) => page.locator('.pt-group[data-plan="' + key + '"]');
const addBtn = (page) => page.locator('.page-header-actions .btn-primary');

async function fillAdd(page, v) {
  await addBtn(page).click();
  await expect(page.locator('#add-modal')).toHaveClass(/open/);
  if (v.name != null) await page.locator('#add-name').fill(v.name);
  if (v.amount != null) await page.locator('#add-amount').fill(String(v.amount));
  if (v.months != null) await page.locator('#add-months').fill(String(v.months));
  if (v.free != null) await page.locator('#add-free').fill(String(v.free));
  if (v.offer != null) await page.locator('#add-offer').fill(v.offer);
}

test('cards: one group per plan in Core, Prime, Elite, then A-Z order; durations ascending; free months and offer text shown', async ({ page }) => {
  const errors = await openPage(page);
  expect(await page.locator('.pt-group-title').allTextContents()).toEqual(['Core', 'Prime', 'Elite', 'Starter']);
  expect(await group(page, 'core').locator('.pt-badges .badge-gray').allTextContents()).toEqual(['1 month', '6 months', '1 year']);

  await expect(tile(page, 4).locator('.pt-price')).toContainText('₹49');
  await expect(tile(page, 4).locator('.pt-price')).toContainText('/ staff / month');
  await expect(tile(page, 4).locator('.badge-green')).toHaveText('1 month free');
  await expect(tile(page, 4).locator('.pt-offer')).toHaveText('Pay 5 months, get 1 free');
  await expect(tile(page, 7).locator('.badge-green')).toHaveText('2 months free');          // free months, no offer text: no offer line
  await expect(tile(page, 7).locator('.pt-offer')).toHaveCount(0);

  /* a card without free months and without offer text looks as it did before: no badge, no offer line */
  await expect(tile(page, 1).locator('.badge-green')).toHaveCount(0);
  await expect(tile(page, 1).locator('.pt-offer')).toHaveCount(0);
  await expect(tile(page, 2).locator('.badge-green')).toHaveCount(0);

  /* the Edit button says what the card holds */
  await expect(tile(page, 4).locator('.pt-btn[title="Edit plan"]')).toHaveAttribute('aria-label', 'Edit Core, 6 months, 1 month free, Pay 5 months, get 1 free');
  await expect(tile(page, 1).locator('.pt-btn[title="Edit plan"]')).toHaveAttribute('aria-label', 'Edit Core, 1 month');
  expect(errors).toEqual([]);
});

test('Add plan: live preview, counter, saves free_months and offer_text, the new card shows both', async ({ page, request }) => {
  await openPage(page);
  await fillAdd(page, { name: 'Prime', amount: 99, months: 6 });
  await expect(page.locator('#add-preview')).toHaveText('Customer pays ₹594 per staff for 6 months');          // no free months yet
  await page.locator('#add-free').fill('1');
  await expect(page.locator('#add-preview')).toHaveText('Customer pays for 5 of 6 months = ₹495 per staff');
  await expect(page.locator('#add-preview')).toHaveClass(/free/);
  await page.locator('#add-offer').fill('Pay 5 months, get 1 free');
  await expect(page.locator('#add-offer-count')).toHaveText('24 / 80');
  await expect(page.locator('#add-err')).toHaveText('');
  await page.locator('#add-modal .btn-primary').click();

  await expect(page.locator('#add-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#toast')).toHaveText('Plan added');
  const sent = (await planLog(request)).filter((x) => x.method === 'POST').pop().body;
  expect(sent).toEqual({ plan_name: 'Prime', plan_amount: 99, plan_month: 6, free_months: 1, offer_text: 'Pay 5 months, get 1 free' });
  expect(await group(page, 'prime').locator('.pt-badges .badge-gray').allTextContents()).toEqual(['1 month', '6 months']);   // same group, ascending
  const card = group(page, 'prime').locator('.pt-tile', { hasText: '6 months' });
  await expect(card.locator('.badge-green')).toHaveText('1 month free');
  await expect(card.locator('.pt-offer')).toHaveText('Pay 5 months, get 1 free');
});

test('Add plan without free months or offer text: sends 0 and null, no badge on the card', async ({ page, request }) => {
  await openPage(page);
  await fillAdd(page, { name: 'Pro', amount: 10, months: 1 });
  await expect(page.locator('#add-preview')).toHaveText('Customer pays ₹10 per staff for 1 month');
  await page.locator('#add-modal .btn-primary').click();
  await expect(page.locator('#toast')).toHaveText('Plan added');
  const sent = (await planLog(request)).filter((x) => x.method === 'POST').pop().body;
  expect(sent).toEqual({ plan_name: 'Pro', plan_amount: 10, plan_month: 1, free_months: 0, offer_text: null });
  const card = group(page, 'pro').locator('.pt-tile');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.badge-green')).toHaveCount(0);
  await expect(card.locator('.pt-offer')).toHaveCount(0);
});

test('client validation mirrors the server: free months below the duration, whole numbers, offer text length', async ({ page, request }) => {
  await openPage(page);
  await fillAdd(page, { name: 'Prime', amount: 99, months: 6, free: 6 });
  await expect(page.locator('#add-err')).toHaveText('Free months must be less than the duration (at most 5).');
  await expect(page.locator('#add-free')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#add-preview')).toHaveText('');
  await page.locator('#add-modal .btn-primary').click();                                                         // blocked: nothing is sent
  await expect(page.locator('#toast')).toHaveText('Free months must be less than the duration (at most 5).');
  await expect(page.locator('#add-modal')).toHaveClass(/open/);
  expect(await planLog(request)).toEqual([]);

  await page.locator('#add-free').fill('1.5');
  await expect(page.locator('#add-err')).toHaveText('Free months must be a whole number, 0 or more.');
  await page.locator('#add-free').fill('-1');
  await expect(page.locator('#add-err')).toHaveText('Free months must be a whole number, 0 or more.');
  await page.locator('#add-free').fill('5');                                                                      // the largest allowed
  await expect(page.locator('#add-err')).toHaveText('');
  await expect(page.locator('#add-preview')).toHaveText('Customer pays for 1 of 6 months = ₹99 per staff');

  /* offer text: the field stops typing at 80, and a longer value (pasted or set by script) is refused with the counter in red */
  await expect(page.locator('#add-offer')).toHaveAttribute('maxlength', '80');
  await page.locator('#add-offer').evaluate((el) => { el.value = 'x'.repeat(81); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#add-err')).toHaveText('Offer text can be at most 80 characters.');
  await expect(page.locator('#add-offer-count')).toHaveText('81 / 80');
  await expect(page.locator('#add-offer-count')).toHaveClass(/over/);
  await page.locator('#add-modal .btn-primary').click();
  expect(await planLog(request)).toEqual([]);

  /* required fields are checked on Save */
  await page.locator('#add-offer').fill('');
  await page.locator('#add-name').fill('');
  await page.locator('#add-modal .btn-primary').click();
  await expect(page.locator('#toast')).toHaveText('Enter the plan name.');
  await expect(page.locator('#add-name')).toBeFocused();
  expect(await planLog(request)).toEqual([]);
});

test('a duplicate plan and duration shows the server message and keeps the form open', async ({ page }) => {
  await openPage(page);
  await fillAdd(page, { name: 'core', amount: 49, months: 6, free: 1 });
  await page.locator('#add-modal .btn-primary').click();
  await expect(page.locator('#toast')).toContainText('A core plan for 6 month(s) already exists. Edit that one instead.');
  await expect(page.locator('#add-modal')).toHaveClass(/open/);
  await expect(tile(page, 4)).toBeVisible();
});

test('a server 400 is shown as the toast', async ({ page }) => {
  await openPage(page);
  await fillAdd(page, { name: 'Prime', amount: 99, months: 6, free: 1 });
  await page.route('**/plans/', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: 'free_months must be from 0 to one less than plan_month' }) }));
  await page.locator('#add-modal .btn-primary').click();
  await expect(page.locator('#toast')).toContainText('free_months must be from 0 to one less than plan_month');
});

test('Edit prefills free months and offer text; clearing the offer text sends "" and removes the line', async ({ page, request }) => {
  await openPage(page);
  await tile(page, 4).locator('.pt-btn[title="Edit plan"]').click();
  await expect(page.locator('#edit-modal')).toHaveClass(/open/);
  await expect(page.locator('#edit-name')).toHaveValue('Core');
  await expect(page.locator('#edit-months')).toHaveValue('6');
  await expect(page.locator('#edit-free')).toHaveValue('1');
  await expect(page.locator('#edit-offer')).toHaveValue('Pay 5 months, get 1 free');
  await expect(page.locator('#edit-offer-count')).toHaveText('24 / 80');
  await expect(page.locator('#edit-preview')).toHaveText('Customer pays for 5 of 6 months = ₹245 per staff');

  await page.locator('#edit-offer').fill('');
  await page.locator('#edit-modal .btn-primary').click();
  await expect(page.locator('#toast')).toHaveText('Plan updated');
  const sent = (await planLog(request)).filter((x) => x.method === 'PUT').pop();
  expect(sent.path).toBe('/plans/4');
  expect(sent.body).toEqual({ plan_name: 'Core', plan_amount: 49, plan_month: 6, free_months: 1, offer_text: '' });
  await expect(tile(page, 4).locator('.pt-offer')).toHaveCount(0);                       // the wording is gone ...
  await expect(tile(page, 4).locator('.badge-green')).toHaveText('1 month free');        // ... the free month stays

  /* an edit can also remove the free months: back to a plain card */
  await tile(page, 4).locator('.pt-btn[title="Edit plan"]').click();
  await page.locator('#edit-free').fill('0');
  await page.locator('#edit-modal .btn-primary').click();
  await expect(tile(page, 4).locator('.badge-green')).toHaveCount(0);
  expect((await planLog(request)).filter((x) => x.method === 'PUT').pop().body.free_months).toBe(0);
});

test('offer text is escaped on the card and in the Edit label', async ({ page }) => {
  const errors = await openPage(page);
  await fillAdd(page, { name: 'Prime', amount: 99, months: 6, free: 1, offer: '<b>bold</b> & "quoted"' });
  await page.locator('#add-modal .btn-primary').click();
  await expect(page.locator('#toast')).toHaveText('Plan added');
  const card = group(page, 'prime').locator('.pt-tile', { hasText: '6 months' });
  await expect(card.locator('.pt-offer')).toHaveText('<b>bold</b> & "quoted"');          // shown as text
  await expect(card.locator('.pt-offer b')).toHaveCount(0);                              // never parsed as markup
  await expect(card.locator('.pt-btn[title="Edit plan"]')).toHaveAttribute('aria-label', 'Edit Prime, 6 months, 1 month free, <b>bold</b> & "quoted"');
  expect(errors).toEqual([]);
});

test('Delete still works from a grouped card', async ({ page }) => {
  await openPage(page);
  page.once('dialog', (d) => d.accept());
  await tile(page, 9).locator('.pt-btn.del').click();
  await expect(page.locator('#toast')).toHaveText('Plan deleted');
  await expect(tile(page, 9)).toHaveCount(0);
  await expect(group(page, 'starter')).toHaveCount(0);
});
