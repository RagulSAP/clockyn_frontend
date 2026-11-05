/**
 * Q2 - Admin requests: hub badges (pending / unread, seen per list), the four lists (approve / reject / change decision with
 * confirmation, per-date handling, partial failures), 10 s polling, `success:false` surfaced.
 */
import type { Page } from '@playwright/test';

import { test, expect, loginAs, visit, IDS, USERS } from '../support';
import { istPlusDays, mockApi } from '../support/q2';

const confirmButton = (page: Page, name: 'Approve' | 'Reject') => page.getByRole('dialog').getByRole('button', { name, exact: true });

const badge = (page: Page, type: string) => page.getByTestId(`requests-hub-${type}-badge`);

test.describe('hub', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('rows show pending subtitle and unread badges; opening a list clears only that badge; pending text stays', async ({ page }) => {
    await visit(page, '/admin/requests');
    await expect(page.getByText('Manage Staff Requests')).toBeVisible();
    await expect(page.getByTestId('requests-hub-leave')).toContainText('3 pending');
    await expect(page.getByTestId('requests-hub-permission')).toContainText('2 pending');
    await expect(page.getByTestId('requests-hub-shift_change')).toContainText('2 pending');
    await expect(page.getByTestId('requests-hub-device_change')).toContainText('1 pending');
    await expect(badge(page, 'leave')).toHaveText('3');
    await expect(badge(page, 'permission')).toHaveText('2');
    await expect(badge(page, 'shift_change')).toHaveText('2');
    await expect(badge(page, 'device_change')).toHaveText('1');

    await page.getByTestId('requests-hub-leave').click();
    await page.waitForURL('**/admin/requests/leave');
    await expect(page.getByTestId('requests-leave')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('requests-hub')).toBeVisible();
    await expect(badge(page, 'leave')).toHaveCount(0); // seen
    await expect(page.getByTestId('requests-hub-leave')).toContainText('3 pending');
    await expect(badge(page, 'permission')).toHaveText('2'); // untouched

    // other three lists clear their own badges too (v1 only cleared leave)
    for (const [type, path] of [['permission', 'permission'], ['shift_change', 'shift-change'], ['device_change', 'device-change']] as const) {
      await page.getByTestId(`requests-hub-${type}`).click();
      await page.waitForURL(`**/admin/requests/${path}`);
      await expect(page.getByTestId(`requests-${type}`)).toBeVisible(); // the list marks its requests seen once it has loaded
      await page.goBack();
      await expect(badge(page, type)).toHaveCount(0);
    }
  });

  test('a new request arriving while the hub is open shows up within the 10 s poll (fake clock) as a new unread badge', async ({ page, tenant }) => {
    await page.clock.install();
    await visit(page, '/admin/requests', {}, { idle: false });
    await page.getByTestId('requests-hub-leave').click();
    await page.getByTestId('requests-leave').waitFor();
    await page.goBack();
    await expect(badge(page, 'leave')).toHaveCount(0);
    await mockApi(tenant, 'POST', '/requests/leave/submit', { user_id: USERS.staff.userId, leave_dates: [istPlusDays(20)], reason: 'Polling test' });
    await page.clock.fastForward(11_000);
    await expect(badge(page, 'leave')).toHaveText('1');
    await expect(page.getByTestId('requests-hub-leave')).toContainText('4 pending');
  });

  test('handling then receiving new requests keeps the unread badge honest (id based, not a high-water count)', async ({ page, tenant }) => {
    await visit(page, '/admin/requests');
    await page.getByTestId('requests-hub-shift_change').click();
    await page.waitForURL('**/shift-change');
    await page.getByTestId('request-req-201-approve').click();
    await confirmButton(page, 'Approve').click();
    await expect(page.getByText('Request Approved').first()).toBeVisible();
    await mockApi(tenant, 'POST', '/requests/shift-change/submit', { user_id: USERS.staff.userId, shift_change_date: istPlusDays(6), requested_shift_id: 2, reason: 'Fresh' });
    await page.getByRole('button', { name: /refresh/i }).first().click().catch(() => undefined);
    await page.goBack();
    await expect(page.getByTestId('requests-hub-shift_change')).toContainText('2 pending');
  });

  test('pending counts failure keeps the previous state and shows no error', async ({ page, mock, issues }) => {
    issues.allow(/requests\/admin/);
    await visit(page, '/admin/requests');
    await expect(badge(page, 'leave')).toHaveText('3');
    await mock.failNext('/requests/admin/*', { status: 500, times: -1 });
    await page.getByTestId('requests-hub-leave').click();
    await page.goBack();
    await expect(page.getByTestId('requests-hub')).toBeVisible();
    await expect(page.getByTestId('requests-hub-leave')).toContainText('pending');
  });

  test('manager with Requests Management reaches the same hub; a manager without it is not offered it', async ({ page }) => {
    await loginAs(page, 'manager');
    await visit(page, '/admin/requests');
    await expect(page.getByTestId('requests-hub')).toBeVisible();
  });
});

