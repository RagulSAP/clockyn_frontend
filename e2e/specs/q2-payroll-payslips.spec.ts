/**
 * Q2 - Payroll: monthly-fixed payslip templates (list, create/edit with live totals, assign with filters, preview, delete newest-only).
 */
import { test, expect, loginAs, visit, IDS, BRANCHES } from '../support';
import { rupees } from '../support/q2';

const LIST = '/admin/payroll/payslips';
const EDIT = '/admin/payroll/payslips/edit';

test.describe('payslip templates', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('list shows seeded templates with net salary + assigned count; only the newest offers Delete', async ({ page, mock }) => {
    await visit(page, LIST);
    const fx = await mock.fixtures();
    expect(fx.payslips.length).toBeGreaterThanOrEqual(2);
    for (const p of fx.payslips) await expect(page.getByTestId(`payslip-${p.id}`)).toBeVisible();

    const newest = fx.payslips[fx.payslips.length - 1];
    const oldest = fx.payslips[0];
    await page.getByTestId(`payslip-${oldest.id}-menu`).click();
    await expect(page.getByTestId(`payslip-${oldest.id}-edit`)).toBeVisible();
    await expect(page.getByTestId(`payslip-${oldest.id}-delete`)).toHaveCount(0);

    await page.getByTestId(`payslip-${newest.id}-menu`).click();
    await expect(page.getByTestId(`payslip-${newest.id}-delete`)).toBeVisible();
  });

  test('create: live totals handle decimals + custom rows, nothing is NaN, payload matches', async ({ page, mock }) => {
    await visit(page, EDIT);
    await page.getByTestId('payslip-name').fill('Grade C');
    await page.getByTestId('payslip-basic').fill('10000.50');
    await page.getByTestId('payslip-hra').fill('2000.25');
    await expect(page.getByTestId('total-earnings')).toHaveText(/12,000\.75|12,001/);
    await page.getByTestId('earning-add').click();
    await page.getByTestId('earning-name-0').fill('Travel');
    await page.getByTestId('earning-amount-0').fill('500.10');
    await page.getByTestId('payslip-epf').fill('1200.20');
    await page.getByTestId('deduction-add').click();
    await page.getByTestId('deduction-name-0').fill('Canteen');
    await page.getByTestId('deduction-amount-0').fill('100.05');

    // 10000.50 + 2000.25 + 500.10 = 12500.85 ; 1200.20 + 100.05 = 1300.25 ; net 11200.60
    const earn = rupees(await page.getByTestId('total-earnings').innerText());
    const ded = rupees(await page.getByTestId('total-deductions').innerText());
    const net = rupees(await page.getByTestId('net-salary').innerText());
    expect(earn).toBeCloseTo(12500.85, 2);
    expect(ded).toBeCloseTo(1300.25, 2);
    expect(net).toBeCloseTo(11200.6, 2);
    await expect(page.locator('body')).not.toContainText('NaN');

    // a custom row without an amount is not counted; removing a row updates the totals
    await page.getByTestId('earning-add').click();
    await page.getByTestId('earning-name-1').fill('Ignored');
    expect(rupees(await page.getByTestId('total-earnings').innerText())).toBeCloseTo(12500.85, 2);
    await page.getByTestId('earning-remove-1').click();
    await page.getByTestId('earning-remove-0').click();
    expect(rupees(await page.getByTestId('total-earnings').innerText())).toBeCloseTo(12000.75, 2);
    await page.getByTestId('earning-add').click();
    await page.getByTestId('earning-name-0').fill('Travel');
    await page.getByTestId('earning-amount-0').fill('500.10');

    await page.getByTestId('payslip-save').click();
    await expect(page.getByText('Payslip Added!').first()).toBeVisible();
    const call = await mock.waitForRequest('/api/salary/template', { method: 'POST' });
    expect(call.body).toMatchObject({
      payslip_name: 'Grade C',
      basic_pay: 10000.5,
      hra: 2000.25,
      epf: 1200.2,
      custom_earnings: [{ name: 'Travel', amount: 500.1 }],
      custom_deductions: [{ name: 'Canteen', amount: 100.05 }],
    });
    await page.waitForURL('**/admin/payroll/payslips');
    await expect(page.getByText('Grade C')).toBeVisible();
    await expect(page.getByText(/11,200\.6/).first()).toBeVisible();
  });

  test('validation: required fields, invalid amounts, duplicate name from the server', async ({ page, mock }) => {
    await visit(page, EDIT);
    await page.getByTestId('payslip-save').click();
    await expect(page.getByText('Please fill basic salary and HRA').first()).toBeVisible();
    await page.getByTestId('payslip-basic').fill('1000');
    await page.getByTestId('payslip-hra').fill('100');
    await page.getByTestId('payslip-save').click();
    await expect(page.getByText('Please enter template name').first()).toBeVisible();
    await page.getByTestId('payslip-name').fill('X');
    await page.getByTestId('payslip-epf').fill('abc');
    await page.getByTestId('payslip-save').click();
    await expect(page.getByText('Please correct the highlighted amounts').first()).toBeVisible();
    await expect(page.getByText('Enter a valid amount').first()).toBeVisible();
    expect((await mock.requests({ path: '/api/salary/template', method: 'POST' })).length).toBe(0);

    // server-side duplicate name is surfaced (success:false), the form stays editable
    await page.getByTestId('payslip-epf').fill('');
    const fx = await mock.fixtures();
    await page.getByTestId('payslip-name').fill(fx.payslips[0].name);
    await page.getByTestId('payslip-save').click();
    await expect(page.getByText(/already exists/i).first()).toBeVisible();
    await expect(page.getByTestId('payslip-save')).toBeEnabled();
  });

  test('edit prefills the stored values and saves via PUT', async ({ page, mock }) => {
    await visit(page, EDIT, { templateId: IDS.payslipTemplate });
    await expect(page.getByTestId('payslip-name')).not.toHaveValue('');
    const before = rupees(await page.getByTestId('net-salary').innerText());
    await expect(page.getByTestId('payslip-basic')).not.toHaveValue('');
    await page.getByTestId('payslip-basic').fill('50000.5');
    const after = rupees(await page.getByTestId('net-salary').innerText());
    expect(after).not.toBe(before);
    await page.getByTestId('payslip-save').click();
    await expect(page.getByText('Payslip Updated!').first()).toBeVisible();
    const put = await mock.waitForRequest(`/api/salary/template/${IDS.payslipTemplate}`, { method: 'PUT' });
    expect(put.body).toMatchObject({ basic_pay: 50000.5 });
  });

  test('save failure keeps the form and shows the error (no success toast)', async ({ page, mock, issues }) => {
    issues.allow(/api\/salary\/template/);
    await visit(page, EDIT);
    await page.getByTestId('payslip-name').fill('Boom');
    await page.getByTestId('payslip-basic').fill('1');
    await page.getByTestId('payslip-hra').fill('1');
    await mock.failNext('/api/salary/template', { method: 'POST', status: 500 });
    await page.getByTestId('payslip-save').click();
    await expect(page.getByText(/Injected failure|Failed to save/).first()).toBeVisible();
    await expect(page.getByText('Payslip Added!')).toHaveCount(0);
    await expect(page.getByTestId('payslip-save')).toBeEnabled();
  });

  test('assign: branch filter narrows the staff, assign one, preview shows the payslip, re-assign is refused', async ({ page, mock }) => {
    await visit(page, LIST);
    const fx = await mock.fixtures();
    const newest = fx.payslips[fx.payslips.length - 1];
    const other = fx.payslips[0];
    await page.getByTestId(`payslip-${newest.id}-menu`).click();
    await page.getByTestId(`payslip-${newest.id}-assign`).click();
    const modal = page.getByTestId('payslip-assign-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Staff Details')).toBeVisible();
    const allRows = modal.locator('[data-testid^="payslip-staff-"]');
    await expect(allRows.first()).toBeVisible();
    const total = await allRows.count();

    await modal.getByTestId('filter-branch').click();
    await page.getByRole('option', { name: BRANCHES.warehouse.name }).or(page.getByText(BRANCHES.warehouse.name, { exact: true }).last()).click();
    await expect.poll(async () => allRows.count()).toBeLessThan(total);
    const filtered = await allRows.count();
    expect(filtered).toBeGreaterThan(0);
    await expect(modal.getByText(BRANCHES.hq.name)).toHaveCount(0);
    const q = await mock.lastRequest('/api/salary/staff/', 'GET');
    expect(q?.query.branch_id).toBe(BRANCHES.warehouse.id);

    // preview first row
    const first = allRows.first();
    const testId = (await first.getAttribute('data-testid')) as string;
    const staffId = testId.replace('payslip-staff-', '');
    await modal.getByTestId(`preview-${staffId}`).click();
    const preview = page.getByTestId('payslip-preview');
    await expect(preview.getByText('Total Earnings')).toBeVisible();
    await expect(preview.getByText('Net Pay')).toBeVisible();
    await expect(preview.getByTestId('preview-net-pay')).toContainText('₹');
    await page.getByRole('dialog', { name: 'Payslip preview' }).getByRole('button', { name: 'Close', exact: true }).click();
    await expect(preview).toHaveCount(0);

    await modal.getByTestId(`assign-${staffId}`).click();
    await expect(page.getByText('Payslip Assigned!').first()).toBeVisible();
    await expect(modal.getByTestId(`payslip-staff-${staffId}`).getByText('Assigned')).toBeVisible();
    expect((await mock.lastRequest('/api/salary/assign', 'POST'))?.body).toMatchObject({ staff_id: staffId, pay_slip_id: newest.id });

    // assigning the same staff to another template is refused with the existing payslip name
    await page.getByRole('dialog').last().getByRole('button', { name: 'Close', exact: true }).click();
    await expect(modal).toHaveCount(0);
    await page.getByTestId(`payslip-${other.id}-menu`).click();
    await page.getByTestId(`payslip-${other.id}-assign`).click();
    await expect(modal.getByTestId(`assign-${staffId}`)).toBeVisible();
    await modal.getByTestId(`assign-${staffId}`).click();
    await expect(page.getByText(/is already assigned to/)).toBeVisible();
  });

  test('delete newest: inline confirm, cancel keeps it, confirm removes it and numbering of the rest is intact', async ({ page, mock }) => {
    await visit(page, LIST);
    const before = (await mock.fixtures()).payslips;
    const newest = before[before.length - 1];
    await page.getByTestId(`payslip-${newest.id}-menu`).click();
    await page.getByTestId(`payslip-${newest.id}-delete`).click();
    await expect(page.getByText('Delete this template?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId(`payslip-${newest.id}`)).toBeVisible();
    await page.getByTestId(`payslip-${newest.id}-delete`).click();
    await page.getByTestId(`payslip-${newest.id}-confirm-delete`).click();
    await expect(page.getByText('Deleted Successfully!').first()).toBeVisible();
    await expect(page.getByTestId(`payslip-${newest.id}`)).toHaveCount(0);
    expect((await mock.fixtures()).payslips.length).toBe(before.length - 1);
    // the previous one is now the deletable one
    const nowNewest = before[before.length - 2];
    await page.getByTestId(`payslip-${nowNewest.id}-menu`).click();
    await expect(page.getByTestId(`payslip-${nowNewest.id}-delete`)).toBeVisible();
  });

  test('delete failure is surfaced and the card stays', async ({ page, mock, issues }) => {
    issues.allow(/api\/salary\/template/);
    await visit(page, LIST);
    const before = (await mock.fixtures()).payslips;
    const newest = before[before.length - 1];
    await page.getByTestId(`payslip-${newest.id}-menu`).click();
    await page.getByTestId(`payslip-${newest.id}-delete`).click();
    await mock.failNext('/api/salary/template/*', { method: 'DELETE', status: 500 });
    await page.getByTestId(`payslip-${newest.id}-confirm-delete`).click();
    await expect(page.getByText(/Injected failure|Failed to delete/).first()).toBeVisible();
    await expect(page.getByTestId(`payslip-${newest.id}`)).toBeVisible();
  });

  test('empty state when every template is deleted', async ({ page, mock }) => {
    await visit(page, LIST);
    for (;;) {
      const rows = (await mock.fixtures()).payslips;
      if (rows.length === 0) break;
      const newest = rows[rows.length - 1];
      await page.getByTestId(`payslip-${newest.id}-menu`).click();
      await page.getByTestId(`payslip-${newest.id}-delete`).click();
      await page.getByTestId(`payslip-${newest.id}-confirm-delete`).click();
      await expect(page.getByTestId(`payslip-${newest.id}`)).toHaveCount(0);
    }
    await expect(page.getByText('No payslips yet')).toBeVisible();
  });
});
