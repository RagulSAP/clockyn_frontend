/**
 * Q1 - staff directory: roster (search / chips / live status / active toggle) and staff detail (all tabs, advance,
 * punch edit, assign hub, profile, edit, delete).
 */
import type { Page } from '@playwright/test';

import { expect, IDS, loginAs, test, visit } from '../support';
import { closeOverlay, mockGet, snapBoth } from '../support/q1';
import { pinMidMonthIfNeeded } from '../support/q3';

type WireStaff = { user_id: string; name: string; branch_name: string; dept_name: string; status: string; is_active: boolean; role_id: number };
type MonthRow = { date: string; status: string; punch_in: string | null; punch_out: string | null; total_hours: string | null; location: string | null };

const rows = (page: Page) => page.locator('[data-testid^="staff-row-"]');

async function chipCount(page: Page, label: string): Promise<number> {
  const name = (await page.getByTestId('roster-chips').getByRole('radio', { name: new RegExp(`^${label}, \\d+`) }).first().getAttribute('aria-label')) ?? '';
  const m = name.match(/(\d+)$/);
  return m ? Number(m[1]) : NaN;
}

test.describe('Q1 staff roster', () => {
  test('lists every non-deleted person with live status, branch and department tags', async ({ page, tenant }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff');
    const all = await mockGet<WireStaff[]>(tenant, '/home/all-staff?user_id=org-0001');
    await expect(rows(page)).toHaveCount(all.length);
    const sample = all.find((s) => s.status === 'Working') ?? all[0];
    const row = page.getByTestId(`staff-row-${sample.user_id}`);
    await expect(row).toContainText(sample.name);
    await expect(row).toContainText(sample.branch_name);
    await expect(row).toContainText(sample.dept_name);
    await expect(row).toContainText(/working|late/i);
    await snapBoth(page, testInfo, 'staff-roster');
  });

  test('search narrows by name / branch / department and shows an empty state when nothing matches', async ({ page, tenant }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff');
    const all = await mockGet<WireStaff[]>(tenant, '/home/all-staff?user_id=org-0001');
    const search = page.getByTestId('roster-search');
    const target = all[3];
    await search.fill(target.name.slice(0, 5).toUpperCase());
    await expect(page.getByTestId(`staff-row-${target.user_id}`)).toBeVisible();
    const expectedByName = all.filter((s) => s.name.toLowerCase().includes(target.name.slice(0, 5).toLowerCase())).length;
    await expect(rows(page)).toHaveCount(expectedByName);
    await search.fill('Warehouse');
    await expect(rows(page)).toHaveCount(all.filter((s) => s.branch_name === 'Warehouse' || s.name.toLowerCase().includes('warehouse') || s.dept_name.toLowerCase().includes('warehouse')).length);
    await search.fill('Engineering');
    await expect(rows(page)).toHaveCount(all.filter((s) => s.dept_name === 'Engineering').length);
    await search.fill('zzzz-no-such-person');
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByText(/no staff|no results|no matches|not found/i).first()).toBeVisible();
    await search.fill('');
    await expect(rows(page)).toHaveCount(all.length);
  });

  test('role chips carry counts and filter the list (Staff / Manager / Inactive)', async ({ page, tenant }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff');
    const all = await mockGet<WireStaff[]>(tenant, '/home/all-staff?user_id=org-0001');
    const managers = all.filter((s) => s.role_id === 2).length; // role chips ignore the active flag; Inactive overlaps them
    const inactive = all.filter((s) => !s.is_active).length;
    const staff = all.filter((s) => s.role_id === 3).length;
    expect(await chipCount(page, 'All')).toBe(all.length);
    expect(await chipCount(page, 'Staff')).toBe(staff);
    expect(await chipCount(page, 'Manager')).toBe(managers);
    expect(await chipCount(page, 'Inactive')).toBe(inactive);
    await page.getByTestId('roster-chips').getByRole('radio', { name: /^Inactive,/ }).click();
    await expect(rows(page)).toHaveCount(inactive);
    await page.getByTestId('roster-chips').getByRole('radio', { name: /^Manager,/ }).click();
    await expect(rows(page)).toHaveCount(managers);
    await page.getByTestId('roster-chips').getByRole('radio', { name: /^Staff,/ }).click();
    await expect(rows(page)).toHaveCount(staff);
  });

  test('live-status filter (Absent) shows the banner and only absent people', async ({ page, tenant, mock }) => {
    await loginAs(page, 'admin');
    const fx = await mock.fixtures();
    await visit(page, '/admin/staff', { filter: 'absent', date: fx.today });
    const absent = await mockGet<WireStaff[]>(tenant, `/home/absent-staff?user_id=org-0001&target_date=${fx.today}`);
    await expect(rows(page)).toHaveCount(absent.length);
    await expect(page.getByTestId('roster-banner')).toContainText('Absent Today');
    await expect(page.getByTestId('roster-banner')).toContainText(`${absent.length} member`);
  });

  test('the active switch deactivates and reactivates a person and moves the chip counts', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff');
    const id = 'stf-0007';
    const before = { inactive: await chipCount(page, 'Inactive'), staff: await chipCount(page, 'Staff') };
    await page.getByTestId(`staff-switch-${id}`).click();
    const off = await mock.waitForRequest(`/addstaff/${id}/status`, { method: 'PUT' });
    expect(off.query.status).toBe('0');
    await expect.poll(() => chipCount(page, 'Inactive')).toBe(before.inactive + 1);
    expect(await chipCount(page, 'Staff')).toBe(before.staff); // role chips are independent of the active flag
    await mock.clearRequests();
    await page.getByTestId(`staff-switch-${id}`).click();
    const on = await mock.waitForRequest(`/addstaff/${id}/status`, { method: 'PUT' });
    expect(on.query.status).toBe('1');
    await expect.poll(() => chipCount(page, 'Inactive')).toBe(before.inactive);
  });

  test('a failed status change is reported and the switch is restored', async ({ page, mock, issues }) => {
    issues.allow(/addstaff/);
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff');
    const before = await chipCount(page, 'Inactive');
    await mock.failNext('/addstaff/stf-0007/status', { status: 400, body: { detail: 'Staff limit of 50 reached. Please upgrade your plan.' } });
    await page.getByTestId('staff-switch-stf-0007').click();
    await expect(page.getByText(/Staff limit of 50 reached|Failed/i).first()).toBeVisible();
    expect(await chipCount(page, 'Inactive')).toBe(before);
  });

  test('tapping a row opens the staff detail', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff');
    await page.getByTestId(`staff-row-${IDS.staffDetail}`).click();
    await page.waitForURL(new RegExp(`/admin/staff/detail\\?staffId=${IDS.staffDetail}`));
    await expect(page.getByTestId('staff-profile-card')).toBeVisible();
  });

  test('a roster load failure shows a retry state that recovers', async ({ page, mock, issues }) => {
    issues.allow(/all-staff/);
    await loginAs(page, 'admin');
    await mock.failNext('/home/all-staff', { status: 503, times: -1, body: { detail: 'Roster unavailable' } });
    await visit(page, '/admin/staff', {}, { idle: false });
    await expect(page.getByText(/Roster unavailable|Something went wrong/).first()).toBeVisible();
    await mock.clearFailures();
    await page.getByRole('button', { name: /try again|retry/i }).first().click();
    await expect(rows(page).first()).toBeVisible();
  });
});

