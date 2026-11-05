/**
 * Q3 - Account switching (no data of the previous user leaks), manager punch, calendar derivations
 * (client half-day, approved-leave overlay), night shift, location-tracking stop on 403.
 */
import type { Page } from '@playwright/test';

import { expect, loginAs, loginViaUi, logoutViaUi, readSession, test, USERS } from '../support';
import type { MockClient } from '../support/mock';
import { capturePunch, istToday, pinMidMonthIfNeeded } from '../support/q3';

const apiBase = `http://127.0.0.1:${process.env.MOCK_PORT ?? 8787}`;
const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dow = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay();

async function mockPost(page: Page, mock: MockClient, path: string, data: unknown) {
  const res = await page.request.post(`${apiBase}${path}`, { headers: { 'x-e2e-tenant': mock.tenant }, data });
  expect(res.ok(), `${path} ${res.status()}`).toBe(true);
  return res.json();
}

test.describe('switching accounts in the same browser', () => {
  test('staff signs out, manager signs in: nothing of the staff member is shown (home, badges, caches)', async ({ page }) => {
    await loginViaUi(page, 'staff');
    await expect(page.getByTestId('home-username')).toHaveText('Aarav Sharma');
    await expect(page.getByTestId('quick-requests-badge')).toHaveText('1');
    await page.goto('/staff/crm');
    await expect(page.getByTestId('crm-emp-lead-lead-004')).toBeVisible();
    await logoutViaUi(page, 'staff');
    await page.waitForURL((u) => u.pathname === '/');
    expect(await readSession(page)).toBeNull();

    await loginViaUi(page, 'manager');
    await expect(page.getByTestId('home-username')).toHaveText('Meera Iyer');
    // manager has no pending requests of their own
    await expect(page.getByTestId('quick-requests-badge')).toHaveCount(0);
    await page.goto('/staff/crm');
    await expect(page.getByTestId('crm-emp-lead-lead-007')).toBeVisible();
    await expect(page.getByTestId('crm-emp-lead-lead-004')).toHaveCount(0);
    // the CRM badge comes from the manager's own leads, not the previous user's seen ids
    await visitHome(page);
    await expect(page.getByRole('tab', { name: /^CRM/ }).or(page.getByRole('link', { name: /^CRM/ })).first()).toBeVisible();
  });

  test('sign-out clears the persisted per-user data and stops the field-staff location watcher', async ({ page, mock }) => {
    await loginViaUi(page, 'fieldStaff');
    await mock.waitForRequest('/staff-location/log', { method: 'POST', timeout: 20_000 });
    await logoutViaUi(page, 'fieldStaff');
    await page.waitForURL((u) => u.pathname === '/');
    const before = (await mock.requests({ path: '/staff-location/log' })).length;
    await page.context().setGeolocation({ latitude: 12.98, longitude: 77.6 });
    await expect.poll(async () => (await mock.requests({ path: '/staff-location/log' })).length, { timeout: 4_000 }).toBe(before);
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.filter((k) => /auth$|seen/i.test(k) && k.includes('stf-0002'))).toEqual([]);
  });
});

async function visitHome(page: Page): Promise<void> {
  await page.goto('/staff/home');
  await expect(page.getByTestId('punch-button')).toBeVisible();
}

test.describe('manager (role 2) uses the same home and punch flow', () => {
  test('manager home shows the working state and can punch out inside the geofence', async ({ page, mock }) => {
    await loginAs(page, 'manager');
    await page.goto('/staff/home');
    await expect(page.getByTestId('home-username')).toHaveText('Meera Iyer');
    await expect(page.getByTestId('home-status-chip')).toContainText('WORKING');
    await page.getByTestId('punch-button').click();
    await capturePunch(page);
    await expect(page.getByTestId('face-result')).toContainText('Punched Out!');
    const punch = await mock.waitForRequest('/face/punch', { method: 'POST' });
    expect(punch.body).toMatchObject({ user_id: USERS.manager.userId, action: 'punch_out' });
    await page.getByTestId('face-done').click();
    await expect(page.getByTestId('home-status-chip')).toContainText('COMPLETE');
  });
});

