/**
 * Q1b - Upgrade configurator + payment summary: staff stepper (min 10 / live limit), plan-change credit, renew vs staff-upgrade modes,
 * coupon, GST 18 % and the spec's worked examples (8,496 / 7,646 / 8,602 / renew 3,540 / staff-only 1,510), asserted in the UI and in
 * the `/orders/create` payload.
 */
import type { Page } from '@playwright/test';

import { expect, loginAs, visit, test, USERS } from '../support';
import { hasHorizontalOverflow, snapBoth } from '../support/q1';
import { WORKED_CATALOGUE, addMonths, fmtDate, mockToday, monthsAheadOn15th } from '../support/q1b';

const CHECKOUT = '/admin/billing/checkout';

async function clickTimes(page: Page, testId: string, n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) await page.getByTestId(testId).click();
}

/** Open the payment summary of the current configurator and return its numbers. */
async function totalsOnCheckout(page: Page): Promise<Record<string, string>> {
  await page.getByTestId('continue-pay').click();
  await page.waitForURL((u) => u.pathname === CHECKOUT);
  await expect(page.getByTestId('price-breakdown')).toBeVisible();
  const read = async (id: string) => (await page.getByTestId(id).innerText()).trim();
  return {
    staff: await read('row-staff-charge'),
    subtotal: await read('row-subtotal'),
    gst: await read('row-gst'),
    grand: await read('row-grand-total'),
    pay: (await page.getByTestId('pay-button').innerText()).replace(/\s+/g, ' ').trim(),
  };
}

test.describe('Q1b pricing - A: buy a plan with no current plan (Prime 12 months @ 40)', () => {
  test.beforeEach(async ({ mock }) => {
    await mock.setState({ catalogue: WORKED_CATALOGUE, subscription: { staff_limit: 10 } });
    await mock.setPlan('none');
  });

  test('Plan Details -> tier -> configurator (min 10, +5 = 15) -> payment summary 7,200 / 1,296 / 8,496; coupon WELCOME10 -> 7,646; payload matches', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    await page.getByTestId('action-plan-details').click();
    await page.getByTestId('tier-2').click();
    await page.getByTestId('continue-to-pay').click();
    await page.waitForURL((u) => u.pathname === '/admin/billing/upgrade' && u.searchParams.get('planId') === '2');

    const today = await mockToday(mock);
    await expect(page.getByTestId('plan-banner')).toContainText('Upgrading to: Prime');
    await expect(page.getByTestId('plan-banner')).toContainText(`Valid till ${fmtDate(addMonths(today, 12))} · ₹40/staff/month`);
    await expect(page.getByTestId('current-plan-banner')).toHaveCount(0);
    await expect(page.getByTestId('staff-hint')).toHaveText('Min 10 · Unlimited');
    await expect(page.getByTestId('staff-value')).toHaveText('10');
    await expect(page.getByTestId('staff-minus')).toBeDisabled();
    await clickTimes(page, 'staff-plus', 5);
    await expect(page.getByTestId('staff-value')).toHaveText('15');
    await expect(page.getByTestId('cost-box')).toContainText('15 × ₹40 × 12m = ₹7,200');
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await snapBoth(page, testInfo, 'upgrade-new-plan');

    const t = await totalsOnCheckout(page);
    expect(t).toMatchObject({ staff: '₹7,200', subtotal: '₹7,200', gst: '₹1,296', grand: '₹8,496', pay: 'Pay ₹8,496' });
    await expect(page.getByTestId('row-staff-charge')).toBeVisible();
    await expect(page.getByText('15 staff × ₹40/staff × 12 months')).toBeVisible();
    await expect(page.getByText('GST (18%)')).toBeVisible();
    await expect(page.getByTestId('row-credit')).toHaveCount(0);
    await expect(page.getByTestId('checkout-plan-card')).toContainText('NEW PLAN');
    await expect(page.getByTestId('checkout-plan-card')).toContainText('15 Staff');
    await snapBoth(page, testInfo, 'checkout-new-plan');

    await page.getByTestId('coupon-input').fill('welcome10');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByTestId('coupon-badge')).toContainText('WELCOME10 (10% off)');
    await expect(page.getByText('Coupon Discount (10% on ₹7,200)')).toBeVisible();
    await expect(page.getByTestId('row-discount')).toContainText('- ₹720');
    await expect(page.getByTestId('row-subtotal')).toHaveText('₹6,480');
    await expect(page.getByTestId('row-gst')).toHaveText('₹1,166');
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹7,646');
    await expect(page.getByTestId('pay-button')).toContainText('Pay ₹7,646');
    await snapBoth(page, testInfo, 'checkout-coupon-applied');

    await page.getByTestId('pay-button').click();
    const order = await mock.waitForRequest('/orders/create', { method: 'POST' });
    expect(order.body).toMatchObject({ user_id: USERS.admin.userId, org_id: 'org-0001', plan_id: 2, amount: 7646, staff_limit: 15, coupon_code: 'WELCOME10' });
  });

  test('stepper edit dialog: below the minimum snaps to 10, non-numeric is ignored, large values are accepted (no maximum)', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing/upgrade', { mode: 'new', planId: 2 });
    await page.getByTestId('staff-value').click();
    await expect(page.getByText('Minimum: 10 staff')).toBeVisible();
    await page.getByTestId('staff-input').fill('4');
    await page.getByTestId('staff-apply').click();
    await expect(page.getByTestId('staff-value')).toHaveText('10');
    await page.getByTestId('staff-value').click();
    await page.getByTestId('staff-input').fill('abc');
    await page.getByTestId('staff-apply').click();
    await expect(page.getByTestId('staff-value')).toHaveText('10');
    await page.getByTestId('staff-value').click();
    await page.getByTestId('staff-input').fill('250');
    await page.getByTestId('staff-apply').click();
    await expect(page.getByTestId('staff-value')).toHaveText('250');
    await expect(page.getByTestId('cost-box')).toContainText('250 × ₹40 × 12m = ₹1,20,000');
    await clickTimes(page, 'staff-minus', 3);
    await expect(page.getByTestId('staff-value')).toHaveText('247');
  });

  test('unknown plan id shows "Plan not found"; renew / upgrade without a plan show "Select a plan first"', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing/upgrade', { mode: 'new', planId: 99 });
    await expect(page.getByText('Plan not found')).toBeVisible();
    await visit(page, '/admin/billing/upgrade', { mode: 'renew' });
    await expect(page.getByText('Select a plan first')).toBeVisible();
    await page.getByRole('button', { name: 'Go to subscription' }).click();
    await page.waitForURL((u) => u.pathname === '/admin/billing');
  });
});

