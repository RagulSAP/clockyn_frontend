/**
 * Q1b - Checkout with the mocked Razorpay path (success / failure / dismissed / verification failure / order failure) and the
 * invoices screen (list, download, empty / error, web-only behaviour).
 */
import { expect, expectToast, loginAs, readSession, setCheckoutMode, USERS, visit, test } from '../support';
import { hasHorizontalOverflow, mockGet, snapBoth } from '../support/q1';
import { WORKED_CATALOGUE, fmtDate } from '../support/q1b';

const CHECKOUT = '/admin/billing/checkout';
type Params = { mode: string; planId?: number; staff?: number };

async function openCheckout(page: import('@playwright/test').Page, params: Params): Promise<void> {
  await visit(page, CHECKOUT, params);
  await expect(page.getByTestId('pay-button')).toBeEnabled();
}

test.describe('Q1b checkout - payment outcomes', () => {
  test.beforeEach(async ({ mock }) => {
    await mock.setState({ catalogue: WORKED_CATALOGUE, subscription: { staff_limit: 10 } });
  });

  test('success from a free trial: order -> checkout -> verify, success dialog, plan / subscription refetched, session patched, new invoice listed', async ({ page, mock }, testInfo) => {
    await mock.setPlan('trial');
    await loginAs(page, 'admin');
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    expect((await readSession(page))?.isFreeTrial).toBe(true);
    await mock.clearRequests();
    await page.getByTestId('pay-button').click();

    await expect(page.getByText('Payment Successful!')).toBeVisible();
    await expect(page.getByText('Your Prime Plan is now active. Enjoy all the features!')).toBeVisible();
    await snapBoth(page, testInfo, 'checkout-success');

    const order = await mock.waitForRequest('/orders/create', { method: 'POST' });
    expect(order.body).toMatchObject({ user_id: USERS.admin.userId, org_id: 'org-0001', plan_id: 2, amount: 8496, staff_limit: 15, mode: 'new' });
    const verify = await mock.waitForRequest('/payments/verify', { method: 'POST' });
    expect(verify.body).toMatchObject({ razorpay_payment_id: 'pay_mock_1', razorpay_signature: 'sig_mock', user_id: USERS.admin.userId });
    expect(String(verify.body?.razorpay_order_id)).toMatch(/^order_mock_/);
    expect(verify.id).toBeGreaterThan(order.id);
    // queries are invalidated after the verified payment
    await mock.waitForRequest('/plans/plan-status/org-0001', { predicate: (r) => r.id > verify.id });
    await mock.waitForRequest('/plans/subscription/org-0001', { predicate: (r) => r.id > verify.id });
    // session patched (plan id set, trial flag cleared)
    await expect.poll(async () => (await readSession(page))?.planId).toBe(2);
    expect((await readSession(page))?.isFreeTrial).toBe(false);
    expect((await mock.requests({ path: '/orders/create' }))).toHaveLength(1);

    await page.getByTestId('go-dashboard').click();
    await page.waitForURL((u) => u.pathname === '/admin/home');
    // the overview reflects the new plan and the invoice list has the new invoice first
    await visit(page, '/admin/billing');
    await expect(page.getByTestId('plan-state-badge')).toHaveText('ACTIVE');
    await expect(page.getByTestId('plan-name')).toHaveText('Prime');
    await expect(page.getByTestId('meta-Staff Limit')).toHaveText('15');
    await visit(page, '/admin/billing/invoices');
    const newest = (await mockGet<{ data: { invoice_number: string }[] }>(mock.tenant, '/invoice/history?org_id=org-0001&user_id=adm-0001')).data[0].invoice_number;
    expect(newest).not.toMatch(/^INV-2026-000[12]$/);
    await expect(page.getByTestId(`invoice-${newest}`)).toContainText('Prime Plan');
    await expect(page.getByTestId(`invoice-amount-${newest}`)).toHaveText('₹8,496');
    await expect(page.getByTestId('invoice-INV-2026-0001')).toBeVisible();
  });

  test('flat coupon: the checkout shows the SERVER quote (discount, GST, total) and the order is created with that total', async ({ page, mock }) => {
    await mock.setState({ coupon: { coupon_name: 'FLAT500', discount: 0, discount_type: 'flat', flat_amount: 500, max_discount: null, min_amount: null } });
    await mock.setPlan('none');
    await loginAs(page, 'admin');
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹8,496');
    await page.getByTestId('coupon-input').fill('flat500');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByTestId('coupon-badge')).toContainText('FLAT500 (₹500 off)');
    await expect(page.getByTestId('row-discount')).toHaveText('- ₹500');
    await expect(page.getByTestId('row-subtotal')).toHaveText('₹6,700');
    await expect(page.getByTestId('row-gst')).toHaveText('₹1,206');
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹7,906');
    await expect(page.getByTestId('pay-button')).toContainText('Pay ₹7,906');
    const quote = await mock.lastRequest('/orders/quote');
    expect(quote?.body).toMatchObject({ user_id: USERS.admin.userId, org_id: 'org-0001', plan_id: 2, staff_limit: 15, mode: 'new', coupon_code: 'FLAT500' });
    await mock.clearRequests();
    await page.getByTestId('pay-button').click();
    await expect(page.getByText('Payment Successful!')).toBeVisible();
    expect((await mock.lastRequest('/orders/create'))?.body).toMatchObject({ plan_id: 2, amount: 7906, staff_limit: 15, coupon_code: 'FLAT500', mode: 'new' });
  });

  test('a coupon the server refuses (minimum amount) shows the server message and applies nothing', async ({ page, mock }) => {
    await mock.setState({ coupon: { discount: 10, discount_type: 'percent', min_amount: 100000 } });
    await mock.setPlan('none');
    await loginAs(page, 'admin');
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    await page.getByTestId('coupon-input').fill('welcome10');
    await page.getByTestId('coupon-apply').click();
    await expect(page.getByText('This coupon needs a minimum order of Rs 1,00,000')).toBeVisible();
    await expect(page.getByTestId('coupon-badge')).toHaveCount(0);
    await expect(page.getByTestId('row-grand-total')).toHaveText('₹8,496');
  });

  test('payment failure: "Payment Cancelled" dialog with the gateway message, no verification, can pay again', async ({ page, mock }) => {
    await setCheckoutMode(page, 'fail');
    await mock.setPlan('none');
    await loginAs(page, 'admin');
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    await page.getByTestId('pay-button').click();
    await expect(page.getByText('Payment Cancelled')).toBeVisible();
    await expect(page.getByText('Payment failed (mock)')).toBeVisible();
    await page.getByRole('button', { name: 'OK' }).click();
    expect(await mock.requests({ path: '/payments/verify' })).toHaveLength(0);
    expect(new URL(page.url()).pathname).toBe(CHECKOUT);
    await expect(page.getByTestId('pay-button')).toBeEnabled();
    expect((await readSession(page))?.planId ?? null).toBeNull();
  });

  test('payment window dismissed: "You closed the payment window." and nothing is verified or changed', async ({ page, mock }) => {
    await setCheckoutMode(page, 'dismiss');
    await mock.setPlan('none');
    await loginAs(page, 'admin');
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    await page.getByTestId('pay-button').click();
    await expect(page.getByText('Payment Cancelled')).toBeVisible();
    await expect(page.getByText('You closed the payment window.')).toBeVisible();
    await page.getByRole('button', { name: 'OK' }).click();
    expect(await mock.requests({ path: '/payments/verify' })).toHaveLength(0);
    await expect(page.getByTestId('pay-button')).toBeEnabled();
    await page.getByTestId('pay-button').click(); // a second attempt creates a second order and is allowed
    await expect(page.getByText('You closed the payment window.')).toBeVisible();
    expect(await mock.requests({ path: '/orders/create' })).toHaveLength(2);
  });

  test('order creation failure: toast with the server message, no payment window, button usable again', async ({ page, mock, issues }) => {
    issues.allow(/orders\/create/);
    await mock.setPlan('none');
    await loginAs(page, 'admin');
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    await mock.failNext('/orders/create', { status: 500, body: { detail: 'Gateway not reachable' } });
    await page.getByTestId('pay-button').click();
    await expectToast(page, 'Gateway not reachable');
    await expect(page.getByTestId('pay-button')).toBeEnabled();
    expect(await mock.requests({ path: '/payments/verify' })).toHaveLength(0);
  });

  test('verification failure after a successful charge: dialog + "Retry verification" confirms WITHOUT a second order', async ({ page, mock, issues }) => {
    issues.allow(/payments\/verify/);
    await mock.setPlan('none');
    await loginAs(page, 'admin');
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    await mock.failNext('/payments/verify', { status: 400, body: { detail: 'Payment verification failed' } });
    await page.getByTestId('pay-button').click();
    await expect(page.getByRole('heading', { name: 'Verification Failed' })).toBeVisible();
    await expect(page.getByText('If money was debited, use "Retry verification"', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByTestId('pending-verification')).toBeVisible();
    await expect(page.getByTestId('pending-verification')).toContainText('Payment not confirmed yet');
    await page.getByTestId('retry-verify').click();
    await expect(page.getByText('Payment Successful!')).toBeVisible();
    expect(await mock.requests({ path: '/orders/create' })).toHaveLength(1);
    const verifies = await mock.requests({ path: '/payments/verify' });
    expect(verifies).toHaveLength(2);
    expect(verifies[1].body).toMatchObject({ razorpay_order_id: verifies[0].body?.razorpay_order_id, razorpay_payment_id: 'pay_mock_1' });
    await expect.poll(async () => (await readSession(page))?.planId).toBe(2);
  });

  test('renewal of an active plan: success dialog names the plan and the order carries the renew amount', async ({ page, mock }) => {
    await mock.setPlan('core');
    await loginAs(page, 'admin');
    await openCheckout(page, { mode: 'renew', staff: 10 });
    await expect(page.getByTestId('pay-button')).toContainText('Pay ₹3,540');
    await page.getByTestId('pay-button').click();
    await expect(page.getByText('Payment Successful!')).toBeVisible();
    await expect(page.getByText('Your Core Plan is now active.', { exact: false })).toBeVisible();
    expect((await mock.lastRequest('/orders/create'))?.body).toMatchObject({ plan_id: 1, amount: 3540, staff_limit: 10, mode: 'renew' });
  });

  test('phone/desktop layout of the payment summary has no horizontal overflow', async ({ page, mock }) => {
    await mock.setPlan('none');
    await loginAs(page, 'admin');
    await openCheckout(page, { mode: 'new', planId: 2, staff: 15 });
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});

test.describe('Q1b invoices', () => {
  test('history lists both seeded invoices with PAID badge, plan, staff, validity and amount; web shows no Downloaded tab', async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing/invoices');
    await expect(page.getByTestId('invoices-screen')).toBeVisible();
    const a = page.getByTestId('invoice-INV-2026-0001');
    await expect(a).toContainText('Elite Plan');
    await expect(a).toContainText('PAID');
    await expect(a).toContainText('Staff 50');
    await expect(a).toContainText('Valid till');
    await expect(page.getByTestId('invoice-amount-INV-2026-0001')).toHaveText('₹3,538.82');
    await expect(page.getByTestId('invoice-INV-2026-0002')).toContainText('Prime Plan');
    await expect(page.getByTestId('invoice-amount-INV-2026-0002')).toHaveText('₹2,358.82');
    await expect(page.getByText('Invoice History (2)')).toBeVisible();
    await expect(page.getByText('Downloaded (', { exact: false })).toHaveCount(0);
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await snapBoth(page, testInfo, 'invoices');
  });

  test('download fires a browser download of Invoice_<number>.pdf from /invoice/download and confirms with a toast', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing/invoices');
    const download = page.waitForEvent('download');
    await page.getByTestId('download-INV-2026-0001').click();
    const d = await download;
    expect(d.suggestedFilename()).toBe('Invoice_INV-2026-0001.pdf');
    await expectToast(page, 'Invoice INV-2026-0001 downloaded successfully.');
    const rec = await mock.waitForRequest('/invoice/download', { method: 'GET' });
    expect(rec.query).toMatchObject({ user_id: USERS.admin.userId, org_id: 'org-0001', invoice_number: 'INV-2026-0001' });
    expect(rec.status).toBe(200);
    // web has no downloaded registry: the card is not an action target (no share / delete sheet)
    await page.getByTestId('invoice-INV-2026-0001').click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId('invoice-actions')).toHaveCount(0);
    await expect(page.getByText('Delete Invoice?')).toHaveCount(0);
  });

  test('download failure: "Download failed" toast, the button is usable again', async ({ page, mock, issues }) => {
    issues.allow(/invoice\/download/);
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing/invoices');
    await mock.failNext('/invoice/download', { status: 404, body: { detail: 'Invoice not found' } });
    await page.getByTestId('download-INV-2026-0002').click();
    await expectToast(page, 'Download failed');
    await expect(page.getByTestId('download-INV-2026-0002')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByTestId('download-INV-2026-0002').click();
    expect((await download).suggestedFilename()).toBe('Invoice_INV-2026-0002.pdf');
  });

  test('empty history shows "No invoices found"', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await mock.failNext('/invoice/history', { status: 200, times: -1, body: { success: true, data: [] } });
    await visit(page, '/admin/billing/invoices');
    await expect(page.getByText('No invoices found')).toBeVisible();
    await expect(page.getByText('Invoice History (0)')).toBeVisible();
    await snapBoth(page, testInfo, 'invoices-empty');
  });

  test('history load failure: error state with Retry', async ({ page, mock, issues }, testInfo) => {
    issues.allow(/invoice\/history/);
    await loginAs(page, 'admin');
    await mock.failNext('/invoice/history', { status: 500, times: -1, body: { detail: 'History unavailable' } });
    await visit(page, '/admin/billing/invoices');
    await expect(page.getByText('Could not load invoice history')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('History unavailable')).toBeVisible();
    await snapBoth(page, testInfo, 'invoices-error');
    await mock.clearFailures();
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByTestId('invoice-INV-2026-0001')).toBeVisible();
  });

  test('invoice data matches what the mock holds (amount, staff, validity)', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    const rows = (await mockGet<{ data: { invoice_number: string; valid_till: string; staff_count: number }[] }>(mock.tenant, '/invoice/history?org_id=org-0001&user_id=adm-0001')).data;
    await visit(page, '/admin/billing/invoices');
    for (const r of rows) {
      await expect(page.getByTestId(`invoice-${r.invoice_number}`)).toContainText(`Staff ${r.staff_count} · Valid till ${fmtDate(r.valid_till)}`);
    }
  });
});