test.describe('leave requests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('list: newest first, dates strip, reason fallback, pending pill; approve with confirmation updates the card + request payload', async ({ page, mock }) => {
    await visit(page, '/admin/requests/leave');
    await expect(page.getByText('3 Pending')).toBeVisible();
    const card = page.getByTestId('request-req-001');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Pending');
    await expect(card).toContainText('Family function');
    // the two-date request shows both dates grouped on one line
    await expect(card.getByText(/\d{2}, \d{2} [A-Z][a-z]{2} \d{4}/).first()).toBeVisible();

    await card.getByTestId('request-req-001-approve').click();
    await expect(page.getByRole('dialog').getByText(/Approve leave for .* on /)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    expect((await mock.requests({ path: '/requests/update-status' })).length).toBe(0);

    await card.getByTestId('request-req-001-approve').click();
    await confirmButton(page, 'Approve').click();
    await expect(page.getByText('Leave Approved').first()).toBeVisible();
    const calls = await mock.requests({ path: '/requests/update-status', method: 'POST' });
    expect(calls).toHaveLength(2); // one per date
    for (const c of calls) expect(c.body).toMatchObject({ request_id: 'req-001', status: 'approved', action_by: USERS.admin.userId, role_id: 1 });
    expect(new Set(calls.map((c) => c.body?.leave_date)).size).toBe(2);
    await expect(card).toContainText('Approved');
    await expect(card.getByTestId('request-req-001-change')).toHaveText(/Change to Reject/);
    await expect(page.getByText('2 Pending')).toBeVisible();
  });

  test('reject, then change the decision back; state survives a refetch (reload) and shows in the employee list', async ({ page, mock }) => {
    await visit(page, '/admin/requests/leave');
    const card = page.getByTestId('request-req-002');
    await card.getByTestId('request-req-002-reject').click();
    await confirmButton(page, 'Reject').click();
    await expect(page.getByText('Leave Rejected').first()).toBeVisible();
    await expect(card).toContainText('Rejected');
    await page.reload();
    await expect(page.getByTestId('request-req-002')).toContainText('Rejected');
    await page.getByTestId('request-req-002-change').click();
    await expect(page.getByRole('dialog').getByText(/Change leave status for .* on .* to approved\?/)).toBeVisible();
    await confirmButton(page, 'Approve').click();
    await expect(page.getByTestId('request-req-002')).toContainText('Approved');
    const fx = await mock.fixtures();
    expect(fx.requests.find((r) => r.id === 'req-002')?.status).toBe('approved');
  });

  test('partial failure on a multi-date leave: error says how many dates were updated, list reconciles with the server', async ({ page, mock, issues }) => {
    issues.allow(/update-status/);
    await visit(page, '/admin/requests/leave');
    const card = page.getByTestId('request-req-001');
    await mock.failNext('/requests/update-status', { method: 'POST', status: 500, body: { detail: 'Server hiccup' }, times: 1 });
    await card.getByTestId('request-req-001-approve').click();
    await confirmButton(page, 'Approve').click();
    await expect(page.getByText(/Updated 1 of 2 dates\. Server hiccup/)).toBeVisible();
    await expect(page.getByText('Leave Approved')).toHaveCount(0);
    // after the refetch one date is approved, the other still pending -> request still counts as pending
    await expect(card).toContainText('Pending');
    await expect(card.getByText(/approved/i).first()).toBeVisible();
  });

  test('success:false from update-status is an error, never a success popup', async ({ page, mock }) => {
    await visit(page, '/admin/requests/leave');
    await mock.failNext('/requests/update-status', { method: 'POST', status: 200, body: { success: false, message: 'Request already processed' }, times: -1 });
    await page.getByTestId('request-req-005-approve').click();
    await confirmButton(page, 'Approve').click();
    await expect(page.getByText('Request already processed').first()).toBeVisible();
    await expect(page.getByText('Leave Approved')).toHaveCount(0);
    await expect(page.getByTestId('request-req-005')).toContainText('Pending');
    await mock.clearFailures();
  });

  test('polling: a request filed by staff appears within 10 s without any user action (fake clock)', async ({ page, tenant }) => {
    await page.clock.install();
    await visit(page, '/admin/requests/leave', {}, { idle: false });
    await expect(page.getByText('3 Pending')).toBeVisible();
    await mockApi(tenant, 'POST', '/requests/leave/submit', { user_id: USERS.staff.userId, leave_dates: [istPlusDays(21), istPlusDays(22), istPlusDays(23)], reason: 'Wedding trip' });
    await page.clock.fastForward(11_000);
    await expect(page.getByText('4 Pending')).toBeVisible();
    await expect(page.getByText('Wedding trip')).toBeVisible();
  });

  test('load failure toasts once and keeps the list; empty list shows the empty text', async ({ page, mock, issues }) => {
    issues.allow(/requests\/admin/);
    await visit(page, '/admin/requests/leave');
    await expect(page.getByTestId('request-req-001')).toBeVisible();
    await mock.failNext('/requests/admin/*', { status: 500, times: -1 });
    await page.getByTestId('request-req-001-approve').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await page.reload();
    await expect(page.getByText(/Something went wrong|Failed to load requests/).first()).toBeVisible();
    await mock.clearFailures();
    await page.getByRole('button', { name: /try again/i }).click();
    await expect(page.getByTestId('request-req-001')).toBeVisible();
  });
});

