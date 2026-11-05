/**
 * Q3 - Staff requests: hub badges, leave (multi-date calendar rules), permission, shift change, device change
 * (in-app and pre-login).
 * The browser clock is pinned to a weekday 10:00 IST so "today / Sunday / past" rules are deterministic.
 */
import type { Page } from '@playwright/test';

import { expect, loginAs, seedStorage, STORAGE, test, USERS, visit } from '../support';
import type { MockClient } from '../support/mock';
import { snap } from '../support/q3';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dow = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay();
/** next date (>= from) with the given weekday (0 = Sunday) */
const nextDow = (from: string, want: number): string => {
  let d = from;
  while (dow(d) !== want) d = addDays(d, 1);
  return d;
};
const dayLabel = (iso: string): RegExp => {
  const [y, m, d] = iso.split('-').map(Number);
  return new RegExp(`^${d} ${MONTHS[m - 1]} ${y}(,|$)`);
};
const day = (page: Page, iso: string) => page.getByRole('button', { name: dayLabel(iso) });

/** Pin the browser to a Monday-Saturday 10:00 IST (mock today, or the next day when that is a Sunday). */
async function pinToday(page: Page, mock: MockClient): Promise<string> {
  let today = (await mock.state()).today;
  if (dow(today) === 0) today = addDays(today, 1);
  await page.clock.install({ time: new Date(`${today}T10:00:00+05:30`) });
  return today;
}

const apiBase = `http://127.0.0.1:${process.env.MOCK_PORT ?? 8787}`;

async function submitLeaveAs(page: Page, mock: MockClient, userId: string, dates: string[], status?: 'rejected' | 'approved') {
  const res = await page.request.post(`${apiBase}/requests/leave/submit`, { headers: { 'x-e2e-tenant': mock.tenant }, data: { user_id: userId, org_id: 'org-0001', leave_dates: dates, reason: 'seed' } });
  expect(res.ok()).toBe(true);
  const { request_id: id } = await res.json();
  if (status) {
    for (const d of dates) {
      const r = await page.request.post(`${apiBase}/requests/update-status`, { headers: { 'x-e2e-tenant': mock.tenant }, data: { request_id: id, status, action_by: USERS.admin.userId, leave_date: d } });
      expect(r.ok()).toBe(true);
    }
  }
}

test.describe('requests hub', () => {
  test('four cards with the pending badge on Leave, and each card opens its screen', async ({ page, mock }, testInfo) => {
    await pinToday(page, mock);
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests');
    for (const k of ['leave', 'permission', 'shift_change', 'device_change']) await expect(page.getByTestId(`request-card-${k}`)).toBeVisible();
    await expect(page.getByTestId('request-card-leave-badge')).toHaveText('1'); // req-005
    await expect(page.getByTestId('request-card-permission-badge')).toHaveCount(0);
    await snap(page, testInfo, 'requests-hub');
    const routes: [string, string][] = [['leave', '/staff/requests/leave'], ['permission', '/staff/requests/permission'], ['shift_change', '/staff/requests/shift-change'], ['device_change', '/staff/requests/device-change']];
    for (const [key, path] of routes) {
      await visit(page, '/staff/requests');
      await page.getByTestId(`request-card-${key}`).click();
      await page.waitForURL(`**${path}`);
    }
  });

  test('the hub still opens when the pre-load fails (always-navigate fallback)', async ({ page, mock, issues }) => {
    issues.allow(/requests\/calendar/);
    await pinToday(page, mock);
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests');
    await mock.failNext('/requests/calendar/*', { status: 500, times: -1 });
    await page.getByTestId('request-card-leave').click();
    await page.waitForURL('**/staff/requests/leave');
    await expect(page.getByTestId('leave-request')).toBeVisible();
  });
});

