/**
 * Q3 - Attendance calendar (/staff/attendance): statuses + colours + legend, day sheet with sessions and photos,
 * month navigation, error/retry, payslip and bonus/advance sheets.
 */
import type { Page } from '@playwright/test';

import { expect, loginAs, test, USERS, visit } from '../support';
import type { MockClient } from '../support/mock';
import { pinMidMonthIfNeeded, snap } from '../support/q3';

interface Row {
  date: string;
  status: string;
  punch_in: string | null;
  punch_out: string | null;
  total_hours: number | null;
  punch_in_photo: string | null;
}

async function monthRows(page: Page, mock: MockClient, userId: string, year: number, month: number): Promise<Row[]> {
  const res = await page.request.get(`http://127.0.0.1:${process.env.MOCK_PORT ?? 8787}/home/monthly-attendance?staff_id=${userId}&month=${month}&year=${year}`, {
    headers: { 'x-e2e-tenant': mock.tenant },
  });
  return (await res.json()).attendance_data as Row[];
}

const isSunday = (iso: string): boolean => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
const cell = (page: Page, date: string) => page.getByTestId(`day-${date}`);
const bg = (page: Page, date: string) => cell(page, date).evaluate((el) => getComputedStyle(el).backgroundColor);

async function openCalendar(page: Page, mock: MockClient) {
  const today = (await mock.state()).today;
  const [y, m] = today.split('-').map(Number);
  await loginAs(page, 'staff');
  await visit(page, '/staff/attendance');
  await expect(page.getByTestId('attendance-calendar')).toBeVisible();
  await expect(page.getByTestId('calendar-loading')).toHaveCount(0);
  return { today, year: y, month: m };
}

test.describe('attendance calendar', () => {
  test.beforeEach(async ({ page, mock }) => {
    await pinMidMonthIfNeeded(page, mock); // month grids need earlier days of the month: see support/q3.ts
  });

  test('statuses are coloured consistently, Sundays use the weekly-off colour, the legend lists the statuses', async ({ page, mock }, testInfo) => {
    const { today, year, month } = await openCalendar(page, mock);
    const rows = (await monthRows(page, mock, USERS.staff.userId, year, month)).filter((r) => !isSunday(r.date) && r.date < today);
    expect(rows.length).toBeGreaterThan(3);
    for (const label of ['Present', 'Absent', 'Leave', 'Half Day', 'Sunday']) await expect(page.getByTestId('calendar-legend')).toContainText(label);
    const present = rows.find((r) => r.status === 'present');
    expect(present, 'seed has a present day this month').toBeTruthy();
    const presentColor = await bg(page, present!.date);
    expect(presentColor).not.toBe('rgba(0, 0, 0, 0)');
    for (const r of rows.filter((x) => x.status === 'present' && !isHalf(x))) expect(await bg(page, r.date), r.date).toBe(presentColor);
    const absentRow = rows.find((r) => r.status === 'absent');
    if (absentRow) expect(await bg(page, absentRow.date)).not.toBe(presentColor);
    // a Sunday in the month
    const sunday = Array.from({ length: 31 }, (_, i) => `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`).find((d) => d < today && isSunday(d) && new Date(d).getMonth() + 1 === month);
    if (sunday) expect(await bg(page, sunday)).not.toBe(presentColor);
    // late punches are captioned
    const late = rows.find((r) => r.status === 'late');
    if (late) await expect(cell(page, late.date)).toContainText('Late');
    await snap(page, testInfo, 'attendance-calendar');
  });

  test('tapping a worked day opens the sheet with status, shift, session punch times and total hours', async ({ page, mock }, testInfo) => {
    const { today, year, month } = await openCalendar(page, mock);
    const rows = await monthRows(page, mock, USERS.staff.userId, year, month);
    const worked = rows.filter((r) => r.date < today && r.status === 'present' && r.punch_in && r.punch_out && !isSunday(r.date)).pop();
    expect(worked).toBeTruthy();
    await cell(page, worked!.date).click();
    const sheet = page.getByTestId('day-sheet');
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('day-date')).toContainText(new Date(`${worked!.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }));
    await expect(page.getByTestId('day-status')).toContainText(/Present|Half Day/);
    await expect(page.getByTestId('day-shift')).toHaveText('09:00 AM – 06:00 PM');
    await expect(sheet).toContainText('SESSION 1');
    await expect(page.getByTestId('punch-in-card')).toContainText(/\d{2}:\d{2} (AM|PM)/);
    await expect(page.getByTestId('punch-out-card')).toContainText(/\d{2}:\d{2} (AM|PM)/);
    await expect(page.getByTestId('day-total-hours')).toBeVisible();
    await snap(page, testInfo, 'attendance-day-sheet');
    // the punch photo opens in the viewer
    await page.getByRole('button', { name: 'View punch in photo' }).click();
    await expect(page.getByRole('button', { name: 'Close image' })).toBeVisible();
    await page.getByRole('button', { name: 'Close image' }).click();
    await expect(page.getByRole('button', { name: 'Close image' })).toHaveCount(0);
    await expect(sheet).toBeVisible();
  });

  test('a day with two sessions lists both, today (punched in) shows its open session', async ({ page, mock }) => {
    // fieldStaff's colleague stf-0008 has two sessions today; staff gets one via punches
    const today = (await mock.state()).today;
    for (const [action, hh] of [['punch_in', '09:00'], ['punch_out', '13:00'], ['punch_in', '14:00']] as const) {
      await mock.setClock(`${today}T${hh}:00+05:30`);
      const r = await page.request.post(`http://127.0.0.1:${process.env.MOCK_PORT ?? 8787}/face/punch`, {
        headers: { 'x-e2e-tenant': mock.tenant },
        multipart: { user_id: USERS.staff.userId, org_id: 'org-0001', action, face: { name: 'f.png', mimeType: 'image/png', buffer: Buffer.from('x') } },
      });
      expect(r.ok()).toBe(true);
    }
    await mock.setClock(null);
    await loginAs(page, 'staff');
    await visit(page, '/staff/attendance');
    await cell(page, today).click();
    const sheet = page.getByTestId('day-sheet');
    await expect(sheet).toContainText('SESSION 1');
    await expect(sheet).toContainText('SESSION 2');
    await expect(sheet).toContainText('--:--'); // the open session has no punch-out yet
  });

  test('an elapsed day without a record opens as Absent; a future day is not tappable', async ({ page, mock }) => {
    const { today, year, month } = await openCalendar(page, mock);
    const rows = await monthRows(page, mock, USERS.staff.userId, year, month);
    const have = new Set(rows.map((r) => r.date));
    const gap = Array.from({ length: 31 }, (_, i) => `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`).find((d) => d < today && !have.has(d) && !isSunday(d) && new Date(`${d}T00:00:00Z`).getUTCMonth() + 1 === month);
    if (gap) {
      await cell(page, gap).click();
      await expect(page.getByTestId('day-status')).toContainText('Absent');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('day-sheet')).toHaveCount(0);
    }
    // next month, any day: nothing opens
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.getByRole('button', { name: 'Next month' })).toBeVisible();
    const nextDay = page.getByRole('button', { name: /^15 /});
    await nextDay.first().click();
    await expect(page.getByTestId('day-sheet')).toHaveCount(0);
  });

  test('month navigation loads the selected month and a failing month shows an error with retry', async ({ page, mock, issues }) => {
    const { year, month } = await openCalendar(page, mock);
    issues.allow(/monthly-attendance/);
    await mock.clearRequests();
    await mock.failNext('/home/monthly-attendance', { status: 503, body: { detail: 'Unavailable' } });
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByText('Could not load your attendance for this month.')).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('Could not load your attendance for this month.')).toHaveCount(0);
    await expect(page.getByTestId('attendance-calendar')).toBeVisible();
    const calls = await mock.requests({ path: '/home/monthly-attendance' });
    const prevMonth = month === 1 ? 12 : month - 1;
    expect(calls.at(-1)?.query).toMatchObject({ month: String(prevMonth), year: String(month === 1 ? year - 1 : year), staff_id: USERS.staff.userId });
    await expect(page.getByRole('button', { name: new RegExp(`^${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][prevMonth - 1]} \\d{4}, choose month and year`) })).toBeVisible();
  });
});