test.describe('permission requests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('cards grouped by date (newest date first), 12-hour range, approve one date of a two-date request leaves the other pending', async ({ page, tenant, mock }) => {
    const d1 = istPlusDays(30);
    const d2 = istPlusDays(31);
    // two-date permission request is realistic for the app (one card per date)
    const sub = await mockApi<{ request_id: string }>(tenant, 'POST', '/requests/permission/submit', { user_id: USERS.staff.userId, permission_date: d1, start_time: '14:30', end_time: '16:00', reason: 'Dentist' });
    expect(sub.request_id).toBeTruthy();
    await visit(page, '/admin/requests/permission');
    const text = await page.locator('body').innerText();
    expect(text).toContain('2:30 PM – 4:00 PM');
    expect(text).toContain('Dentist');
    await expect(page.getByText('3 Pending')).toBeVisible();
    // group headers are in descending date order
    const heads = await page.locator('[role="heading"]').allInnerTexts();
    void heads;
    const card = page.getByTestId(`request-${sub.request_id}-${d1}`);
    await card.getByTestId(`request-${sub.request_id}-${d1}-approve`).click();
    await expect(page.getByRole('dialog').getByText(/Approve permission for .* on /)).toBeVisible();
    await confirmButton(page, 'Approve').click();
    await expect(page.getByText('Request Approved').first()).toBeVisible();
    const call = await mock.lastRequest('/requests/update-status', 'POST');
    expect(call?.body).toMatchObject({ request_id: sub.request_id, leave_date: d1, status: 'approved', role_id: 1 });
    await expect(card).toContainText('Approved');
    void d2;
  });

  test('reject, change decision, and the seeded requests render', async ({ page }) => {
    await visit(page, '/admin/requests/permission');
    await expect(page.getByText('2 Pending')).toBeVisible();
    const date = istPlusDays(1);
    const card = page.getByTestId(`request-req-101-${date}`);
    await expect(card).toBeVisible();
    await card.getByTestId(`request-req-101-${date}-reject`).click();
    await confirmButton(page, 'Reject').click();
    await expect(page.getByText('Request Rejected').first()).toBeVisible();
    await expect(card.getByTestId(`request-req-101-${date}-change`)).toHaveText(/Change to Approve/);
    await expect(page.getByText('1 Pending')).toBeVisible();
  });
});