test.describe('Q1b pricing - B: change plan with credit (Core 6m @ 25 -> Prime 12m @ 40, 20 staff)', () => {
  test.beforeEach(async ({ mock }) => {
    await mock.setState({ catalogue: WORKED_CATALOGUE, subscription: { staff_limit: 12 } });
    await mock.setPlan('core');
  });

  test('configurator floor is the live limit (12), credit = 10 x 25 x 6 = 1,500; summary 9,558 and with WELCOME10 8,602', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing/upgrade', { mode: 'new', planId: 2 });
    await expect(page.getByTestId('current-plan-banner')).toContainText('Current: Core');
    await expect(page.getByTestId('current-plan-banner')).toContainText('12 staff · Valid till');
    await expect(page.getByTestId('staff-hint')).toHaveText('Current: 12 · Min 12 · Unlimited');
    await expect(page.getByTestId('staff-value')).toHaveText('12');
    await expect(page.getByTestId('staff-minus')).toBeDisabled(); // floor == live limit
    await page.getByTestId('staff-value').click();
    await expect(page.getByText('Minimum: 12 staff')).toBeVisible();
    await page.getByTestId('staff-input').fill('20');
    await page.getByTestId('staff-apply').click();
    await expect(page.getByTestId('staff-value')).toHaveText('20');
    const cost = page.getByTestId('cost-box');
    await expect(cost).toContainText('New plan cost');
    await expect(cost).toContainText('20 × ₹40 × 12m = ₹9,600');
    await expect(cost).toContainText('Credit (current plan)');
    await expect(cost).toContainText('10 × ₹25 × 6m = ₹1,500');
    await expect(cost).toContainText('You pay');
    await expect(cost).toContainText('₹8,100');
    await snapBoth(page, testInfo, 'upgrade-plan-change-credit');

    const t = await totalsOnCheckout(page);
    // afterCredit 8,100 -> GST round(1,458) -> 9,558 (no coupon)
    expect(t).toMatchObject({ staff: '₹9,600', subtotal: '₹8,100', gst: '₹1,458', grand: '₹9,558', pay: 'Pay ₹9,558' });
    await expect(page.getByTestId('row-credit')).toContainText('₹1,500');
    await snapBoth(page, testInfo, 'checkout-plan-change-credit');

    await page.getByTestId('coupon-input').fill('WELCOME10');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByText('Coupon Discount (10% on ₹8,100)')).toBeVisible();
    await expect(page.getByTestId('row-discount')).toContainText('- ₹810');
    await expect(page.getByTestId('row-subtotal')).toHaveText('₹7,290');
    await expect(page.getByTestId('row-gst')).toHaveText('₹1,312');
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹8,602');
    await page.getByTestId('pay-button').click();
    const order = await mock.waitForRequest('/orders/create', { method: 'POST' });
    expect(order.body).toMatchObject({ plan_id: 2, amount: 8602, staff_limit: 20, coupon_code: 'WELCOME10' });
  });

  test('an expired current plan earns no credit', async ({ page, mock }) => {
    await mock.setState({ plan: 'expired' });
    // `expired` keeps the paid row (plan id 3 in the mock): give that row the Core numbers for the comparison
    await mock.setState({ catalogue: [{ plan_id: 1, plan_name: 'Core', plan_amount: 25, plan_month: 6 }, { plan_id: 2, plan_name: 'Prime', plan_amount: 40, plan_month: 12 }, { plan_id: 3, plan_name: 'Core', plan_amount: 25, plan_month: 6 }] });
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing/upgrade', { mode: 'new', planId: 2 });
    await expect(page.getByTestId('staff-value')).toHaveText('12');
    await expect(page.getByTestId('cost-box')).toContainText('Credit (current plan)');
    await expect(page.getByTestId('cost-box')).toContainText('₹0');
    await expect(page.getByTestId('cost-box')).not.toContainText('10 × ₹25');
  });
});

