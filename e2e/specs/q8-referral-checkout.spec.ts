/**
 * Q8 - Referral reward on the payment summary (contract: referral_contract.md). The reward card sits right next to the coupon
 * box; Apply asks the server to price the order with `apply_referral` (10 % off the staff charge after credit, Prime / Elite
 * only, never together with a coupon); Pay creates the order with the flag and no coupon.
 *
 * Mock facts: org-0001 starts with ONE available reward; catalogue 1/2/3 = Core 25 x 6 mo, Prime 40 x 12 mo, Elite 60 x 12 mo.
 * 15 staff on Prime: 15 x 40 x 12 = 7,200 -> reward 720 -> 6,480 + GST 1,166 = 7,646 (without it: 7,200 + 1,296 = 8,496).
 * Set E2E_SHOTS_DIR to also save phone screenshots (light + dark) of the interesting states.
 */
import path from 'node:path';

import type { Page, TestInfo } from '@playwright/test';

import { expect, expectToast, loginAs, USERS, visit, test } from '../support';
import { hasHorizontalOverflow } from '../support/q1';
import { WORKED_CATALOGUE } from '../support/q1b';

const CHECKOUT = '/admin/billing/checkout';
const SHOTS = process.env.E2E_SHOTS_DIR;
const CORE_REASON = 'Referral rewards are valid on Prime and Elite plans only';
const CONFLICT = "A coupon and a referral reward can't be combined";

type Mock = import('../support').MockClient;
type Body = Record<string, unknown>;

/** Polls the body field of the most recent `/orders/quote` request (the screen re-quotes ~300 ms after a change). */
const lastQuoteField = (mock: Mock, field: string) => async (): Promise<unknown> => ((await mock.lastRequest('/orders/quote'))?.body as Body | undefined)?.[field];

type Params = { mode: string; planId?: number; staff?: number };

async function openCheckout(page: Page, params: Params): Promise<void> {
  await visit(page, CHECKOUT, params);
  await expect(page.getByTestId('pay-button')).toBeEnabled();
  await expect(page.getByTestId('row-grand-total')).toBeVisible();
}

/** Saves a screenshot (light and dark) when E2E_SHOTS_DIR is set. */
async function shoot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (!SHOTS) return;
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(SHOTS, `${testInfo.project.name}-${name}-${scheme}.png`), fullPage: true });
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