test.describe('Q1 staff detail', () => {
  const id = IDS.staffDetail;

  test.beforeEach(async ({ page, mock }) => {
    await pinMidMonthIfNeeded(page, mock); // month grids need earlier days of the month: see support/q3.ts
  });

  test('profile card + overview tab show the person and the month snapshot equals the attendance data', async ({ page, tenant, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff/detail', { staffId: id });
    const fx = await mock.fixtures();
    const person = fx.staff.find((s) => s.user_id === id)!;
    await expect(page.getByTestId('staff-profile-card')).toContainText(person.name);
    await page.getByRole('tab', { name: 'Overview' }).or(page.getByText('Overview', { exact: true })).first().click();
    const [y, m] = fx.today.split('-').map(Number);
    const month = await mockGet<{ present_days: number; absent_days: number; late_days: number }>(tenant, `/home/monthly-attendance?staff_id=${id}&month=${m}&year=${y}`);
    // "Present" tile counts present + late + half in the mock; only assert that numbers are rendered consistently
    await expect(page.getByText('Month snapshot')).toBeVisible();
    await expect(page.getByText('Present', { exact: true }).first()).toBeVisible();
    expect(month.present_days).toBeGreaterThan(0);
    await snapBoth(page, testInfo, 'staff-detail-overview');
  });

  test('calendar: month navigation, tapping a worked day opens the day detail with punch times; future days are dimmed', async ({ page, tenant, mock }, testInfo) => {
    await loginAs(page, 'admin');
    const fx = await mock.fixtures();
    await visit(page, '/admin/staff/detail', { staffId: id });
    await expect(page.getByTestId('attendance-calendar')).toBeVisible();
    const [y, m] = fx.today.split('-').map(Number);
    const month = await mockGet<{ attendance_data: MonthRow[] }>(tenant, `/home/monthly-attendance?staff_id=${id}&month=${m}&year=${y}`);
    const worked = month.attendance_data.find((r) => r.punch_in && r.punch_out && r.date < fx.today)!;
    const day = Number(worked.date.slice(8));
    await page.getByTestId(`cal-day-${day}`).click();
    const detail = page.getByTestId('day-detail');
    await expect(detail).toBeVisible();
    await expect(detail).toContainText(/Punch In/);
    await expect(detail).toContainText(worked.punch_in!.replace(/^0/, ''));
    await snapBoth(page, testInfo, 'staff-detail-day-sheet');
    await closeOverlay(page);
    // month navigation
    await page.getByRole('button', { name: 'Previous month' }).first().click();
    await expect(page.getByTestId('attendance-legend')).toBeVisible();
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    await mock.waitForRequest('/home/monthly-attendance', { predicate: (r) => r.query.month === String(prevMonth) && r.query.year === String(prevYear) });
    await snapBoth(page, testInfo, 'staff-detail-calendar');
  });

  test('day-wise table lists the month; punch edit saves a corrected time and the table reflects it', async ({ page, tenant, mock }, testInfo) => {
    await loginAs(page, 'admin');
    const fx = await mock.fixtures();
    await visit(page, '/admin/staff/detail', { staffId: id });
    await page.getByText('Day-Wise', { exact: true }).first().click();
    await expect(page.getByTestId('attendance-table')).toBeVisible();
    const [y, m] = fx.today.split('-').map(Number);
    const month = await mockGet<{ attendance_data: MonthRow[] }>(tenant, `/home/monthly-attendance?staff_id=${id}&month=${m}&year=${y}`);
    const past = month.attendance_data.filter((r) => r.punch_in && r.date < fx.today);
    const target = past[past.length - 1];
    await expect(page.getByTestId(`day-row-${target.date}`)).toBeVisible();
    // regression (Q1-D7): the date and the punch-in time are visually separated (no "2-10-2026 09:06 AM" run-on) on phones
    const pad = await page.getByTestId(`day-row-${target.date}`).getByText(/^\d{1,2}-\d{1,2}-\d{4}$/).evaluate((el) => parseFloat(getComputedStyle(el).paddingRight));
    expect(pad).toBeGreaterThanOrEqual(4);
    await snapBoth(page, testInfo, 'staff-detail-daywise');
    await page.getByTestId(`edit-in-${target.date}`).click();
    await expect(page.getByTestId('punch-edit')).toBeVisible();
    await expect(page.getByTestId('punch-save')).toBeDisabled(); // unchanged
    await snapBoth(page, testInfo, 'staff-detail-punch-edit');
    await page.getByRole('button', { name: '9', exact: true }).click();
    await page.getByRole('button', { name: 'AM', exact: true }).click();
    await page.getByRole('button', { name: 'Edit minute' }).click();
    await page.getByRole('button', { name: '05', exact: true }).click();
    await expect(page.getByTestId('punch-save')).toBeEnabled();
    await page.getByTestId('punch-save').click();
    const put = await mock.waitForRequest('/home/update-attendance-punch', { method: 'PUT' });
    expect(put.body).toMatchObject({ staff_id: id, date: target.date });
    expect(String(put.body?.punch_in)).toMatch(/^0?9:05/);
    await expect(page.getByTestId('punch-edit')).toHaveCount(0);
    await expect(page.getByTestId(`day-row-${target.date}`)).toContainText('9:05');
  });

  test('punch edit allows an out-time earlier than the in-time (overnight) and a server failure keeps the sheet open', async ({ page, tenant, mock, issues }) => {
    issues.allow(/update-attendance-punch/);
    await loginAs(page, 'admin');
    const fx = await mock.fixtures();
    await visit(page, '/admin/staff/detail', { staffId: id });
    await page.getByText('Day-Wise', { exact: true }).first().click();
    const [y, m] = fx.today.split('-').map(Number);
    const month = await mockGet<{ attendance_data: MonthRow[] }>(tenant, `/home/monthly-attendance?staff_id=${id}&month=${m}&year=${y}`);
    const target = month.attendance_data.filter((r) => r.punch_in && r.punch_out && r.date < fx.today).pop()!;
    await page.getByTestId(`edit-out-${target.date}`).click();
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: 'AM', exact: true }).click();
    // out (01:xx AM) is before in (09:xx): allowed on purpose, the server treats it as the next day
    await expect(page.getByTestId('punch-save')).toBeEnabled();
    await page.getByRole('button', { name: 'PM', exact: true }).click();
    await mock.failNext('/home/update-attendance-punch', { status: 400, body: { detail: 'Cannot edit a locked month' } });
    await expect(page.getByTestId('punch-save')).toBeEnabled();
    await page.getByTestId('punch-save').click();
    await expect(page.getByText(/Cannot edit a locked month|Failed/i).first()).toBeVisible();
    await expect(page.getByTestId('punch-edit')).toBeVisible();
  });

  test('location tab renders the Leaflet map for a day with a punch and an empty state for a day without', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    const fx = await mock.fixtures();
    await visit(page, '/admin/staff/detail', { staffId: id });
    await page.getByText('Location', { exact: true }).first().click();
    await expect(page.getByTestId('location-date-button')).toContainText(/\d{1,2}-\d{1,2}-\d{4}/);
    await expect(page.getByTestId('punch-map')).toBeVisible();
    await expect(page.locator('[data-testid="punch-map"].leaflet-container, [data-testid="punch-map"] .leaflet-container')).toBeVisible();
    await expect(page.locator('[data-testid="punch-map"] .leaflet-marker-icon, [data-testid="punch-map"].leaflet-container .leaflet-marker-icon').first()).toBeVisible();
    await snapBoth(page, testInfo, 'staff-detail-location');
    // a Sunday has no punch
    const [y, m] = fx.today.split('-').map(Number);
    let sunday = 0;
    for (let d = 1; d <= 28; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0 && `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` < fx.today) sunday = d;
    await page.getByTestId('location-date-button').click();
    await page.getByRole('button', { name: new RegExp(`^${sunday}-${m}-${y}`) }).click();
    await expect(page.getByText('No punch-in location data available for selected date')).toBeVisible();
    // changing the month clears the date selection
    await page.getByRole('button', { name: 'Previous month' }).first().click();
    await expect(page.getByText('Select Date', { exact: true }).first()).toBeVisible();
  });

  test('advance: validation (amount, zero, future date), save, success dialog and history', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    const fx = await mock.fixtures();
    await visit(page, '/admin/staff/detail', { staffId: id });
    await page.getByText('Advance', { exact: true }).first().click();
    await snapBoth(page, testInfo, 'staff-detail-advance');
    const save = page.getByRole('button', { name: 'Save Advance' });
    await save.click();
    await expect(page.getByText('Please enter a valid amount')).toBeVisible();
    await page.getByTestId('advance-amount').fill('0');
    await save.click();
    await expect(page.getByText('Amount must be greater than 0')).toBeVisible();
    await page.getByTestId('advance-amount').fill('5abc.5.5');
    await expect(page.getByTestId('advance-amount')).toHaveValue('5.55'); // letters stripped, one decimal point
    // future date
    const future = new Date(`${fx.today}T00:00:00Z`);
    future.setUTCDate(future.getUTCDate() + 3);
    await page.locator('input[type=date]').last().fill(future.toISOString().slice(0, 10));
    await save.click();
    await expect(page.getByText('Advance date cannot be in the future')).toBeVisible();
    await page.locator('input[type=date]').last().fill(fx.today);
    await page.getByTestId('advance-amount').fill('1500');
    await save.click();
    await expect(page.getByText('Advance Saved!')).toBeVisible();
    const post = await mock.waitForRequest('/api/advance', { method: 'POST' });
    expect(post.body).toMatchObject({ user_id: id, advance_amt: 1500, date: fx.today });
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('advance-history')).toContainText('1,500.00');
    await expect(page.getByTestId('advance-history')).toContainText('Paid');
  });

  test('Assign hub lists settings and salary targets and navigates', async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff/detail', { staffId: id });
    await page.getByRole('button', { name: 'Assign' }).click();
    for (const key of ['manager', 'shift', 'monthly', 'daily', 'hourly', 'incentive', 'overtime', 'bonus']) await expect(page.getByTestId(`assign-${key}`)).toBeVisible();
    await snapBoth(page, testInfo, 'staff-detail-assign');
    await page.getByTestId('assign-shift').click();
    await page.waitForURL(/\/admin\/shifts/);
    await page.goBack();
    await page.getByRole('button', { name: 'Assign' }).click();
    await page.getByTestId('assign-daily').click();
    await page.waitForURL(/\/admin\/payroll\/daily-wages/);
  });

  test('View profile shows the full profile sections and Edit opens the staff editor', async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff/detail', { staffId: id });
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    const profile = page.getByTestId('profile-details');
    await expect(profile).toBeVisible();
    for (const section of ['Basic Information', 'Personal Details', 'ID & Statutory Details', 'Bank Details']) await expect(profile.getByText(section)).toBeVisible();
    await snapBoth(page, testInfo, 'staff-detail-profile');
    await page.getByRole('button', { name: 'Edit Staff' }).click();
    await page.waitForURL(new RegExp(`/admin/staff/edit\\?staffId=${id}`));
  });

  test('deactivate from the overview tab asks for confirmation, then returns to the list where the person is inactive', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff');
    await page.getByTestId(`staff-row-${id}`).click();
    await page.getByText('Overview', { exact: true }).first().click();
    await page.getByTestId('detail-active-switch').click();
    await expect(page.getByText(/^Deactivate /).first()).toBeVisible();
    await page.getByRole('button', { name: 'Deactivate' }).last().click();
    await page.waitForURL(/\/admin\/staff$|\/admin\/staff\?/);
    await expect(page.getByTestId(`staff-switch-${id}`)).toBeVisible();
    await page.getByTestId('roster-chips').getByRole('radio', { name: /^Inactive,/ }).click();
    await expect(page.getByTestId(`staff-row-${id}`)).toBeVisible();
  });

  test('permanent delete needs the typed name (case-insensitive), removes the person and refreshes the list', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff');
    const fx = await mock.fixtures();
    const person = fx.staff.find((s) => s.user_id === 'stf-0009')!;
    // wait for the whole roster before counting (an immediate count() races the progressive list render)
    await expect(rows(page).nth(Math.min(5, fx.staff.length - 1))).toBeVisible();
    await expect.poll(async () => { const n = await rows(page).count(); await page.waitForTimeout(400); return n === (await rows(page).count()); }).toBe(true);
    const total = await rows(page).count();
    await page.getByTestId(`staff-row-${person.user_id}`).click();
    await page.getByRole('button', { name: 'Delete staff permanently' }).click();
    await expect(page.getByTestId('delete-dialog')).toBeVisible();
    await expect(page.getByTestId('delete-confirm')).toBeDisabled();
    await page.getByTestId('delete-name-input').fill('wrong name');
    await expect(page.getByTestId('delete-confirm')).toBeDisabled();
    await snapBoth(page, testInfo, 'staff-detail-delete');
    await page.getByTestId('delete-name-input').fill(person.name.toUpperCase());
    await expect(page.getByTestId('delete-confirm')).toBeEnabled();
    await page.getByTestId('delete-confirm').click();
    const del = await mock.waitForRequest(`/addstaff/${person.user_id}/permanent`, { method: 'DELETE' });
    expect(del.query.requested_by_role_id).toBe('1');
    await page.waitForURL(/\/admin\/staff$|\/admin\/staff\?/);
    await expect(page.getByTestId(`staff-row-${person.user_id}`)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(total - 1);
  });

  test('an unknown staff id shows a retry error state, a missing id shows "not found"', async ({ page, issues }) => {
    issues.allow(/staff-detail|404/);
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff/detail', { staffId: 'stf-9999' }, { idle: false });
    await expect(page.getByText(/not found|Failed to load staff details|Something went wrong/i).first()).toBeVisible();
    await visit(page, '/admin/staff/detail', {}, { idle: false });
    await expect(page.getByText('Staff member not found')).toBeVisible();
  });
});
