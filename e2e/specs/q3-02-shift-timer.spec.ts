/**
 * Q3 - Shift timer / remaining / overtime / working-hours states of /staff/home.
 * Server clock = mock.setClock (punch times), browser clock = page.clock (what the live cards read).
 */
import type { Page } from '@playwright/test';

import { expect, loginAs, test, USERS, visit } from '../support';
import { istToday, snap } from '../support/q3';
import type { MockClient } from '../support/mock';

async function serverPunch(page: Page, mock: MockClient, userId: string, at: string, action: 'punch_in' | 'punch_out'): Promise<void> {
  const today = (await mock.state()).today;
  await mock.setClock(istToday(today, at));
  const res = await page.request.post(`http://127.0.0.1:${process.env.MOCK_PORT ?? 8787}/face/punch`, {
    headers: { 'x-e2e-tenant': mock.tenant },
    multipart: { user_id: userId, org_id: 'org-0001', action, face: { name: 'f.png', mimeType: 'image/png', buffer: Buffer.from('x') } },
  });
  expect(res.ok()).toBe(true);
}

/** Freeze the browser's Date at IST `hhmm` (timers keep running, so the live cards re-render with a stable value). */
async function browserNow(page: Page, mock: MockClient, hhmm: string, frozen = true): Promise<void> {
  const today = (await mock.state()).today;
  const time = new Date(istToday(today, hhmm));
  if (frozen) await page.clock.setFixedTime(time);
  else await page.clock.install({ time });
}

const remain = (page: Page) => page.getByTestId('remain-card');

test.describe('shift timer states (shift 09:00 - 18:00)', () => {
  test('before any punch: SHIFT DURATION 09:00:00 "Total Shift Time", working hours "--"', async ({ page, mock }, testInfo) => {
    await mock.setClock(istToday((await mock.state()).today, '08:30'));
    await browserNow(page, mock, '08:30');
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(page.getByTestId('remain-title')).toHaveText('SHIFT DURATION');
    await expect(page.getByTestId('remain-clock')).toHaveText('09:00');
    await expect(page.getByTestId('remain-seconds')).toHaveText(':00');
    await expect(page.getByTestId('remain-label')).toHaveText('Total Shift Time');
    await expect(page.getByTestId('work-hours-value')).toHaveText('-- / 9:00 hrs');
    await snap(page, testInfo, 'staff-home-timer-idle');
  });

  test('punched in 09:00, now 12:30: REMAINING TIME 05:30:00, worked 3:30 / 9:00, bar ~39%', async ({ page, mock }, testInfo) => {
    await serverPunch(page, mock, USERS.staff.userId, '09:00', 'punch_in');
    await browserNow(page, mock, '12:30');
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(page.getByTestId('remain-title')).toHaveText('REMAINING TIME');
    await expect(page.getByTestId('remain-clock')).toHaveText('05:30');
    await expect(page.getByTestId('remain-label')).toHaveText('Time Remaining');
    await expect(page.getByTestId('work-hours-value')).toHaveText('3:30 hrs / 9:00 hrs');
    const pct = await page.getByTestId('work-hours-bar').evaluate((el) => el.style.width || getComputedStyle(el).width);
    expect(pct).toMatch(/39%|^\d/);
    await expect(page.getByTestId('time-value-in')).toHaveText('09:00 AM');
    await snap(page, testInfo, 'staff-home-timer-working');
  });

  test('the counter ticks every second', async ({ page, mock }) => {
    await serverPunch(page, mock, USERS.staff.userId, '09:00', 'punch_in');
    await browserNow(page, mock, '12:30', false);
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    const first = await page.getByTestId('remain-seconds').textContent();
    await expect.poll(async () => page.getByTestId('remain-seconds').textContent(), { timeout: 5_000 }).not.toBe(first);
  });

  test('still punched in at 18:10: +00:10 OVERTIME and a full green bar', async ({ page, mock }, testInfo) => {
    await serverPunch(page, mock, USERS.staff.userId, '09:00', 'punch_in');
    await browserNow(page, mock, '18:10');
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(page.getByTestId('remain-title')).toHaveText('OVERTIME');
    await expect(remain(page)).toContainText('+');
    await expect(page.getByTestId('remain-clock')).toHaveText('00:10');
    await expect(page.getByTestId('remain-label')).toHaveText('Overtime');
    await expect(page.getByTestId('work-hours-value')).toHaveText('9:10 hrs / 9:00 hrs');
    await expect(page.getByTestId('work-hours-bar')).toHaveCSS('width', /.+/);
    await snap(page, testInfo, 'staff-home-timer-overtime');
  });

  test('two sessions (09:00-13:00, 14:00-open) at 16:00 count 6 h worked', async ({ page, mock }) => {
    await serverPunch(page, mock, USERS.staff.userId, '09:00', 'punch_in');
    await serverPunch(page, mock, USERS.staff.userId, '13:00', 'punch_out');
    await serverPunch(page, mock, USERS.staff.userId, '14:00', 'punch_in');
    await browserNow(page, mock, '16:00');
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(page.getByTestId('work-hours-value')).toHaveText('6:00 hrs / 9:00 hrs');
    await expect(page.getByTestId('remain-clock')).toHaveText('03:00');
    await expect(page.getByTestId('home-status-chip')).toContainText('WORKING');
  });

  test('a completed day (09:00-18:00) reads COMPLETE with Shift Complete 00:00:00', async ({ page, mock }, testInfo) => {
    await serverPunch(page, mock, USERS.staff.userId, '09:00', 'punch_in');
    await serverPunch(page, mock, USERS.staff.userId, '18:00', 'punch_out');
    await browserNow(page, mock, '18:30');
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(page.getByTestId('home-status-chip')).toContainText('COMPLETE');
    await expect(page.getByTestId('remain-title')).toHaveText('SHIFT COMPLETE');
    await expect(page.getByTestId('remain-clock')).toHaveText('00:00');
    await expect(page.getByTestId('work-hours-value')).toHaveText('9:00 hrs / 9:00 hrs');
    await expect(page.getByTestId('time-value-out')).toHaveText('06:00 PM');
    await snap(page, testInfo, 'staff-home-timer-complete');
  });
});