test.describe('Q1b pricing - C: renew (current tier, 12 months, 10 staff)', () => {
  test('Core @ 25: renewal starts at 10 staff, 10 x 25 x 12 = 3,000 + GST 540 = 3,540; valid till = current end + 12 months; payload', async ({ page, mock }, testInfo) => {
    await mock.setState({ catalogue: WORKED_CATALOGUE, subscription: { staff_limit: 12 } });
    await mock.setPlan('core');
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    await page.getByTestId('action-renew').click();
    await page.waitForURL((u) => u.pathname === '/admin/billing/upgrade' && u.searchParams.get('mode') === 'renew');
    const end = (await mock.state()).today as string;
    const sub = await mock.fixtures();
    expect(sub.plan).toBe('core');
    await expect(page.getByTestId('plan-banner')).toContainText('Renewing: Core');
    await expect(page.getByTestId('plan-banner')).toContainText('RENEW');
    // an active plan renews from its end date: end_date seeded as today + 120 days
    const endDate = new Date(Date.parse(`${end}T00:00:00Z`) + 120 * 86_400_000).toISOString().slice(0, 10);
    await expect(page.getByTestId('plan-banner')).toContainText(`Valid till ${fmtDate(addMonths(endDate, 12))}`);
    await expect(page.getByTestId('staff-hint')).toHaveText('Min 10 · Unlimited');
    await expect(page.getByTestId('staff-value')).toHaveText('10'); // renewals start at the minimum, not the live limit
    await expect(page.getByTestId('cost-box')).toContainText('Renewal cost');
    await expect(page.getByTestId('cost-box')).toContainText('10 × ₹25 × 12m = ₹3,000');
    await snapBoth(page, testInfo, 'upgrade-renew');
    const t = await totalsOnCheckout(page);
    expect(t).toMatchObject({ staff: '₹3,000', subtotal: '₹3,000', gst: '₹540', grand: '₹3,540', pay: 'Pay ₹3,540' });
    await expect(page.getByTestId('checkout-plan-card')).toContainText('RENEWING');
    await expect(page.getByTestId('coupon-section')).toBeVisible(); // renewals may use coupons
    await snapBoth(page, testInfo, 'checkout-renew');
    await page.getByTestId('pay-button').click();
    const order = await mock.waitForRequest('/orders/create', { method: 'POST' });
    expect(order.body).toMatchObject({ plan_id: 1, amount: 3540, staff_limit: 10 });
  });
});

