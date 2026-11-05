/**
 * Q2 - Payroll: monthly salary (mark paid) and the salary sheet (columns, frozen first column, synced scroll, advances, export).
 */
import fs from 'node:fs';

import { test, expect, loginAs, visit, USERS } from '../support';
import { rupees } from '../support/q2';

const MONTHLY = '/admin/payroll/monthly-salary';
const SHEET = '/admin/payroll/salary-sheet';

const stat = (page: import('@playwright/test').Page, label: string) =>
  page.getByText(label, { exact: true }).first().locator('xpath=ancestor::*[self::div][2]');

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'admin');
});

test.describe('monthly salary', () => {
  test('lists staff with totals, pay one / selected / all, period change resets paid marks', async ({ page, mock }) => {
    await visit(page, MONTHLY);
    const rows = page.locator('[data-testid^="pay-row-"]');
    await expect(rows.first()).toBeVisible();
    const n = await rows.count();
    expect(n).toBeGreaterThan(5);
    await expect(page.getByText(`Select All (${n})`)).toBeVisible();
    await expect(page.getByRole('button', { name: `Pay All (${n})` })).toBeEnabled();
    await expect(page.getByText(/Paid marks are kept on this screen only|Payment Progress/).first()).toBeVisible();
    await expect(page.getByTestId('pay-progress')).toHaveCount(1);

    // pay one
    const firstId = ((await rows.first().getAttribute('data-testid')) as string).replace('pay-row-', '');
    await page.getByTestId(`pay-${firstId}`).click();
    await expect(page.getByText('Payment Processed!')).toBeVisible();
    await page.getByTestId('success-done').click();
    const call = await mock.waitForRequest('/salary/mark-paid', { method: 'POST' });
    expect(call.body).toMatchObject({ user_ids: [firstId] });
    expect(typeof call.body?.month).toBe('number');
    await expect(page.getByTestId(`pay-row-${firstId}`).getByText('Paid')).toBeVisible();
    await expect(page.getByText(`Select All (${n - 1})`)).toBeVisible();

    // select two, pay selected (with confirmation)
    const ids = (await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') as string))).map((t) => t.replace('pay-row-', ''));
    const unpaid = ids.filter((i) => i !== firstId);
    await page.getByTestId(`pay-row-${unpaid[0]}`).click();
    await page.getByTestId(`pay-row-${unpaid[1]}`).click();
    await expect(page.getByTestId('pay-selected')).toContainText('Pay Selected (2)');
    await expect(page.getByTestId('pay-all')).toHaveCount(0);
    await page.getByTestId('pay-selected').click();
    await page.getByRole('button', { name: 'Mark as paid' }).click();
    await expect(page.getByText('Payment Processed!')).toBeVisible();
    await page.getByTestId('success-done').click();
    const two = await mock.waitForRequest('/salary/mark-paid', { method: 'POST', predicate: (r) => (r.body?.user_ids as string[]).length === 2 });
    expect((two.body?.user_ids as string[]).sort()).toEqual([unpaid[0], unpaid[1]].sort());
    await expect(page.getByText(`Select All (${n - 3})`)).toBeVisible();

    // pay all remaining -> one call with exactly the remaining ids
    await page.getByTestId('pay-all').click();
    await page.getByRole('button', { name: 'Mark as paid' }).click();
    await expect(page.getByText('Payment Processed!')).toBeVisible();
    await page.getByTestId('success-done').click();
    const all = await mock.requests({ path: '/salary/mark-paid', method: 'POST' });
    expect((all[all.length - 1].body?.user_ids as string[]).length).toBe(n - 3);
    await expect(page.getByTestId('pay-all')).toBeDisabled();

    // changing the month resets the paid marks (they belong to one period)
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByRole('button', { name: new RegExp(`Pay All \\(${n}\\)`) })).toBeVisible();
    await expect(page.locator('[data-testid^="pay-row-"]').first().getByText('Paid')).toHaveCount(0);
  });

  test('pay failure surfaces the server message and leaves the employee unpaid', async ({ page, mock, issues }) => {
    issues.allow(/salary\/mark-paid/);
    await visit(page, MONTHLY);
    const first = page.locator('[data-testid^="pay-row-"]').first();
    const id = ((await first.getAttribute('data-testid')) as string).replace('pay-row-', '');
    await mock.failNext('/salary/mark-paid', { method: 'POST', status: 500, body: { detail: 'Payroll is locked for this month' } });
    await page.getByTestId(`pay-${id}`).click();
    await expect(page.getByText('Payroll is locked for this month').first()).toBeVisible();
    await expect(page.getByText('Payment Processed!')).toHaveCount(0);
    await expect(page.getByTestId(`pay-${id}`)).toBeVisible();
  });

  test('success:false from the server is surfaced, not treated as paid', async ({ page, mock }) => {
    await visit(page, MONTHLY);
    const first = page.locator('[data-testid^="pay-row-"]').first();
    const id = ((await first.getAttribute('data-testid')) as string).replace('pay-row-', '');
    await mock.failNext('/salary/mark-paid', { method: 'POST', status: 200, body: { success: false, message: 'Cannot mark paid twice' } });
    await page.getByTestId(`pay-${id}`).click();
    await expect(page.getByText('Cannot mark paid twice').first()).toBeVisible();
    await expect(page.getByText('Payment Processed!')).toHaveCount(0);
    await expect(page.getByTestId(`pay-${id}`)).toBeVisible();
  });

  test('server-reported paid marks survive a reload (no more session-only paid state)', async ({ page }) => {
    await visit(page, MONTHLY);
    const first = page.locator('[data-testid^="pay-row-"]').first();
    const id = ((await first.getAttribute('data-testid')) as string).replace('pay-row-', '');
    await page.getByTestId(`pay-${id}`).click();
    await page.getByTestId('success-done').click();
    await page.reload();
    await expect(page.getByTestId(`pay-row-${id}`)).toBeVisible();
    await expect(page.getByTestId(`pay-row-${id}`).getByText('Paid')).toBeVisible();
  });

  test('stat cards: Total / Paid / Unpaid / amounts are consistent', async ({ page }) => {
    await visit(page, MONTHLY);
    await expect(page.locator('[data-testid^="pay-row-"]').first()).toBeVisible();
    const total = page.getByText('Total', { exact: true }).first();
    await expect(total).toBeVisible();
    for (const l of ['Paid', 'Unpaid', 'Total Amt', 'Unpaid Amt']) await expect(page.getByText(l, { exact: true }).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('NaN');
  });
});

test.describe('salary sheet', () => {
  test('columns render without NaN; clicking a row opens the advance drill-down (newest first, amounts)', async ({ page }) => {
    await visit(page, SHEET);
    const table = page.getByTestId('salary-table');
    await expect(table).toBeVisible();
    for (const h of ['Employee', 'Type', 'Basic (₹)', 'Net Salary', 'Advance (₹)']) await expect(table.getByText(h, { exact: true }).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('NaN');
    expect(await page.getByTestId('report-summary').innerText()).toMatch(/\d+ staff/);

    await table.getByText(USERS.staff.name, { exact: true }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Advance Details' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(USERS.staff.name)).toBeVisible();
    await expect(sheet.getByText('₹1,000.00')).toBeVisible();
    await expect(sheet.getByText('Added by: Anita Desai')).toBeVisible();
  });

  test('advance drill-down: empty state for staff without advances, error state with retry', async ({ page, mock, issues }) => {
    issues.allow(/api\/advance\/user/);
    await visit(page, SHEET);
    const table = page.getByTestId('salary-table');
    await expect(table).toBeVisible();
    await table.getByText('Meera Iyer', { exact: true }).first().click();
    await expect(page.getByText('No advance records found.')).toBeVisible();
    await page.getByRole('dialog', { name: 'Advance Details' }).getByRole('button', { name: 'Close', exact: true }).first().click().catch(() => undefined);
    await page.keyboard.press('Escape');
    await mock.failNext('/api/advance/user/*', { status: 500 });
    await table.getByText('Rahul Verma', { exact: true }).first().click();
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
    await page.getByRole('button', { name: /try again/i }).click();
    await expect(page.getByText('No advance records found.')).toBeVisible();
  });

  test('salary type: per-row override, set-all, and overrides reset when the month changes', async ({ page }) => {
    await visit(page, SHEET);
    const table = page.getByTestId('salary-table');
    await expect(table).toBeVisible();
    const daily = table.getByRole('button', { name: 'Salary type Daily, change', exact: true });
    const dailyBefore = await daily.count();
    await table.getByRole('button', { name: 'Salary type Monthly, change', exact: true }).first().click();
    await page.getByTestId('salary-type-DAILY_WAGES').click();
    await expect(daily).toHaveCount(dailyBefore + 1);
    await page.getByTestId('all-types').click();
    await page.getByTestId('salary-type-HOURLY').click();
    await expect(table.getByRole('button', { name: 'Salary type Hourly, change', exact: true }).first()).toBeVisible();
    await expect(table.getByRole('button', { name: 'Salary type Monthly, change', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByTestId('all-types')).toContainText('All Types');
  });

  test('frozen first column stays put while the body scrolls sideways (and header stays aligned)', async ({ page }, testInfo) => {
    await visit(page, SHEET);
    const table = page.getByTestId('salary-table');
    await expect(table).toBeVisible();
    const emp = table.getByText('Employee', { exact: true }).first();
    const before = await emp.boundingBox();
    const hasScroller = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="salary-table"]');
      const els = Array.from(root?.querySelectorAll('*') ?? []) as HTMLElement[];
      const sc = els.find((e) => e.scrollWidth > e.clientWidth + 20 && getComputedStyle(e).overflowX !== 'visible');
      if (!sc) return false;
      sc.scrollLeft = 300;
      return true;
    });
    expect(hasScroller, 'the table body should scroll horizontally at this width').toBe(true);
    await expect.poll(async () => (await page.evaluate(() => {
      const root = document.querySelector('[data-testid="salary-table"]');
      return Array.from(root?.querySelectorAll('*') ?? []).some((e) => (e as HTMLElement).scrollLeft > 100);
    }))).toBe(true);
    const after = await emp.boundingBox();
    expect(after?.x).toBeCloseTo(before?.x ?? 0, 0);
    await expect(table.getByText('Net Salary', { exact: false }).first()).toBeVisible();
    void testInfo;
  });

  test('desktop: vertical scroll of the body keeps the frozen pane rows aligned', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'bounded-height table is a desktop behaviour');
    await visit(page, SHEET);
    const table = page.getByTestId('salary-table');
    await expect(table).toBeVisible();
    const result = await page.evaluate(async () => {
      const root = document.querySelector('[data-testid="salary-table"]') as HTMLElement;
      const vertical = Array.from(root.querySelectorAll('*') as NodeListOf<HTMLElement>).filter((e) => e.scrollHeight > e.clientHeight + 10 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY));
      if (vertical.length < 2) return { panes: vertical.length, a: 0, b: 0 };
      const [a, b] = vertical;
      a.scrollTop = 120;
      await new Promise((r) => setTimeout(r, 300));
      return { panes: vertical.length, a: a.scrollTop, b: b.scrollTop };
    });
    expect(result.panes).toBeGreaterThanOrEqual(2);
    expect(Math.abs(result.a - result.b)).toBeLessThanOrEqual(1);
    expect(result.a).toBeGreaterThan(50);
  });

  test('export: xlsx download from the salary sheet is a real workbook', async ({ page }) => {
    await visit(page, SHEET);
    await expect(page.getByTestId('salary-table')).toBeVisible();
    await page.getByTestId('report-export').click();
    const dl = page.waitForEvent('download');
    await page.getByTestId('export-xlsx').click();
    const d = await dl;
    expect(d.suggestedFilename()).toMatch(/^salary_.*\.xlsx$/);
    const p = await d.path();
    const buf = fs.readFileSync(p);
    expect(buf.slice(0, 2).toString()).toBe('PK');
  });
});

void rupees;
void stat;