test.describe('Q8 referral reward at checkout', () => {
  test.beforeEach(async ({ mock, page }) => {
    await mock.setState({ catalogue: WORKED_CATALOGUE, subscription: { staff_limit: 10 } });
    await mock.setPlan('none');
    await loginAs(page, 'admin');
  });

  test('Prime: the reward option is shown right next to the coupon box with the number available', async ({ page }, testInfo) => {
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    const card = page.getByTestId('referral-reward-card');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('referral-title')).toHaveText('Referral reward — 10% off');
    await expect(page.getByTestId('referral-available')).toHaveText('1 available');
    await expect(page.getByTestId('referral-apply')).toBeEnabled();
    await expect(page.getByTestId('referral-apply')).toHaveAccessibleName('Apply referral reward');
    // beside the coupon option: the card starts right under the coupon entry (same column, no other section in between)
    const coupon = (await page.getByTestId('coupon-input').boundingBox())!;
    const box = (await card.boundingBox())!;
    expect(box.y).toBeGreaterThan(coupon.y);
    expect(box.y - (coupon.y + coupon.height)).toBeLessThan(120);
    expect(Math.abs(box.x - coupon.x)).toBeLessThan(40);
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await expect(page.getByTestId('row-referral-discount')).toHaveCount(0);
    await shoot(page, testInfo, 'offer');
  });

  test('Apply changes the total from the SERVER quote; Remove puts it back', async ({ page, mock }, testInfo) => {
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹8,496');
    await page.getByTestId('referral-apply').click();
    await expect(page.getByTestId('referral-remove')).toBeVisible();
    await expect(page.getByTestId('referral-applied')).toContainText('Applied ✓');
    await expect(page.getByTestId('row-referral-discount')).toHaveText('− ₹720');
    await expect(page.getByText('Referral reward (10%)', { exact: true })).toBeVisible();
    await expect(page.getByTestId('row-subtotal')).toHaveText('₹6,480');
    await expect(page.getByTestId('row-gst')).toHaveText('₹1,166');
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹7,646');
    await expect(page.getByTestId('pay-button')).toContainText('Pay ₹7,646');
    const quote = await mock.lastRequest('/orders/quote');
    expect(quote?.body).toMatchObject({ user_id: USERS.admin.userId, org_id: 'org-0001', plan_id: 2, staff_limit: 15, mode: 'new', apply_referral: true, coupon_code: null });
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await shoot(page, testInfo, 'applied');

    await page.getByTestId('referral-remove').click();
    await expect(page.getByTestId('referral-apply')).toBeVisible();
    await expect(page.getByTestId('row-referral-discount')).toHaveCount(0);
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹8,496');
    await expect(page.getByTestId('pay-button')).toContainText('Pay ₹8,496');
    await expect.poll(lastQuoteField(mock, 'apply_referral')).toBeUndefined();
  });

  test('Pay creates the order with apply_referral and no coupon for the discounted total; the reward is then used up', async ({ page, mock }) => {
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    await page.getByTestId('referral-apply').click();
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹7,646');
    await mock.clearRequests();
    await page.getByTestId('pay-button').click();
    await expect(page.getByText('Payment Successful!')).toBeVisible();
    const order = await mock.waitForRequest('/orders/create', { method: 'POST' });
    expect(order.body).toMatchObject({ plan_id: 2, amount: 7646, staff_limit: 15, mode: 'new', apply_referral: true, coupon_code: null });
    expect(order.status).toBe(200);
    expect(await mock.requests({ path: '/payments/verify' })).toHaveLength(1);

    // the one reward is consumed by the payment: the renewal checkout no longer offers it
    await page.getByTestId('go-dashboard').click();
    await page.waitForURL((u) => u.pathname === '/admin/home');
    await openCheckout(page, { mode: 'renew', staff: 15 });
    await expect(page.getByTestId('coupon-section')).toBeVisible();
    await expect(page.getByTestId('referral-reward-card')).toHaveCount(0);
  });

  test('Core: the option is disabled and says why; the server never receives apply_referral', async ({ page, mock }, testInfo) => {
    await openCheckout(page, { mode: 'new', planId: 1, staff: 15 });
    await expect(page.getByTestId('referral-reward-card')).toBeVisible();
    await expect(page.getByTestId('referral-apply')).toBeDisabled();
    await expect(page.getByTestId('referral-message')).toHaveText(CORE_REASON);
    await expect(page.getByTestId('referral-apply')).toHaveAccessibleName(`Apply referral reward, unavailable. ${CORE_REASON}`);
    await page.getByTestId('referral-apply').click({ force: true }).catch(() => undefined);
    await expect(page.getByTestId('referral-remove')).toHaveCount(0);
    expect((await mock.requests({ path: '/orders/quote' })).every((r) => !(r.body as Record<string, unknown>).apply_referral)).toBe(true);
    await shoot(page, testInfo, 'core-disabled');

    // switching from Prime (applied) to Core is a fresh checkout: nothing is carried over
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    await page.getByTestId('referral-apply').click();
    await expect(page.getByTestId('row-referral-discount')).toBeVisible();
    await openCheckout(page, { mode: 'new', planId: 1, staff: 15 });
    await expect(page.getByTestId('row-referral-discount')).toHaveCount(0);
    await expect(page.getByTestId('referral-apply')).toBeDisabled();
  });

  test('applying a coupon removes the reward, applying the reward removes the coupon (one inline note)', async ({ page, mock }, testInfo) => {
    await mock.setState({ coupon: { coupon_name: 'FLAT500', discount: 0, discount_type: 'flat', flat_amount: 500, max_discount: null, min_amount: null } });
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    await page.getByTestId('referral-apply').click();
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹7,646');

    // coupon wins: the reward is dropped
    await page.getByTestId('coupon-input').fill('flat500');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByTestId('coupon-badge')).toContainText('FLAT500 (₹500 off)');
    await expect(page.getByTestId('referral-remove')).toHaveCount(0);
    await expect(page.getByTestId('referral-apply')).toBeVisible();
    await expect(page.getByTestId('referral-note')).toHaveText(CONFLICT);
    await expect(page.getByTestId('row-referral-discount')).toHaveCount(0);
    await expect(page.getByTestId('row-discount')).toHaveText('- ₹500');
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹7,906');
    await expect.poll(lastQuoteField(mock, 'coupon_code')).toMatch(/^flat500$/i);
    await expect.poll(lastQuoteField(mock, 'apply_referral')).toBeUndefined();
    await shoot(page, testInfo, 'coupon-wins');

    // reward wins: the coupon is dropped
    await page.getByTestId('referral-apply').click();
    await expect(page.getByTestId('referral-remove')).toBeVisible();
    await expect(page.getByTestId('coupon-badge')).toHaveCount(0);
    await expect(page.getByTestId('row-discount')).toHaveCount(0);
    await expect(page.getByTestId('referral-note')).toHaveText(CONFLICT);
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹7,646');
    await expect.poll(lastQuoteField(mock, 'apply_referral')).toBe(true);
    await expect.poll(lastQuoteField(mock, 'coupon_code')).toBeNull();
    await shoot(page, testInfo, 'reward-wins');
    expect(await hasHorizontalOverflow(page)).toBe(false);

    // the order carries the reward and no coupon
    await mock.clearRequests();
    await page.getByTestId('pay-button').click();
    await expect(page.getByText('Payment Successful!')).toBeVisible();
    expect((await mock.lastRequest('/orders/create'))?.body).toMatchObject({ apply_referral: true, coupon_code: null, amount: 7646 });
  });

  test('a 400 on create (reward refused) shows the message, drops the reward and refreshes the quote', async ({ page, mock, issues }) => {
    issues.allow(/orders\/create/);
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    await page.getByTestId('referral-apply').click();
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹7,646');
    await mock.failNext('/orders/create', { status: 400, body: { detail: 'No referral reward available' } });
    await mock.clearRequests();
    await page.getByTestId('pay-button').click();
    await expectToast(page, 'No referral reward available');
    await expect(page.getByTestId('referral-remove')).toHaveCount(0);
    await expect(page.getByTestId('referral-note')).toHaveText('No referral reward available');
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹8,496');
    await expect(page.getByTestId('pay-button')).toBeEnabled();
    await expect.poll(lastQuoteField(mock, 'apply_referral')).toBeUndefined();
    expect(await mock.requests({ path: '/payments/verify' })).toHaveLength(0);
  });

  test('a capacity upgrade offers no reward and never asks the server for one', async ({ page, mock }) => {
    await mock.setPlan('core');
    await openCheckout(page, { mode: 'upgrade', staff: 15 });
    await expect(page.getByTestId('price-breakdown')).toBeVisible();
    await expect(page.getByTestId('referral-reward-card')).toHaveCount(0);
    expect((await mock.requests({ path: '/orders/quote' })).every((r) => !(r.body as Record<string, unknown>).apply_referral)).toBe(true);
  });

  test('Elite qualifies as well: 10 % of 15 x 60 x 12', async ({ page }) => {
    await openCheckout(page, { mode: 'new', planId: 3, staff: 15 });
    await expect(page.getByTestId('referral-reward-card')).toBeVisible();
    await page.getByTestId('referral-apply').click();
    await expect(page.getByTestId('row-referral-discount')).toHaveText('− ₹1,080');
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹11,470'); // 10,800 - 1,080 = 9,720 + GST 1,750
  });
});