test.describe('calendar derivations', () => {
  test.beforeEach(async ({ page, mock }) => {
    await pinMidMonthIfNeeded(page, mock); // month grids need earlier days of the month: see support/q3.ts
  });

  test('an approved leave date without an attendance row is coloured and opens as Leave', async ({ page, mock }) => {
    const today = (await mock.state()).today;
    let target = addDays(today, 1);
    while (dow(target) === 0 || target.slice(0, 7) !== today.slice(0, 7)) target = addDays(target, -1);
    if (target <= today) target = addDays(today, 1);
    const res = await mockPost(page, mock, '/requests/leave/submit', { user_id: USERS.staff.userId, org_id: 'org-0001', leave_dates: [target], reason: 'Medical' });
    await mockPost(page, mock, '/requests/update-status', { request_id: res.request_id, status: 'approved', action_by: USERS.admin.userId, leave_date: target });
    await loginAs(page, 'staff');
    await visit_(page, '/staff/attendance');
    if (target.slice(0, 7) !== today.slice(0, 7)) await page.getByRole('button', { name: 'Next month' }).click();
    const cell = page.getByTestId(`day-${target}`);
    await expect(cell).toBeVisible();
    expect(await cell.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    await cell.click();
    await expect(page.getByTestId('day-status')).toContainText('Leave');
  });

  test('worked time under half the shift is a "HALF" day (client rule) and the sheet says Half Day', async ({ page, mock }) => {
    const today = (await mock.state()).today;
    let day = addDays(today, -2);
    while (dow(day) === 0 || day.slice(0, 7) !== today.slice(0, 7)) day = addDays(day, -1);
    await page.request.put(`${apiBase}/home/update-attendance-punch`, {
      headers: { 'x-e2e-tenant': mock.tenant },
      data: { staff_id: USERS.staff.userId, org_id: 'org-0001', date: day, punch_in: '09:00', punch_out: '11:00' },
    });
    await loginAs(page, 'staff');
    await visit_(page, '/staff/attendance');
    await expect(page.getByTestId(`day-${day}`)).toContainText('HALF');
    await page.getByTestId(`day-${day}`).click();
    await expect(page.getByTestId('day-status')).toContainText('Half Day');
  });

  test('a night-shift employee sees the 9 h shift (21:00 - 06:00) and the remaining time after midnight', async ({ page, mock }) => {
    await mock.setState({ userPatch: { [USERS.staff.userId]: { shift_id: 3 } } });
    const today = (await mock.state()).today;
    await mock.setClock(istToday(today, '21:00'));
    const res = await page.request.post(`${apiBase}/face/punch`, {
      headers: { 'x-e2e-tenant': mock.tenant },
      multipart: { user_id: USERS.staff.userId, org_id: 'org-0001', action: 'punch_in', face: { name: 'f.png', mimeType: 'image/png', buffer: Buffer.from('x') } },
    });
    expect(res.ok()).toBe(true);
    await page.clock.setFixedTime(new Date(istToday(today, '23:30')));
    await loginAs(page, 'staff');
    await visit_(page, '/staff/home');
    await expect(page.getByTestId('shift-card')).toContainText('09:00 PM – 06:00 AM');
    await expect(page.getByTestId('remain-title')).toHaveText('REMAINING TIME');
    await expect(page.getByTestId('remain-clock')).toHaveText('06:30');
    await expect(page.getByTestId('work-hours-value')).toHaveText('2:30 hrs / 9:00 hrs');
  });
});

test.describe('location tracking safety', () => {
  test('a 403 from the location endpoint stops all tracking (no retry storm)', async ({ page, mock, issues }) => {
    issues.allow(/staff-location\/log/);
    await mock.setState({ locationLogStatus: 403 });
    await loginAs(page, 'fieldStaff');
    await visit_(page, '/staff/home');
    await mock.waitForRequest('/staff-location/log', { method: 'POST', timeout: 20_000 });
    const n = (await mock.requests({ path: '/staff-location/log' })).length;
    await page.context().setGeolocation({ latitude: 12.972, longitude: 77.595 });
    await expect.poll(async () => (await mock.requests({ path: '/staff-location/log' })).length, { timeout: 4_000 }).toBe(n);
  });
});

async function visit_(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByTestId('brand-splash')).toHaveCount(0);
  await expect(page.getByTestId('guard-loading')).toHaveCount(0);
}