test.describe('leave request', () => {
  test('calendar rules: today is selectable, Sundays / past days / already-requested dates are not', async ({ page, mock }, testInfo) => {
    const today = await pinToday(page, mock);
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests/leave');
    await expect(page.getByTestId('calendar-loading')).toHaveCount(0);
    await day(page, today).click();
    await expect(page.getByTestId(`chip-${today}`)).toBeVisible();
    await page.getByTestId(`chip-${today}`).click(); // chip removes it again
    await expect(page.getByTestId(`chip-${today}`)).toHaveCount(0);

    const sunday = nextDow(today, 0);
    if (sunday.slice(0, 7) === today.slice(0, 7)) {
      await expect(day(page, sunday)).toBeDisabled();
    }
    const yesterday = addDays(today, -1);
    if (yesterday.slice(0, 7) === today.slice(0, 7) && yesterday < today) await expect(day(page, yesterday)).toBeDisabled();

    // seeded pending leave (today + 10) is not pickable; its cell is labelled Pend
    const pending = addDays((await mock.state()).today, 10);
    if (pending.slice(0, 7) === today.slice(0, 7)) {
      await day(page, pending).click();
      await expect(page.getByTestId(`chip-${pending}`)).toHaveCount(0);
    }
    await snap(page, testInfo, 'leave-request');
  });

  test('a rejected date cannot be requested again', async ({ page, mock }) => {
    const today = await pinToday(page, mock);
    const target = nextDow(addDays(today, 2), 3); // a Wednesday
    await submitLeaveAs(page, mock, USERS.staff.userId, [target], 'rejected');
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests/leave');
    if (target.slice(0, 7) !== today.slice(0, 7)) await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.getByTestId('calendar-loading')).toHaveCount(0);
    await expect(day(page, target)).toContainText('Rej');
    await day(page, target).click();
    await expect(page.getByTestId(`chip-${target}`)).toHaveCount(0);
  });

  test('multi-date across months: sorted chips, each chip removes its own date, payload is sorted', async ({ page, mock }) => {
    const today = await pinToday(page, mock);
    const first = nextDow(addDays(today, 1), 2);
    const [y, m] = first.split('-').map(Number);
    const nextMonthFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const second = nextDow(nextMonthFirst, 4);
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests/leave');
    if (first.slice(0, 7) !== today.slice(0, 7)) await page.getByRole('button', { name: 'Next month' }).click();
    await day(page, first).click();
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.getByTestId('calendar-loading')).toHaveCount(0);
    await day(page, second).click();
    await expect(page.getByText('2 dates selected')).toBeVisible();
    await expect(page.locator('[data-testid^="chip-"]')).toHaveCount(2);
    // remove the date of the OTHER month while viewing this one
    await page.getByTestId(`chip-${first}`).click();
    await expect(page.getByTestId(`chip-${first}`)).toHaveCount(0);
    await expect(page.getByTestId(`chip-${second}`)).toBeVisible();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await day(page, first).click();
    await page.getByTestId('leave-reason').fill('Family wedding');
    await page.getByTestId('leave-submit').click();
    await expect(page.getByText('Leave request submitted successfully')).toBeVisible();
    const call = await mock.waitForRequest('/requests/leave/submit', { method: 'POST' });
    expect(call.body).toMatchObject({ user_id: USERS.staff.userId, leave_dates: [first, second], reason: 'Family wedding' });
    // success modal auto-dismisses and returns to the hub, where the pending badge grew
    await page.waitForURL('**/staff/requests', { timeout: 15_000 });
    await expect(page.getByTestId('request-card-leave-badge')).toHaveText('2');
    // the Home quick action counts the new request too
    await visit(page, '/staff/home');
    await expect(page.getByTestId('quick-requests-badge')).toHaveText('2');
  });

  test('calendar fetch covers the whole month including its last day (IST)', async ({ page, mock }) => {
    const today = await pinToday(page, mock);
    await loginAs(page, 'staff');
    await mock.clearRequests();
    await visit(page, '/staff/requests/leave');
    const [y, m] = today.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const calls = await mock.requests({ path: '/requests/calendar/' });
    const own = calls.find((c) => c.query.start_date === `${y}-${String(m).padStart(2, '0')}-01`);
    expect(own, JSON.stringify(calls.map((c) => c.query))).toBeTruthy();
    expect(own!.query.end_date).toBe(`${y}-${String(m).padStart(2, '0')}-${last}`);
  });

  test('validation: nothing selected, then missing reason', async ({ page, mock }) => {
    const today = await pinToday(page, mock);
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests/leave');
    await page.getByTestId('leave-submit').click();
    await expect(page.getByText('Select at least one date').first()).toBeVisible();
    await day(page, today).click();
    await page.getByTestId('leave-submit').click();
    await expect(page.getByText('Enter a reason for leave').first()).toBeVisible();
    expect(await mock.requests({ path: '/requests/leave/submit' })).toHaveLength(0);
  });

  test('a server rejection shows its message and keeps the form for another try', async ({ page, mock, issues }) => {
    issues.allow(/leave\/submit/);
    const today = await pinToday(page, mock);
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests/leave');
    await day(page, today).click();
    await page.getByTestId('leave-reason').fill('Fever');
    await mock.failNext('/requests/leave/submit', { status: 400, body: { detail: 'Leave quota exceeded' } });
    await page.getByTestId('leave-submit').click();
    await expect(page.getByText('Leave quota exceeded')).toBeVisible();
    await expect(page.getByTestId(`chip-${today}`)).toBeVisible();
    await expect(page.getByTestId('leave-reason')).toHaveValue('Fever');
    await expect(page.getByTestId('leave-submit')).toBeEnabled();
    await page.getByTestId('leave-submit').click();
    await expect(page.getByText('Leave request submitted successfully')).toBeVisible();
  });

  test('a calendar load failure is shown inline with Retry', async ({ page, mock, issues }) => {
    issues.allow(/requests\/calendar/);
    await pinToday(page, mock);
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests');
    await mock.failNext('/requests/calendar/*', { status: 500, times: 4 });
    await page.getByTestId('request-card-leave').click();
    await page.waitForURL('**/staff/requests/leave');
    await expect(page.getByText(/Could not load your existing requests/)).toBeVisible();
    await mock.clearFailures();
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText(/Could not load your existing requests/)).toHaveCount(0);
  });
});

