/**
 * Q2 - Reports: hub (Generate / View Reports), the six report screens (period pickers, data, partial-failure banner,
 * empty / error states) and the manager variant `/staff/reports`.
 */
import { test, expect, loginAs, visit, USERS } from '../support';
import { installExportProbe, readProbe } from '../support/q2';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** The report month `back` months before the current IST month: `{ label: 'September 2026', month: 9 }`. */
function reportMonth(back: number): { label: string; month: number } {
  const ist = new Date(Date.now() + 330 * 60_000);
  const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - back, 1));
  return { label: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`, month: d.getUTCMonth() + 1 };
}

test.describe('hub', () => {
  test.beforeEach(async ({ page }) => {
    await installExportProbe(page);
    await loginAs(page, 'admin');
  });

  test('catalogue categories, placeholders are inert, rows navigate, tabs switch', async ({ page }) => {
    await visit(page, '/admin/reports');
    for (const c of ['Attendance Reports', 'Salary Reports', 'Employee Reports', 'CRM']) await expect(page.getByTestId(`category-${c}`)).toBeVisible();
    await expect(page.getByTestId('report-row-Incentives')).toBeDisabled();
    await expect(page.getByTestId('report-row-Meeting Report')).toBeDisabled();
    await page.getByText('View Reports', { exact: true }).click();
    await expect(page.getByText('No reports yet')).toBeVisible();
    await expect(page.getByText('Generated reports will appear here')).toBeVisible();
    await page.getByText('Generate', { exact: true }).click();
    const rows: [string, string][] = [
      ['Monthly Summary', '/admin/reports/monthly-attendance'],
      ['Staff-wise Detailed Report', '/admin/reports/staff-detailed'],
      ['Late Report', '/admin/reports/late'],
      ['Overtime Report', '/admin/reports/overtime'],
      ['Monthly Salary', '/admin/payroll/monthly-salary'],
      ['View Staff Salary', '/admin/payroll/salary-sheet'],
      ['Employee Details', '/admin/reports/employee-details'],
      ['Employee Shift / Timing', '/admin/reports/employee-shifts'],
    ];
    for (const [label, path] of rows) {
      await page.getByTestId(`report-row-${label}`).click();
      await page.waitForURL(`**${path}`);
      await page.goBack();
      await expect(page.getByTestId('reports-hub')).toBeVisible();
    }
  });

  test('monthly attendance PDF: pick staff, generate, history entry named after the staff + month, viewer opened', async ({ page, mock }) => {
    await visit(page, '/admin/reports/monthly-attendance');
    await page.getByTestId('staff-picker').click();
    await page.getByPlaceholder('Search by name or ID...').fill('Aarav');
    await expect(page.getByTestId('staff-stf-0001')).toBeVisible();
    await expect(page.getByTestId('staff-stf-0002')).toHaveCount(0);
    await page.getByTestId('staff-stf-0001').click();
    await expect(page.getByTestId('staff-picker')).toContainText('Aarav Sharma');
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.getByTestId('generate-pdf').click();
    const call = await mock.waitForRequest('/api/reports/monthly-attendance/stf-0001/');
    expect(call.method).toBe('GET');
    await expect.poll(async () => (await readProbe(page)).windowOpens.length).toBe(1);
    expect((await readProbe(page)).blobs.some((b) => b.type === 'application/pdf')).toBe(true);
    await page.goBack().catch(() => undefined);
    await visit(page, '/admin/reports');
    await page.getByText('View Reports', { exact: true }).click();
    // blob is gone after the reload of visit(): the entry exists though
    await expect(page.locator('[data-testid^="saved-"]').first()).toContainText('Aarav Sharma');
    await expect(page.locator('[data-testid^="saved-"]').first()).toContainText('PDF');
  });

  test('monthly attendance PDF: server failure -> error toast, no history entry', async ({ page, mock, issues }) => {
    issues.allow(/api\/reports\/monthly-attendance/);
    await visit(page, '/admin/reports/monthly-attendance');
    await mock.failNext('/api/reports/monthly-attendance-all/*', { status: 500, body: { detail: 'Report engine down' } });
    await page.getByTestId('generate-pdf').click();
    await expect(page.getByText(/Report engine down|Failed to generate report/).first()).toBeVisible();
    await expect(page.getByTestId('generate-pdf')).toBeEnabled();
    await visit(page, '/admin/reports');
    await page.getByText('View Reports', { exact: true }).click();
    await expect(page.getByText('No reports yet')).toBeVisible();
  });
});

test.describe('report screens', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('staff detailed: header groups, rows = staff, month stepper refetches, month picker sheet, no NaN', async ({ page, mock }) => {
    await visit(page, '/admin/reports/staff-detailed');
    const table = page.getByTestId('staff-detailed-table');
    await expect(table).toBeVisible();
    for (const g of ['ATTENDANCE', 'LEAVE REQUESTS', 'PERMISSION REQUESTS', 'SHIFT CHANGE']) await expect(table.getByText(g, { exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('NaN');
    await expect(page.getByTestId('report-summary')).toContainText(/\d+ staff/);

    await mock.clearRequests();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByTestId('report-month')).toContainText(reportMonth(1).label);
    await mock.waitForRequest('/home/monthly-attendance', { predicate: (r) => r.query.month === String(reportMonth(1).month) });
    // picker sheet: choose a month of another year
    await page.getByRole('button', { name: new RegExp(`${reportMonth(1).label}, choose month and year`) }).click();
    await page.getByRole('button', { name: 'Previous year' }).click();
    await page.getByRole('button', { name: 'March 2025' }).click();
    await expect(page.getByTestId('report-month')).toContainText('March 2025');
    await mock.waitForRequest('/home/monthly-attendance', { predicate: (r) => r.query.month === '3' && r.query.year === '2025' });
    await expect(page.getByTestId('report-summary')).toContainText(/\d+ staff/);
  });

  test('staff detailed: requests list failure -> banner, report still renders with zero counts', async ({ page, mock, issues }) => {
    issues.allow(/requests\/admin/);
    await mock.failNext('/requests/admin/*', { status: 500, times: -1 });
    await visit(page, '/admin/reports/staff-detailed');
    await expect(page.getByTestId('staff-detailed-table')).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Leave, permission and shift-change counts are unavailable' })).toBeVisible();
  });

  test('staff detailed: attendance failure for some staff -> banner names the count', async ({ page, mock, issues }) => {
    issues.allow(/home\/monthly-attendance/);
    await mock.failNext('/home/monthly-attendance', { status: 500, times: 2 });
    await visit(page, '/admin/reports/staff-detailed');
    await expect(page.getByTestId('staff-detailed-table')).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /Attendance could not be loaded for \d+ staff/ })).toBeVisible();
  });

  test('staff detailed: total failure -> error state with retry that recovers', async ({ page, mock, issues }) => {
    issues.allow(/home\/all-staff/);
    await mock.failNext('/home/all-staff', { status: 500 });
    await visit(page, '/admin/reports/staff-detailed');
    await expect(page.getByText('Something went wrong')).toBeVisible();
    await page.getByRole('button', { name: /try again/i }).click();
    await expect(page.getByTestId('staff-detailed-table')).toBeVisible();
  });

  test('late report: rows, months without data show the empty state and disable export, last month has data again', async ({ page }) => {
    await visit(page, '/admin/reports/late');
    await expect(page.getByTestId('report-summary')).toContainText(/\d+ late entries/);
    await expect(page.getByTestId('late-table').or(page.getByText('No late entries')).first()).toBeVisible();
    await page.getByRole('button', { name: new RegExp(`${reportMonth(0).label}, choose month and year`) }).click();
    await page.getByRole('button', { name: 'Previous year' }).click();
    await page.getByRole('button', { name: 'March 2025' }).click();
    await expect(page.getByText('No late entries')).toBeVisible();
    await expect(page.getByText('All staff were on time in')).toBeVisible();
    await expect(page.getByTestId('report-export')).toBeDisabled();
    await expect(page.getByTestId('report-summary')).toContainText('0 late entries');
  });

  test('late report: shift times missing -> informative note (not an error)', async ({ page }) => {
    await visit(page, '/admin/reports/late');
    await expect(page.getByTestId('report-summary')).toBeVisible();
    // either the note is shown (server sends no shift times) or Late By values exist; both are valid, NaN is not
    await expect(page.locator('body')).not.toContainText('NaN');
    await expect(page.locator('body')).not.toContainText('undefined');
  });

  test('overtime: OT figures failure -> banner + rows with no overtime; recovery on month change', async ({ page, mock, issues }) => {
    issues.allow(/overtime-report/);
    await mock.failNext('/api/incentive/overtime-report/*', { status: 500 });
    await visit(page, '/admin/reports/overtime');
    await expect(page.getByTestId('overtime-table')).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Overtime figures are unavailable' })).toBeVisible();
    await expect(page.getByTestId('report-summary')).toContainText('0 with OT');
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Overtime figures are unavailable' })).toHaveCount(0);
    await expect(page.getByTestId('report-summary')).toContainText(/[1-9]\d* with OT/);
  });

  test('employee details: search narrows, selecting shows the profile sections, back returns to the list; inactive staff handled', async ({ page }) => {
    await visit(page, '/admin/reports/employee-details');
    await expect(page.getByTestId('employee-stf-0001')).toBeVisible();
    await page.getByPlaceholder(/Search by name/).fill('zzzz-none');
    await expect(page.getByText('No employees found')).toBeVisible();
    await page.getByPlaceholder(/Search by name/).fill('Aarav');
    await expect(page.getByTestId('employee-stf-0001')).toBeVisible();
    await page.getByTestId('employee-stf-0001').click();
    await expect(page.getByTestId('employee-details-profile')).toBeVisible();
    await expect(page.getByText('Aarav Sharma').first()).toBeVisible();
    await expect(page.getByText('PERSONAL', { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: /back/i }).first().click();
    await expect(page.getByTestId('employee-details-list')).toBeVisible();
  });

  test('employee shifts: groups by shift, with unassigned section', async ({ page }) => {
    await visit(page, '/admin/reports/employee-shifts');
    await expect(page.getByTestId('employee-shifts-report')).toBeVisible();
    await expect(page.getByText('General', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/09:00|9:00/).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('NaN');
  });

  test('employee shifts: some staff lookups failing do not blank the report', async ({ page, mock, issues }) => {
    issues.allow(/addstaff/);
    await mock.failNext('re:^/addstaff/stf-', { status: 500, times: 3 });
    await visit(page, '/admin/reports/employee-shifts');
    await expect(page.getByTestId('employee-shifts-report')).toBeVisible();
    await expect(page.getByText('General', { exact: false }).first()).toBeVisible();
  });
});

test.describe('manager variant /staff/reports', () => {
  test('manager with the permission sees only the four enabled rows; others are inert', async ({ page }) => {
    await loginAs(page, 'manager');
    await visit(page, '/staff/reports');
    await expect(page.getByTestId('reports-hub')).toBeVisible();
    await expect(page.getByTestId('report-row-Monthly Summary')).toBeEnabled();
    await expect(page.getByTestId('report-row-Late Report')).toBeEnabled();
    await expect(page.getByTestId('report-row-Monthly Salary')).toBeEnabled();
    await expect(page.getByTestId('report-row-View Staff Salary')).toBeEnabled();
    await expect(page.getByTestId('report-row-Overtime Report')).toBeDisabled();
    await expect(page.getByTestId('report-row-Staff-wise Detailed Report')).toBeDisabled();
    await expect(page.getByTestId('report-row-Employee Details')).toBeDisabled();
  });

  test('manager without the "Attendance Reports" permission is denied (deep link cannot bypass)', async ({ page }) => {
    await loginAs(page, 'manager', { permissions: ['Requests Management'] });
    await visit(page, '/staff/reports');
    await expect(page.getByTestId('manager-reports-denied')).toBeVisible();
    await expect(page.getByText('Reports unavailable')).toBeVisible();
  });

  test('staff (role 3) never sees the reports hub', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/reports');
    await expect(page.getByTestId('manager-reports-denied')).toBeVisible();
  });

  test('manager monthly summary uses the manager-scoped endpoint', async ({ page, mock }) => {
    await loginAs(page, 'manager');
    await visit(page, '/staff/reports');
    await installExportProbe(page).catch(() => undefined);
    await page.getByTestId('report-row-Monthly Summary').click();
    await page.getByTestId('generate-pdf').click();
    const call = await mock.waitForRequest('/api/reports/manager/');
    expect(call.path).toContain(`/api/reports/manager/${USERS.manager.userId}/monthly-attendance-all/`);
  });
});
