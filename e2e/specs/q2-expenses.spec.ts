/**
 * Q2 - Expenses review (admin): odometer readings (amount maths, photo viewer, integer rate editor, approve / reject),
 * travel tickets and other bills.
 */
import type { Page } from '@playwright/test';

import { test, expect, loginAs, visit } from '../support';
import { rupees } from '../support/q2';

const dialogButton = (page: Page, name: string) => page.getByRole('dialog').getByRole('button', { name, exact: true });

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'admin');
});

test.describe('odometer', () => {
  const path = '/admin/expenses/odometer';

  test('cards show start -> distance -> stop, amount = distance x org rate, count of records, rate card', async ({ page }) => {
    await visit(page, path);
    await expect(page.getByTestId('odometer-rate')).toHaveText('₹8');
    await expect(page.getByTestId('odometer-screen-count')).toHaveText(/^13 of 13 records$/);
    const card = page.getByTestId('odometer-odo-001');
    await expect(card).toBeVisible();
    // distance is rendered on the card, amount = km x 8
    const text = await card.innerText();
    const km = Number((text.match(/TOTAL DISTANCE\s*\n?\s*([\d.]+) km/i) ?? text.match(/([\d.]+) km\s*\n?\s*AMOUNT/i) ?? [])[1]);
    expect(km).toBeGreaterThan(0);
    expect(rupees(await page.getByTestId('odometer-odo-001-amount').innerText())).toBeCloseTo(km * 8, 2);
    await expect(page.locator('body')).not.toContainText('NaN');
  });

  test('a reading with a start but no stop shows 0 km (no NaN / crash) and 0.00 amount', async ({ page }) => {
    await visit(page, path);
    const card = page.getByTestId('odometer-odo-100');
    await expect(card).toContainText('15200 km');
    await expect(card).toContainText('0 km');
    await expect(page.getByTestId('odometer-odo-100-amount')).toHaveText('₹0.00');
  });

  test('rate editor validation: empty / zero / negative / text rejected; decimals are rounded and re-price every row', async ({ page, mock }) => {
    await visit(page, path);
    const amountBefore = rupees(await page.getByTestId('odometer-odo-001-amount').innerText());
    await page.getByTestId('odometer-edit-rate').click();
    const input = page.getByTestId('odometer-rate-input');
    await expect(input).toHaveValue('8');
    for (const bad of ['', '0', '-3', 'abc', '0.4']) {
      await input.fill(bad);
      await page.getByTestId('odometer-save-rate').click();
      await expect(page.getByText('Please enter a valid rate')).toBeVisible();
    }
    expect((await mock.requests({ path: '/expenses/admin/allowance-rate', method: 'POST' })).length).toBe(0);
    await input.fill('10.6');
    await expect(page.getByText('Saved as ₹11 per km (whole rupees only)')).toBeVisible();
    await page.getByTestId('odometer-save-rate').click();
    await expect(page.getByText('Rate updated successfully').first()).toBeVisible();
    const call = await mock.waitForRequest('/expenses/admin/allowance-rate', { method: 'POST' });
    expect(call.body?.rate).toBe(11);
    await expect(page.getByTestId('odometer-rate')).toHaveText('₹11');
    const amountAfter = rupees(await page.getByTestId('odometer-odo-001-amount').innerText());
    expect(amountAfter).toBeCloseTo((amountBefore / 8) * 11, 2);
  });

  test('rate save failure keeps the dialog open and shows the server message', async ({ page, mock, issues }) => {
    issues.allow(/allowance-rate/);
    await visit(page, path);
    await page.getByTestId('odometer-edit-rate').click();
    await page.getByTestId('odometer-rate-input').fill('12');
    await mock.failNext('/expenses/admin/allowance-rate', { method: 'POST', status: 400, body: { detail: 'Rate locked' } });
    await page.getByTestId('odometer-save-rate').click();
    await expect(page.getByText('Rate locked').first()).toBeVisible();
    await expect(page.getByTestId('odometer-rate-input')).toBeVisible();
    await expect(page.getByTestId('odometer-rate')).toHaveText('₹8');
  });

  test('photos dialog shows start/stop photos, opens the full-screen viewer with zoom, and closes', async ({ page }) => {
    await visit(page, path);
    await page.getByTestId('odometer-odo-001-photos').click();
    const dlg = page.getByRole('dialog', { name: 'Odometer Photos' });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText('Start Reading')).toBeVisible();
    await expect(dlg.getByText('Stop Reading')).toBeVisible();
    await expect(dlg.getByText(/₹\d/)).toBeVisible();
    await dlg.getByRole('button', { name: /View Start Reading full screen/ }).click();
    await expect(page.getByRole('button', { name: /zoom in/i }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /zoom in/i })).toHaveCount(0);
  });

  test('approve with confirmation (cancel = no call), reject; decided cards lose their buttons; payload + state persisted', async ({ page, mock }) => {
    await visit(page, path);
    await page.getByTestId('odometer-odo-001-approve').click();
    await expect(page.getByRole('dialog').getByText(/Approve the odometer reading of .* \(₹[\d,.]+\)\? This cannot be changed later\./)).toBeVisible();
    await dialogButton(page, 'Cancel').click();
    expect((await mock.requests({ path: '/status', method: 'PUT' })).length).toBe(0);
    await page.getByTestId('odometer-odo-001-approve').click();
    await dialogButton(page, 'Approve').click();
    await expect(page.getByText('Reading approved successfully').first()).toBeVisible();
    const call = await mock.waitForRequest('/expenses/admin/odometer-readings/odo-001/status', { method: 'PUT' });
    expect(call.body).toMatchObject({ status: 'approved' });
    await expect(page.getByTestId('odometer-odo-001-approve')).toHaveCount(0);
    await expect(page.getByTestId('odometer-odo-001')).toContainText('Approved');

    await page.getByTestId('odometer-odo-100-reject').click();
    await dialogButton(page, 'Reject').click();
    await expect(page.getByText('Reading rejected successfully').first()).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('odometer-odo-100')).toContainText('Rejected');
    await expect(page.getByTestId('odometer-odo-100-reject')).toHaveCount(0);
  });

  test('approve failure shows the server message; card stays pending and actionable', async ({ page, mock, issues }) => {
    issues.allow(/odometer-readings/);
    await visit(page, path);
    await mock.failNext('/expenses/admin/odometer-readings/odo-001/status', { method: 'PUT', status: 500, body: { detail: 'Payroll closed' } });
    await page.getByTestId('odometer-odo-001-approve').click();
    await dialogButton(page, 'Approve').click();
    await expect(page.getByText('Payroll closed').first()).toBeVisible();
    await expect(page.getByTestId('odometer-odo-001')).toContainText('Pending');
    await expect(page.getByTestId('odometer-odo-001-approve')).toBeEnabled();
  });

  test('date filter narrows the list and the count; clear restores; empty filter shows the empty state', async ({ page, mock }) => {
    await visit(page, path);
    const today = (await mock.state()).today;
    const total = 13;
    await expect(page.getByTestId('odometer-screen-count')).toHaveText(`${total} of ${total} records`);
    await page.getByTestId('odometer-screen-date').fill(today);
    await expect(page.getByTestId('odometer-screen-count')).toHaveText(`1 of ${total} records`);
    await expect(page.getByTestId('odometer-odo-100')).toBeVisible();
    await page.getByRole('button', { name: 'Clear date filter' }).click();
    await expect(page.getByTestId('odometer-screen-count')).toHaveText(`${total} of ${total} records`);
    await page.getByTestId('odometer-screen-date').fill('2026-01-02');
    await expect(page.getByText('No Readings Found')).toBeVisible();
  });

  test('load failure -> error state with retry', async ({ page, mock, issues }) => {
    issues.allow(/odometer-readings/);
    await mock.failNext('/expenses/admin/odometer-readings/*', { status: 500 });
    await visit(page, path);
    await expect(page.getByText('Something went wrong')).toBeVisible();
    await page.getByRole('button', { name: /try again/i }).click();
    await expect(page.getByTestId('odometer-odo-001')).toBeVisible();
  });
});