test.describe('permission request', () => {
  test('pick a date, start/end slots (6 h max), submit as HH:mm', async ({ page, mock }, testInfo) => {
    const today = await pinToday(page, mock);
    const target = nextDow(addDays(today, 1), 3);
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests/permission');
    if (target.slice(0, 7) !== today.slice(0, 7)) await page.getByRole('button', { name: 'Next month' }).click();
    await day(page, target).click();
    await expect(page.getByTestId('permission-date-chip')).toBeVisible();
    await page.getByTestId('permission-end').click();
    await expect(page.getByText('Select start time first').first()).toBeVisible();
    await page.getByTestId('permission-start').click();
    await expect(page.getByTestId('time-slot-sheet')).toBeVisible();
    await snap(page, testInfo, 'permission-start-sheet');
    await page.getByTestId('slot-09:00').click();
    await page.getByTestId('permission-end').click();
    await expect(page.getByTestId('slot-15:00')).toBeVisible(); // 6 h after 09:00
    await expect(page.getByTestId('slot-15:30')).toHaveCount(0);
    await expect(page.getByTestId('slot-09:00')).toHaveCount(0);
    await page.getByTestId('slot-11:00').click();
    // changing the start clears the end
    await page.getByTestId('permission-start').click();
    await page.getByTestId('slot-10:00').click();
    await expect(page.getByTestId('permission-end')).toHaveAccessibleName('End Time: not set');
    await page.getByTestId('permission-end').click();
    await page.getByTestId('slot-12:30').click();
    await page.getByTestId('permission-reason').fill('Bank work');
    await page.getByTestId('permission-submit').click();
    await expect(page.getByText('Permission request submitted successfully')).toBeVisible();
    const call = await mock.waitForRequest('/requests/permission/submit', { method: 'POST' });
    expect(call.body).toMatchObject({ user_id: USERS.staff.userId, permission_date: target, start_time: '10:00', end_time: '12:30', reason: 'Bank work' });
  });

  test('today offers only start slots later than now (10:00 -> first slot 10:30 AM)', async ({ page, mock }) => {
    const today = await pinToday(page, mock);
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests/permission');
    await day(page, today).click();
    await page.getByTestId('permission-start').click();
    await expect(page.getByTestId('slot-10:30')).toBeVisible();
    await expect(page.getByTestId('slot-10:00')).toHaveCount(0);
    await expect(page.getByTestId('slot-00:00')).toHaveCount(0);
  });

  test('validation order: date, start, end, reason (nothing is sent until all are valid)', async ({ page, mock }) => {
    const today = await pinToday(page, mock);
    const target = nextDow(addDays(today, 1), 4);
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests/permission');
    await page.getByTestId('permission-submit').click();
    await expect(page.getByText('Select a date').first()).toBeVisible();
    if (target.slice(0, 7) !== today.slice(0, 7)) await page.getByRole('button', { name: 'Next month' }).click();
    await day(page, target).click();
    await page.getByTestId('permission-submit').click();
    await expect(page.getByText('Select start time').first()).toBeVisible();
    await page.getByTestId('permission-start').click();
    await page.getByTestId('slot-14:00').click();
    await page.getByTestId('permission-submit').click();
    await expect(page.getByText('Select end time').first()).toBeVisible();
    await page.getByTestId('permission-end').click();
    await page.getByTestId('slot-15:00').click();
    await page.getByTestId('permission-submit').click();
    await expect(page.getByText('Enter a reason').first()).toBeVisible();
    expect(await mock.requests({ path: '/requests/permission/submit' })).toHaveLength(0);
  });
});