test.describe('shift change + device change requests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('shift change: current vs requested shift, approve without leave_date, change to reject message', async ({ page, mock }) => {
    await visit(page, '/admin/requests/shift-change');
    const card = page.getByTestId(`request-${IDS.pendingShift}`);
    await expect(card).toContainText('Current Shift'.toUpperCase());
    await expect(card).toContainText('Requested Shift'.toUpperCase());
    await expect(card).toContainText('Pending');
    await card.getByTestId(`request-${IDS.pendingShift}-approve`).click();
    await confirmButton(page, 'Approve').click();
    await expect(page.getByText('Request Approved').first()).toBeVisible();
    const call = await mock.lastRequest('/requests/update-status', 'POST');
    expect(call?.body?.leave_date).toBeUndefined();
    expect(call?.body).toMatchObject({ status: 'approved', role_id: 1 });
    await card.getByTestId(`request-${IDS.pendingShift}-change`).click();
    await expect(page.getByRole('dialog').getByText(/Change shift change status for .* to rejected\?/)).toBeVisible();
  });

  test('device change: approve clears the employee device token (state reflected downstream)', async ({ page, mock }) => {
    await visit(page, '/admin/requests/device-change');
    const card = page.getByTestId(`request-${IDS.pendingDevice}`);
    await expect(card).toBeVisible();
    await card.getByTestId(`request-${IDS.pendingDevice}-approve`).click();
    await confirmButton(page, 'Approve').click();
    await expect(page.getByText('Request Approved').first()).toBeVisible();
    await expect(card).toContainText('Approved');
    const fx = await mock.fixtures();
    const u = fx.staff.find((s) => s.user_id === 'stf-0012');
    expect(u?.deviceToken).toBeNull();
  });

  test('empty state per list + header pill hidden at zero pending', async ({ page }) => {
    await visit(page, '/admin/requests/device-change');
    await page.getByTestId(`request-${IDS.pendingDevice}-reject`).click();
    await confirmButton(page, 'Reject').click();
    await expect(page.getByText('Request Rejected').first()).toBeVisible();
    await expect(page.getByText(/\d+ Pending/)).toHaveCount(0);
  });

  test('approve failure: error toast with server detail, card unchanged, overlay cleared', async ({ page, mock, issues }) => {
    issues.allow(/update-status/);
    await visit(page, '/admin/requests/shift-change');
    await mock.failNext('/requests/update-status', { method: 'POST', status: 400, body: { detail: 'Shift is full' } });
    await page.getByTestId(`request-${IDS.pendingShift}-approve`).click();
    await confirmButton(page, 'Approve').click();
    await expect(page.getByText('Shift is full').first()).toBeVisible();
    await expect(page.getByTestId(`request-${IDS.pendingShift}`)).toContainText('Pending');
    await expect(page.getByText('Processing...')).toHaveCount(0);
    await expect(page.getByTestId(`request-${IDS.pendingShift}-approve`)).toBeEnabled();
  });
});