test.describe('travel tickets and bills', () => {
  test('travel: list, photo dialog, approve confirms with the amount, reject, final decisions', async ({ page, mock }) => {
    await visit(page, '/admin/expenses/travel');
    await expect(page.getByTestId('expenses-travel-count')).toHaveText(/of 5 records/);
    await page.getByTestId('expense-exp-001-photos').click();
    await expect(page.getByRole('dialog', { name: 'Travel Ticket' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('expense-exp-001-approve').click();
    await expect(page.getByRole('dialog').getByText(/Approve the ticket of .* for ₹450\.00\?/)).toBeVisible();
    await dialogButton(page, 'Approve').click();
    await expect(page.getByText('Ticket approved').first()).toBeVisible();
    expect((await mock.waitForRequest('/expenses/admin/travel-bill/exp-001/status', { method: 'PUT' })).body).toMatchObject({ status: 'approved' });
    await expect(page.getByTestId('expense-exp-001')).toContainText('Approved');
    await expect(page.getByTestId('expense-exp-001-approve')).toHaveCount(0);
    await page.getByTestId('expense-exp-004-reject').click();
    await dialogButton(page, 'Reject').click();
    await expect(page.getByText('Ticket rejected').first()).toBeVisible();
    await expect(page.getByTestId('expense-exp-004')).toContainText('Rejected');
  });

  test('bills: bill/invoice line, amount, approve, failure message, date filter', async ({ page, mock, issues }) => {
    issues.allow(/travel-bill/);
    await visit(page, '/admin/expenses/bills');
    await expect(page.getByTestId('expense-exp-005')).toContainText('Bill/Invoice');
    await expect(page.getByTestId('expense-exp-005')).toContainText('₹560.00');
    await mock.failNext('/expenses/admin/travel-bill/exp-005/status', { method: 'PUT', status: 500, body: { detail: 'Bill already settled' } });
    await page.getByTestId('expense-exp-005-approve').click();
    await dialogButton(page, 'Approve').click();
    await expect(page.getByText('Bill already settled').first()).toBeVisible();
    await expect(page.getByTestId('expense-exp-005')).toContainText('Pending');
    await page.getByTestId('expense-exp-005-approve').click();
    await dialogButton(page, 'Approve').click();
    await expect(page.getByText('Bill approved').first()).toBeVisible();
    await page.getByTestId('expenses-bill-date').fill('2026-01-02');
    await expect(page.getByText('No Bills Found')).toBeVisible();
  });

  test('empty org shows the empty state (no tickets)', async ({ page, mock }) => {
    await visit(page, '/admin/expenses/travel');
    void mock;
    await page.getByTestId('expenses-travel-date').fill('2026-01-02');
    await expect(page.getByText('No Tickets Found')).toBeVisible();
  });
});