test.describe('shift change request', () => {
  test('New Request -> pick shift and date -> submit -> My Requests shows it', async ({ page, mock }, testInfo) => {
    const today = await pinToday(page, mock);
    const date = addDays(today, 3);
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests/shift-change');
    await expect(page.getByTestId('shift-tabs')).toBeVisible();
    await snap(page, testInfo, 'shift-change-new');
    await page.getByTestId('shift-submit').click();
    await expect(page.getByText('Please enter a reason').first()).toBeVisible();
    await page.getByTestId('shift-reason').fill('Childcare pickup');
    await page.getByTestId('shift-submit').click();
    await expect(page.getByText('Please select a preferred shift').first()).toBeVisible();
    await page.getByTestId('shift-select').click();
    await page.getByText(/^Morning/).first().click();
    await page.getByTestId('shift-submit').click();
    await expect(page.getByText('Please select a requested shift date').first()).toBeVisible();
    await page.getByTestId('shift-date').fill(date);
    await page.getByTestId('shift-submit').click();
    await expect(page.getByText('Shift change request submitted successfully')).toBeVisible();
    const call = await mock.waitForRequest('/requests/shift-change/submit', { method: 'POST' });
    expect(call.body).toMatchObject({ user_id: USERS.staff.userId, requested_shift_id: 2, shift_change_date: date, reason: 'Childcare pickup' });
    // success switches to My Requests (1.5 s later)
    await expect(page.getByTestId(/shift-history-/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(/shift-history-/).first()).toContainText('Childcare pickup');
    await snap(page, testInfo, 'shift-change-history');
  });

  test('My Requests with no history shows the empty state; a failing history shows retry', async ({ page, mock, issues }) => {
    issues.allow(/requests\/employee/);
    await pinToday(page, mock);
    await loginAs(page, 'fieldStaff');
    await visit(page, '/staff/requests/shift-change');
    await page.getByRole('tab', { name: 'My Requests' }).or(page.getByText('My Requests', { exact: true })).first().click();
    await expect(page.getByText('No shift change requests yet')).toBeVisible();
    await mock.failNext('/requests/employee/*', { status: 500, times: 3 });
    await page.getByRole('tab', { name: 'New Request' }).or(page.getByText('New Request', { exact: true })).first().click();
    await page.reload();
    await page.getByText('My Requests', { exact: true }).first().click();
    await expect(page.getByText('Could not load your shift change requests.')).toBeVisible();
    await mock.clearFailures();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('No shift change requests yet')).toBeVisible();
  });
});

