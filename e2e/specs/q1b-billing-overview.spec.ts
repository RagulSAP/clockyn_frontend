/**
 * Q1b - Billing overview (/admin/billing) for every plan state, Plan Details sheet (downgrade matrix) and the platform rules
 * that can be asserted on the web build (purchase UI present, no web-portal link, no iOS view-only branch).
 */
import { expect, loginAs, USERS, visit, test } from '../support';
import { closeOverlay, hasHorizontalOverflow, mockGet, snapBoth } from '../support/q1';
import { FULL_CATALOGUE, fmtDate, usedStaffOf } from '../support/q1b';

type Sub = { start_date: string | null; end_date: string | null; staff_limit: number | null; plan_name: string | null; plan_id: number | null };

test.describe('Q1b billing overview - states', () => {
  test('active paid plan: ACTIVE badge, plan name, dates, staff strip (limit / used / remaining) and the four actions', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    const sub = (await mockGet<{ data: Sub }>(mock.tenant, `/plans/subscription/${'org-0001'}`)).data;
    const used = await usedStaffOf(mock);
    await expect(page.getByTestId('plan-state-badge')).toHaveText('ACTIVE');
    await expect(page.getByTestId('plan-name')).toHaveText('Elite');
    await expect(page.getByTestId('plan-sentence')).toHaveText('Your subscription is active and running');
    await expect(page.getByTestId('meta-Billing Date')).toHaveText(fmtDate(sub.start_date));
    await expect(page.getByTestId('meta-Valid Until')).toHaveText(fmtDate(sub.end_date));
    await expect(page.getByTestId('meta-Staff Limit')).toHaveText(String(sub.staff_limit));
    await expect(page.getByTestId('meta-Used Staff')).toHaveText(String(used));
    await expect(page.getByTestId('meta-Remaining')).toHaveText(String(Math.max(0, (sub.staff_limit ?? 0) - used)));
    for (const id of ['action-plan-details', 'action-upgrade', 'action-renew', 'action-invoices']) await expect(page.getByTestId(id)).toBeVisible();
    // web build: purchase UI is available and there is no "manage on the web" link (Android-only, env-gated)
    await expect(page.getByTestId('web-portal-link')).toHaveCount(0);
    await expect(page.getByText('Also available on web')).toHaveCount(0);
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await snapBoth(page, testInfo, 'billing-active');
  });

  test('Remaining turns red-tinted text at 0 staff left and never goes negative', async ({ page, mock }) => {
    await mock.setState({ subscription: { staff_limit: 3 } });
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    await expect(page.getByTestId('meta-Staff Limit')).toHaveText('3');
    await expect(page.getByTestId('meta-Remaining')).toHaveText('0');
  });

  test('expired paid plan: EXPIRED badge, renew sentence, Valid Until in the past, nothing disabled in Plan Details', async ({ page, mock }, testInfo) => {
    await mock.setPlan('expired');
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    await expect(page.getByTestId('plan-state-badge')).toHaveText('EXPIRED');
    await expect(page.getByTestId('plan-sentence')).toHaveText('Your plan has expired. Please renew.');
    const sub = (await mockGet<{ data: Sub }>(mock.tenant, '/plans/subscription/org-0001')).data;
    await expect(page.getByTestId('meta-Valid Until')).toHaveText(fmtDate(sub.end_date));
    await snapBoth(page, testInfo, 'billing-expired');
    await page.getByTestId('action-plan-details').click();
    await expect(page.getByTestId('plan-details-sheet')).toBeVisible();
    await expect(page.getByText('CURRENT', { exact: true })).toHaveCount(0);
    await page.getByTestId('tier-1').click(); // a lower plan is selectable when nothing is active
    await expect(page.getByTestId('continue-to-pay')).toBeVisible();
    await snapBoth(page, testInfo, 'billing-expired-plan-details');
  });

  test('renew on an expired plan opens the configurator in renew mode', async ({ page, mock }) => {
    await mock.setPlan('expired');
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    await page.getByTestId('action-renew').click();
    await page.waitForURL((u) => u.pathname === '/admin/billing/upgrade' && u.searchParams.get('mode') === 'renew');
    await expect(page.getByTestId('plan-banner')).toContainText('Renewing: Elite');
  });

  test('free trial: FREE TRIAL badge, "Free Trial" plan name, trial end sentence', async ({ page, mock }, testInfo) => {
    await mock.setPlan('trial');
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    const sub = (await mockGet<{ data: Sub }>(mock.tenant, '/plans/subscription/org-0001')).data;
    await expect(page.getByTestId('plan-state-badge')).toHaveText('FREE TRIAL');
    await expect(page.getByTestId('plan-name')).toHaveText('Free Trial');
    await expect(page.getByTestId('plan-sentence')).toHaveText(`Free trial ends on ${fmtDate(sub.end_date)}`);
    await snapBoth(page, testInfo, 'billing-trial');
  });

  for (const [action, mode] of [['action-upgrade', 'upgrade'], ['action-renew', 'renew']] as const) {
    test(`free trial: ${mode} is locked by the "Not Available During Free Trial" modal; Buy a Plan returns to the overview`, async ({ page, mock }, testInfo) => {
      await mock.setPlan('trial');
      await loginAs(page, 'admin');
      await visit(page, '/admin/billing');
      await page.getByTestId(action).click();
      await page.waitForURL((u) => u.pathname === '/admin/billing/upgrade');
      await expect(page.getByText('Not Available During Free Trial')).toBeVisible();
      await expect(page.getByText('This page is locked until your free trial ends on', { exact: false })).toBeVisible();
      if (mode === 'upgrade') await snapBoth(page, testInfo, 'billing-trial-locked');
      await page.getByTestId('trial-buy').click();
      await page.waitForURL((u) => u.pathname === '/admin/billing');
      await expect(page.getByTestId('plan-state-badge').last()).toHaveText('FREE TRIAL'); // "Buy a Plan" replaces the upgrade screen with a second overview on the stack
    });
  }

  test('free trial: Close on the lock modal goes back; Plan Details still lets the admin buy a plan', async ({ page, mock }) => {
    await mock.setPlan('trial');
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    await page.getByTestId('action-upgrade').click();
    await page.getByTestId('trial-close').click();
    await page.waitForURL((u) => u.pathname === '/admin/billing');
    await page.getByTestId('action-plan-details').click();
    await expect(page.getByTestId('plan-details-sheet').getByText('Free Trial').first()).toBeVisible();
    await page.getByTestId('tier-1').click();
    await page.getByTestId('continue-to-pay').click();
    await page.waitForURL((u) => u.pathname === '/admin/billing/upgrade' && u.searchParams.get('mode') === 'new');
    await expect(page.getByTestId('plan-banner')).toContainText('Upgrading to: Core');
  });

  test('no plan: NO PLAN badge, "No Active Plan", no staff strip; Upgrade / Renew ask to select a plan first', async ({ page, mock }, testInfo) => {
    await mock.setPlan('none');
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    await expect(page.getByTestId('plan-state-badge')).toHaveText('NO PLAN');
    await expect(page.getByTestId('plan-name')).toHaveText('No Active Plan');
    await expect(page.getByTestId('plan-sentence')).toHaveText('Subscribe to unlock all features');
    await expect(page.getByTestId('meta-Staff Limit')).toHaveCount(0);
    await snapBoth(page, testInfo, 'billing-none');
    for (const action of ['action-upgrade', 'action-renew']) {
      await page.getByTestId(action).click();
      await expect(page.getByText('Select a Plan First')).toBeVisible();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByText('Select a Plan First')).toHaveCount(0);
      expect(new URL(page.url()).pathname).toBe('/admin/billing');
    }
    await page.getByTestId('action-upgrade').click();
    await page.getByRole('button', { name: 'Go to Plan Details' }).click();
    await expect(page.getByTestId('plan-details-sheet')).toBeVisible();
    await expect(page.getByText('Plan Includes')).toHaveCount(0);
    await snapBoth(page, testInfo, 'billing-none-plan-details');
  });

  test('subscription load failure: retryable error state', async ({ page, mock, issues }) => {
    issues.allow(/plans\/subscription/);
    await loginAs(page, 'admin');
    await mock.failNext('/plans/subscription/*', { status: 500, times: -1 });
    await visit(page, '/admin/billing');
    await expect(page.getByText('We could not load your subscription.')).toBeVisible({ timeout: 20_000 });
    await mock.clearFailures();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByTestId('plan-state-badge')).toHaveText('ACTIVE');
  });

  test('Download Invoices opens the invoices screen', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    await page.getByTestId('action-invoices').click();
    await page.waitForURL((u) => u.pathname === '/admin/billing/invoices');
  });
});