test.describe('Q1b pricing - D: staff-only capacity upgrade (Prime @ 40, limit 12 -> 20, 4 months left)', () => {
  test.beforeEach(async ({ mock }) => {
    const today = await mockToday(mock);
    await mock.setState({ catalogue: WORKED_CATALOGUE, subscription: { staff_limit: 12, end_date: monthsAheadOn15th(today, 4) } });
    await mock.setPlan('prime');
  });

  test('extra 8 x 40 x 4 months = 1,280 + GST 230 = 1,510; no coupon UI, no coupon requests; payload carries the EXTRA staff', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    await page.getByTestId('action-upgrade').click();
    await page.waitForURL((u) => u.pathname === '/admin/billing/upgrade' && u.searchParams.get('mode') === 'upgrade');
    await expect(page.getByTestId('plan-banner')).toContainText('Current Plan: Prime');
    await expect(page.getByTestId('staff-hint')).toHaveText('Min 10 · Unlimited'); // v1 floor quirk: 10, not the live limit
    await expect(page.getByTestId('staff-value')).toHaveText('12');
    // nothing to add yet
    await expect(page.getByTestId('cost-box')).toContainText('Increase staff count above 12 to add more');
    await expect(page.getByTestId('continue-pay')).toBeDisabled();
    await expect(page.getByTestId('continue-pay')).toContainText('Add Staff to Continue');
    await clickTimes(page, 'staff-minus', 2);
    await expect(page.getByTestId('staff-value')).toHaveText('10');
    await expect(page.getByTestId('staff-minus')).toBeDisabled();
    await expect(page.getByTestId('continue-pay')).toBeDisabled();
    await page.getByTestId('staff-value').click();
    await page.getByTestId('staff-input').fill('20');
    await page.getByTestId('staff-apply').click();
    await expect(page.getByTestId('cost-box')).toContainText('+8 new staff × ₹40/staff × 4 months = ₹1,280');
    await expect(page.getByTestId('continue-pay')).toBeEnabled();
    await expect(page.getByTestId('continue-pay')).toContainText('Continue to Pay');
    await snapBoth(page, testInfo, 'upgrade-staff-only');
    await mock.clearRequests();
    const t = await totalsOnCheckout(page);
    expect(t).toMatchObject({ staff: '₹1,280', subtotal: '₹1,280', gst: '₹230', grand: '₹1,510', pay: 'Pay ₹1,510' });
    await expect(page.getByText('8 extra staff × ₹40/staff × 4 months')).toBeVisible();
    await expect(page.getByTestId('checkout-plan-card')).toContainText('ADD STAFF');
    await expect(page.getByTestId('coupon-section')).toHaveCount(0);
    expect(await mock.requests({ path: '/plans/coupon' })).toHaveLength(0);
    expect(await mock.requests({ path: '/orders/check_first_payment' })).toHaveLength(0);
    const today = await mockToday(mock);
    await expect(page.getByTestId('checkout-plan-card')).toContainText(`Valid till ${fmtDate(monthsAheadOn15th(today, 4))}`); // capacity upgrades keep the end date
    await snapBoth(page, testInfo, 'checkout-staff-only');
    await page.getByTestId('pay-button').click();
    const order = await mock.waitForRequest('/orders/create', { method: 'POST' });
    expect(order.body).toMatchObject({ plan_id: 2, amount: 1510, staff_limit: 8 });
    expect(order.body?.coupon_code ?? null).toBeNull();
  });
});