test.describe('device change request', () => {
  test('in-app: reason required, success returns to the hub (no login warning card)', async ({ page, mock }, testInfo) => {
    await pinToday(page, mock);
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests');
    await page.getByTestId('request-card-device_change').click();
    await page.waitForURL('**/staff/requests/device-change');
    await expect(page.getByTestId('device-warning')).toHaveCount(0);
    await page.getByTestId('device-submit').click();
    await expect(page.getByText('Please enter a reason').first()).toBeVisible();
    await page.getByTestId('device-reason').fill('Lost my phone');
    await snap(page, testInfo, 'device-change-in-app');
    await page.getByTestId('device-submit').click();
    await expect(page.getByText('Device change request submitted successfully')).toBeVisible();
    const call = await mock.waitForRequest('/requests/device-change/submit', { method: 'POST' });
    expect(call.body).toMatchObject({ user_id: USERS.staff.userId, reason: 'Lost my phone' });
    await page.waitForURL('**/staff/requests', { timeout: 15_000 });
  });

  test('pre-login: a mismatched device is sent to the request screen without a tab bar, success returns to staff login', async ({ page, mock }, testInfo) => {
    await seedStorage(page, { [`${STORAGE.deviceToken}:${USERS.staff.mobile}`]: 'stale-token' });
    await visit(page, '/staff-login');
    await page.getByTestId('mobile-input').fill(USERS.staff.mobile);
    await expect(page.getByTestId('mismatch-notice')).toBeVisible();
    await page.getByTestId('login-action').click(); // Request Access
    await page.waitForURL('**/device-change-request**');
    expect(new URL(page.url()).searchParams.get('userId')).toBe(USERS.staff.userId);
    await expect(page.getByTestId('device-warning')).toBeVisible();
    await expect(page.getByTestId('tab-bar')).toHaveCount(0);
    await expect(page.getByTestId('sidebar')).toHaveCount(0);
    await snap(page, testInfo, 'device-change-pre-login');
    await page.getByTestId('device-submit').click();
    await expect(page.getByText('Please enter a reason').first()).toBeVisible();
    await page.getByTestId('device-reason').fill('New phone');
    await page.getByTestId('device-submit').click();
    await expect(page.getByText('Device change request submitted successfully')).toBeVisible();
    expect((await mock.waitForRequest('/requests/device-change/submit', { method: 'POST' })).body).toMatchObject({ user_id: USERS.staff.userId, reason: 'New phone' });
    await page.waitForURL((u) => u.pathname === '/staff-login', { timeout: 15_000 });
  });

  test('pre-login without ids asks the user to log in again and posts nothing', async ({ page, mock }) => {
    await visit(page, '/device-change-request');
    await page.getByTestId('device-reason').fill('x');
    await page.getByTestId('device-submit').click();
    await expect(page.getByText('Please login again').first()).toBeVisible();
    expect(await mock.requests({ path: '/requests/device-change/submit' })).toHaveLength(0);
  });

  test('the back button works without history and lands on the staff login', async ({ page }) => {
    await visit(page, '/device-change-request?userId=stf-0001&orgId=org-0001');
    await page.getByRole('button', { name: 'Go back' }).click();
    await page.waitForURL((u) => u.pathname === '/staff-login');
  });
});