test.describe('Q1b billing overview - Plan Details sheet', () => {
  test('active Prime 6 months: Core all disabled, Prime 1m / 6m disabled (6m Active), Prime 12m enabled, Elite 1m disabled, Elite 6m / 12m enabled', async ({ page, mock }, testInfo) => {
    await mock.setState({ catalogue: FULL_CATALOGUE });
    await mock.setPlan('prime');
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    await page.getByTestId('action-plan-details').click();
    await expect(page.getByTestId('plan-group-prime')).toContainText('CURRENT');
    await expect(page.getByTestId('plan-group-core')).not.toContainText('CURRENT');
    await expect(page.getByTestId('plan-details-sheet')).toContainText('Plan Includes');
    await snapBoth(page, testInfo, 'billing-plan-details-prime');
    // a blocked tier is drawn at 45 % opacity; the running tier is the grey "Active" box
    const disabled = async (id: number) => (await page.getByTestId(`tier-${id}`).evaluate((e) => getComputedStyle(e).opacity)) === '0.45';
    // ids: core 11/1/12 (1/6/12m), prime 21/2/22, elite 31/32/3
    for (const id of [11, 1, 12, 21, 31]) expect(await disabled(id), `tier ${id} should be disabled`).toBe(true);
    expect(await disabled(2)).toBe(false); // the active tier is grey, not dimmed
    for (const id of [22, 32, 3]) expect(await disabled(id), `tier ${id} should be enabled`).toBe(false);
    await expect(page.getByTestId('tier-2')).toContainText('Active');
    // tapping blocked tiers
    await page.getByTestId('tier-2').click();
    await expect(page.getByText("You're on This Plan")).toBeVisible();
    await page.getByRole('button', { name: 'Got it' }).click();
    for (const id of [11, 1, 12, 21, 31]) {
      await page.getByTestId(`tier-${id}`).click();
      await expect(page.getByText('Downgrade Not Allowed')).toBeVisible();
      await page.getByRole('button', { name: 'Got it' }).click();
      await expect(page.getByText('Downgrade Not Allowed')).toHaveCount(0);
    }
    await expect(page.getByTestId('continue-to-pay')).toHaveCount(0);
    // select / deselect / switch an enabled tier: only one Continue button, tied to the selection
    await page.getByTestId('tier-22').click();
    await expect(page.getByTestId('continue-to-pay')).toHaveCount(1);
    await expect(page.getByTestId('tier-22')).toHaveAttribute('aria-selected', 'true'); // selection is exposed on the web build
    await page.getByTestId('tier-22').click();
    await expect(page.getByTestId('tier-22')).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByTestId('continue-to-pay')).toHaveCount(0);
    await page.getByTestId('tier-22').click();
    await page.getByTestId('tier-3').click();
    await expect(page.getByTestId('continue-to-pay')).toHaveCount(1);
    await expect(page.getByTestId('plan-group-elite').getByTestId('continue-to-pay')).toBeVisible();
    await closeOverlay(page);
    await expect(page.getByTestId('plan-details-sheet')).toHaveCount(0);
  });

  test('catalogue grouped by plan with duration labels and per-staff prices', async ({ page, mock }) => {
    await mock.setState({ catalogue: FULL_CATALOGUE });
    await mock.setPlan('none');
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    await page.getByTestId('action-plan-details').click();
    await expect(page.getByTestId('tier-12')).toContainText('1 Year');
    await expect(page.getByTestId('tier-12')).toContainText('₹20');
    await expect(page.getByTestId('tier-11')).toContainText('1 Month');
    await expect(page.getByTestId('tier-1')).toContainText('6 Months');
    await expect(page.getByTestId('plan-group-core')).toContainText('Geo Fencing Attendance');
    await expect(page.getByTestId('plan-group-prime')).toContainText('GPS Live Location for Field Operations');
    await expect(page.getByTestId('plan-group-elite')).toContainText('CRM');
    expect(USERS.admin.userId).toBeTruthy();
  });

  test('catalogue failure inside the sheet is retryable', async ({ page, mock, issues }) => {
    issues.allow(/plans\/get_plans/);
    await loginAs(page, 'admin');
    await mock.failNext('/plans/get_plans', { status: 500, times: -1 });
    await visit(page, '/admin/billing');
    await page.getByTestId('action-plan-details').click();
    await expect(page.getByText('We could not load the plans.')).toBeVisible({ timeout: 20_000 });
    await mock.clearFailures();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByTestId('plan-group-elite')).toBeVisible();
  });
});

test.describe('Q1b billing - manager (role 2)', () => {
  test('a manager reaching /admin/billing by URL (no entry point exists for managers) - what is shown', async ({ page }, testInfo) => {
    await loginAs(page, 'manager');
    await visit(page, '/admin/billing');
    await expect(page.getByTestId('subscription-screen')).toBeVisible();
    await testInfo.attach('manager-billing-actions', {
      body: JSON.stringify({ purchaseActions: await page.getByTestId('action-upgrade').count() }),
      contentType: 'application/json',
    });
  });
});