test.describe('Q1b pricing - coupons', () => {
  test.beforeEach(async ({ mock }) => {
    await mock.setState({ catalogue: WORKED_CATALOGUE, subscription: { staff_limit: 10 } });
    await mock.setPlan('none');
  });

  test('invalid code shows the server message and keeps the total; editing clears the error; valid code can be removed', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, CHECKOUT, { mode: 'new', planId: 2, staff: 15 });
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹8,496');
    await expect(page.getByTestId('coupon-apply')).toBeDisabled(); // empty input
    await page.getByTestId('coupon-input').fill('NOPE50');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByText('Invalid or expired coupon')).toBeVisible();
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹8,496');
    await expect(page.getByTestId('row-discount')).toHaveCount(0);
    await page.getByTestId('coupon-input').fill('NOPE5');
    await expect(page.getByText('Invalid or expired coupon')).toHaveCount(0);
    // the verdict comes from the server quote (POST /orders/quote); older servers without it fall back to /plans/coupon/validate
    const priced = (await mock.requests({ path: '/orders/quote' })).find((r) => r.body?.coupon_code === 'NOPE50');
    expect(priced?.body).toMatchObject({ plan_id: 2, staff_limit: 15, mode: 'new', coupon_code: 'NOPE50' });
    expect(await mock.requests({ path: '/plans/coupon/validate' })).toHaveLength(0);
    await page.getByTestId('coupon-input').fill(' WELCOME10 ');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByTestId('coupon-badge')).toBeVisible();
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹7,646');
    await page.getByTestId('coupon-remove').click();
    await expect(page.getByTestId('coupon-badge')).toHaveCount(0);
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹8,496');
    await expect(page.getByTestId('coupon-input')).toBeVisible();
  });

  test('first payment: the welcome coupon is auto-applied with a one-time popup and can be removed', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await mock.failNext('/orders/check_first_payment', { status: 200, times: -1, body: { is_first_payment: true } });
    await visit(page, CHECKOUT, { mode: 'new', planId: 2, staff: 15 });
    await expect(page.getByText('Welcome Discount!')).toBeVisible();
    await expect(page.getByText('WELCOME10 has been applied as a one-time welcome offer.')).toBeVisible();
    await snapBoth(page, testInfo, 'checkout-welcome-coupon');
    await page.getByTestId('welcome-close').click();
    await expect(page.getByTestId('coupon-badge')).toContainText('WELCOME10 (10% off)');
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹7,646');
    await page.getByTestId('coupon-remove').click();
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹8,496');
  });

  test('no welcome coupon configured: the summary simply has no coupon applied', async ({ page, mock }) => {
    await mock.setState({ noCoupon: true });
    await loginAs(page, 'admin');
    await mock.failNext('/orders/check_first_payment', { status: 200, times: -1, body: { is_first_payment: true } });
    await visit(page, CHECKOUT, { mode: 'new', planId: 2, staff: 15 });
    await expect(page.getByTestId('coupon-input')).toBeVisible();
    await expect(page.getByText('Welcome Discount!')).toHaveCount(0);
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹8,496');
  });

  test('rounding: discount and GST are rounded half-up at their own step, the staff charge is not', async ({ page, mock }) => {
    // 11 staff x 45 x 1 month @ 10% -> 495; discount round(49.5) = 50; subtotal 445; GST round(80.1) = 80; total 525
    await mock.setState({ catalogue: [{ plan_id: 2, plan_name: 'Prime', plan_amount: 45, plan_month: 1 }, ...WORKED_CATALOGUE.filter((p) => p.plan_id !== 2)] });
    await loginAs(page, 'admin');
    await visit(page, CHECKOUT, { mode: 'new', planId: 2, staff: 11 });
    await expect(page.getByTestId('row-staff-charge')).toHaveText('₹495');
    await page.getByTestId('coupon-input').fill('WELCOME10');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByTestId('row-discount')).toContainText('- ₹50');
    await expect(page.getByTestId('row-subtotal')).toHaveText('₹445');
    await expect(page.getByTestId('row-gst')).toHaveText('₹80');
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹525');
  });
});