test.describe('payslip and bonus/advance sheets', () => {
  test('Payslip opens the assigned payslip with earnings, deductions and net pay in words', async ({ page, mock }, testInfo) => {
    await openCalendar(page, mock);
    await page.getByTestId('open-payslip').click();
    const sheet = page.getByTestId('payslip-sheet');
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('payslip-title')).toBeVisible();
    await expect(sheet).toContainText('Earnings');
    await expect(sheet).toContainText('Deductions');
    await expect(page.getByTestId('payslip-net')).toContainText('₹');
    await expect(page.getByTestId('payslip-words')).toContainText(/Rupees/i);
    await snap(page, testInfo, 'attendance-payslip-sheet');
  });

  test('a payslip failure is reported with a retry that recovers', async ({ page, mock, issues }) => {
    await openCalendar(page, mock);
    issues.allow(/salary\/preview/);
    await mock.failNext('/api/salary/preview*', { status: 500 });
    await page.getByTestId('open-payslip').click();
    await expect(page.getByText('Could not load your payslip.')).toBeVisible();
    await page.getByTestId('payslip-sheet').getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByTestId('payslip-net')).toBeVisible();
  });

  test('Advance Salary lists the employee\'s advances with date and who added it', async ({ page, mock }, testInfo) => {
    await openCalendar(page, mock);
    await page.getByTestId('open-bonus').click();
    const sheet = page.getByTestId('bonus-sheet');
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('advance-row')).toHaveCount(1); // adv-3 (stf-0001)
    await expect(page.getByTestId('advance-row')).toContainText('1,000');
    await expect(page.getByTestId('advance-row')).toContainText('Added by: Anita Desai');
    await snap(page, testInfo, 'attendance-advance-sheet');
  });

  test('a staff member with no advances sees the empty state', async ({ page, mock }) => {
    await loginAs(page, 'fieldStaff');
    await visit(page, '/staff/attendance');
    await page.getByTestId('open-bonus').click();
    await expect(page.getByText('No bonus or advance records yet.')).toBeVisible();
    void mock;
  });
});

function isHalf(r: Row): boolean {
  return (r.total_hours ?? 99) < 4.5;
}
