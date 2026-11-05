/**
 * Q2b - Announcements: admin compose to ALL staff / SELECTED staff (search, select-all merges over filtered rows) / one BRANCH /
 * one DEPARTMENT with request payloads asserted through /__test/requests, success dialog subtitle (computed before the reset),
 * history list + search + delete (confirmation, error handling); staff feeds (`/staff/chat/broadcast`, `/staff/chat/targeted`):
 * items, search, seen ids per user, unread badges + hub counts clear after opening, push increments then heals to exact counts.
 */
import type { Page } from '@playwright/test';

import { test, expect, loginAs, visit, USERS, expectToast } from '../support';
import { mockApi } from '../support/q2';

const ADMIN = USERS.admin.userId;
const cards = (page: Page) => page.locator('[data-testid^="announcement-ann-"]:not([data-testid$="-delete"])');
const card = (page: Page, id: string) => page.getByTestId(`announcement-${id}`);
const isPhoneProject = (name: string) => name === 'phone';

async function showHistory(page: Page, project: string): Promise<void> {
  if (isPhoneProject(project)) await page.getByTestId('announcement-tabs').getByText('History').click();
  await expect(page.getByTestId('announcement-search')).toBeVisible();
}
async function fillCompose(page: Page, title: string, message: string): Promise<void> {
  await page.getByTestId('announcement-title').fill(title);
  await page.getByTestId('announcement-message').fill(message);
}
const sendBtn = (page: Page) => page.getByTestId('announcement-send');
const posts = async (mock: { requests: (f: { path?: string; method?: string }) => Promise<{ body?: Record<string, unknown>; status: number }[]> }) =>
  (await mock.requests({ path: '/api/announcements', method: 'POST' })).filter((r) => r.body && 'target' in r.body);

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('admin: compose to all staff', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/chat/announcements');
  });

  test('Send is disabled until title and message are filled; counters follow the text and are capped (100 / 1000)', async ({ page }) => {
    await expect(sendBtn(page)).toBeDisabled();
    await page.getByTestId('announcement-title').fill('Only a title');
    await expect(sendBtn(page)).toBeDisabled();
    await page.getByTestId('announcement-message').fill('   ');
    await expect(sendBtn(page)).toBeDisabled(); // whitespace is not a message
    await page.getByTestId('announcement-message').fill('Body');
    await expect(sendBtn(page)).toBeEnabled();
    await expect(sendBtn(page)).toContainText('Send to All Staff');
    await expect(page.getByTestId('announcement-title-counter')).toHaveText('12/100');
    await page.getByTestId('announcement-title').fill('t'.repeat(130));
    await expect(page.getByTestId('announcement-title')).toHaveValue('t'.repeat(100));
    await expect(page.getByTestId('announcement-title-counter')).toHaveText('100/100');
    await page.getByTestId('announcement-message').fill('m'.repeat(1100));
    await expect(page.getByTestId('announcement-message-counter')).toHaveText('1000/1000');
    // the counter turns to the warning colour near the limit
    const colorOf = (id: string) => page.getByTestId(id).evaluate((el) => getComputedStyle(el).color);
    await page.getByTestId('announcement-title').fill('short');
    const calm = await colorOf('announcement-title-counter');
    await page.getByTestId('announcement-title').fill('t'.repeat(95));
    expect(await colorOf('announcement-title-counter')).not.toBe(calm);
  });

  test('send: payload (trimmed, target all, no selection fields), success dialog with the right subtitle, form reset, history refreshed', async ({ page, mock }, testInfo) => {
    await mock.waitForSocket(ADMIN).catch(() => undefined);
    await fillCompose(page, '  Diwali holiday  ', '  Office closed on Monday.  ');
    await sendBtn(page).click();
    const call = (await mock.waitForRequest('/api/announcements', { method: 'POST', predicate: (r) => r.body?.target === 'all' })).body;
    expect(call).toEqual({ org_id: 'org-0001', sent_by_id: ADMIN, title: 'Diwali holiday', message: 'Office closed on Monday.', target: 'all' });
    const dialog = page.getByTestId('announcement-success');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Announcement Sent!');
    await expect(page.getByTestId('announcement-success-subtitle')).toHaveText('All staff have been notified');
    // form reset
    await expect(page.getByTestId('announcement-title')).toHaveValue('');
    await expect(page.getByTestId('announcement-message')).toHaveValue('');
    await expect(sendBtn(page)).toBeDisabled();
    // auto closes (2.2 s) without a tap
    await expect(dialog).toBeHidden({ timeout: 8_000 });
    await showHistory(page, testInfo.project.name);
    await expect(cards(page)).toHaveCount(5);
    await expect(cards(page).first()).toContainText('Diwali holiday');
    await expect(cards(page).first()).toContainText('All Staff');
  });

  test('the success dialog dismisses on tap', async ({ page }) => {
    await fillCompose(page, 'Tap me', 'Dismiss test');
    await sendBtn(page).click();
    await expect(page.getByTestId('announcement-success')).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByTestId('announcement-success')).toBeHidden();
  });

  test('a failed send keeps the draft, shows the server error, and no success dialog; Send works again afterwards', async ({ page, mock, issues }) => {
    issues.allow(/api\/announcements/);
    await fillCompose(page, 'Will fail', 'Server says no');
    await mock.failNext('/api/announcements', { method: 'POST', status: 500, body: { detail: 'Announcement service unavailable' } });
    await sendBtn(page).click();
    await expectToast(page, /Announcement service unavailable|Failed to send announcement/);
    await expect(page.getByTestId('announcement-success')).toHaveCount(0);
    await expect(page.getByTestId('announcement-title')).toHaveValue('Will fail');
    await expect(sendBtn(page)).toBeEnabled();
    await sendBtn(page).click();
    await expect(page.getByTestId('announcement-success')).toBeVisible();
  });

  test('a success:false reply (HTTP 200) is surfaced as an error, never as a success dialog', async ({ page, mock }) => {
    await fillCompose(page, 'Quota', 'Business failure');
    await mock.failNext('/api/announcements', { method: 'POST', status: 200, body: { success: false, message: 'Daily announcement limit reached' } });
    await sendBtn(page).click();
    await expectToast(page, /Daily announcement limit reached/);
    await expect(page.getByTestId('announcement-success')).toHaveCount(0);
    await expect(page.getByTestId('announcement-title')).toHaveValue('Quota');
  });

  test('double tap on Send sends exactly one announcement', async ({ page, mock }) => {
    await fillCompose(page, 'Once only', 'No duplicates');
    await mock.setLatency(500);
    await sendBtn(page).dblclick();
    await expect(page.getByTestId('announcement-success')).toBeVisible();
    expect((await posts(mock)).filter((r) => r.body?.title === 'Once only')).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('admin: compose to selected staff', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/chat/announcements');
    await fillCompose(page, 'Sales huddle', 'Join at 4pm.');
    await page.getByTestId('announcement-target').getByText('Select Staff').click();
    await expect(page.getByTestId('staff-picker')).toBeVisible();
  });

  test('picker: search by name / department / branch, select-all merges over the filtered rows and toggles only visible ones, chips are removable', async ({ page }) => {
    const search = page.getByTestId('staff-picker-search');
    const row = (id: string) => page.getByTestId(`staff-row-${id}`);
    await expect(page.getByTestId('staff-select-all')).toContainText('25 staff');

    await search.fill('bhavna');
    await expect(row('stf-0002')).toBeVisible();
    await expect(row(USERS.staff.userId)).toHaveCount(0);
    await expect(page.getByTestId('staff-select-all')).toContainText('1 staff'); // label = filtered count
    await page.getByTestId('staff-select-all').click();
    await expect(page.getByText('1 selected')).toBeVisible();

    await search.fill('aarav');
    await row(USERS.staff.userId).click();
    await expect(page.getByText('2 selected')).toBeVisible(); // the pick made outside the previous filter is kept

    await search.fill('engineering'); // department match
    const engineers = await page.locator('[data-testid^="staff-row-"]').count();
    expect(engineers).toBeGreaterThan(1);
    await page.getByTestId('staff-select-all').click();
    await expect(page.getByText(`${2 + engineers} selected`)).toBeVisible(); // merged: Bhavna + Aarav + the engineers (none selected before)
    await page.getByTestId('staff-select-all').click(); // again: removes only the visible ones
    await expect(page.getByText('2 selected')).toBeVisible();

    await search.fill('warehouse'); // branch match
    await expect(page.locator('[data-testid^="staff-row-"]').first()).toBeVisible();
    await search.fill('zzzz');
    await expect(page.getByText('No staff found')).toBeVisible();
    await expect(page.getByTestId('staff-select-all')).toContainText('0 staff');
    await search.fill('');
    await page.getByTestId('staff-picker-chips').getByRole('button', { name: 'Remove Bhavna' }).click();
    await expect(page.getByText('1 selected')).toBeVisible();
    await expect(page.getByTestId('staff-picker-done')).toContainText('Done (1)');
  });

  test('send: chips + count shown on the form, button label counts recipients, payload carries exactly the picked ids, subtitle counts them', async ({ page, mock }) => {
    await page.getByTestId(`staff-row-${USERS.staff.userId}`).click();
    await page.getByTestId('staff-row-stf-0003').click();
    await page.getByTestId('staff-picker-done').click();
    await expect(page.getByTestId('announcement-selected-count')).toHaveText('2 members selected');
    await expect(sendBtn(page)).toContainText('Send to 2 Staff');
    await page.getByTestId('announcements-screen').getByRole('button', { name: 'Remove Chirag' }).click(); // chip removal on the form
    await expect(sendBtn(page)).toContainText('Send to 1 Staff');
    await page.getByTestId('announcement-edit-selection').click(); // edit re-opens the picker with the selection
    await page.getByTestId('staff-row-stf-0007').click();
    await page.getByTestId('staff-picker-done').click();
    await expect(sendBtn(page)).toContainText('Send to 2 Staff');
    await sendBtn(page).click();
    const call = (await mock.waitForRequest('/api/announcements', { method: 'POST', predicate: (r) => r.body?.target === 'selected' })).body;
    expect(call).toMatchObject({ org_id: 'org-0001', sent_by_id: ADMIN, title: 'Sales huddle', message: 'Join at 4pm.', target: 'selected' });
    expect([...(call?.selected_user_ids as string[])].sort()).toEqual([USERS.staff.userId, 'stf-0007'].sort());
    expect(call).not.toHaveProperty('branch_id');
    expect(call).not.toHaveProperty('dept_id');
    await expect(page.getByTestId('announcement-success-subtitle')).toHaveText('2 staff members notified');
    // reset: back to All Staff with no selection
    await expect(page.getByTestId('announcement-selected-count')).toHaveCount(0);
    await expect(page.getByTestId('announcement-title')).toHaveValue('');
  });

  test('singular subtitle for one recipient; Send needs at least one recipient', async ({ page }) => {
    await page.getByTestId('staff-picker-done').click(); // nothing picked
    await expect(sendBtn(page)).toBeDisabled();
    await expect(sendBtn(page)).toContainText('Send to 0 Staff');
    await page.getByTestId('announcement-target').getByText('All Staff').click();
    await page.getByTestId('announcement-target').getByText('Select Staff').click(); // switching back re-opens the picker
    await expect(page.getByTestId('staff-picker')).toBeVisible();
    await page.getByTestId(`staff-row-${USERS.staff.userId}`).click();
    await page.getByTestId('staff-picker-done').click();
    await sendBtn(page).click();
    await expect(page.getByTestId('announcement-success-subtitle')).toHaveText('1 staff member notified');
  });
});

test('a failing staff list shows an error with Retry inside the picker; Retry loads it', async ({ page, mock, issues }) => {
  issues.allow(/all-staff/);
  await loginAs(page, 'admin');
  await visit(page, '/admin/chat/announcements');
  await mock.failNext('/home/all-staff*', { status: 500, times: -1 });
  await page.getByTestId('announcement-target').getByText('Select Staff').click();
  await expect(page.getByTestId('staff-picker')).toBeVisible();
  await expect(page.getByRole('button', { name: /retry|try again/i }).first()).toBeVisible();
  await mock.clearFailures();
  await page.getByRole('button', { name: /retry|try again/i }).first().click();
  await expect(page.getByTestId(`staff-row-${USERS.staff.userId}`)).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('admin: history', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/chat/announcements');
    await showHistory(page, testInfo.project.name);
  });

  test('lists every announcement newest first with audience pill and sender; search narrows (title + message), empty result is explained', async ({ page }) => {
    await expect(cards(page)).toHaveCount(4);
    const order = await cards(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(order).toEqual(['announcement-ann-1', 'announcement-ann-2', 'announcement-ann-3', 'announcement-ann-4']);
    await expect(card(page, 'ann-1')).toContainText('All Staff');
    await expect(card(page, 'ann-2')).toContainText('2 Staff');
    await expect(card(page, 'ann-3')).toContainText('Head Office');
    await expect(card(page, 'ann-4')).toContainText('Engineering');
    await expect(card(page, 'ann-1')).toContainText('by Anita Desai');
    await page.getByTestId('announcement-search').fill('  PARKING ');
    await expect(cards(page)).toHaveCount(1);
    await expect(card(page, 'ann-3')).toBeVisible();
    await page.getByTestId('announcement-search').fill('4pm'); // message text
    await expect(card(page, 'ann-2')).toBeVisible();
    await expect(cards(page)).toHaveCount(1);
    await page.getByTestId('announcement-search').fill('zzzz');
    await expect(page.getByText('No results')).toBeVisible();
  });

  test('delete asks for confirmation (Cancel keeps it), Delete calls the API, toasts and refreshes the list', async ({ page, mock }) => {
    await page.getByRole('button', { name: 'Delete announcement Sales review' }).click();
    await expect(page.getByRole('dialog').getByText('Delete Announcement?')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    expect(await mock.requests({ path: '/api/announcements/ann-2', method: 'DELETE' })).toHaveLength(0);
    await expect(card(page, 'ann-2')).toBeVisible();
    await page.getByRole('button', { name: 'Delete announcement Sales review' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await mock.waitForRequest('/api/announcements/ann-2', { method: 'DELETE' });
    await expectToast(page, 'Announcement deleted');
    await expect(card(page, 'ann-2')).toHaveCount(0);
    await expect(cards(page)).toHaveCount(3);
    // the staff member no longer sees it
    const feed = await mockApi<{ data: { id: string }[] }>(mock.tenant, 'GET', `/api/announcements/employee/${USERS.staff.userId}`);
    expect(feed.data.map((a) => a.id)).not.toContain('ann-2');
  });

  test('a failing delete (HTTP 500 and success:false) shows an error toast and keeps the announcement', async ({ page, mock, issues }) => {
    issues.allow(/api\/announcements/);
    const del = async () => {
      await page.getByRole('button', { name: 'Delete announcement Head Office parking' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    };
    await mock.failNext('/api/announcements/ann-3', { method: 'DELETE', status: 500, body: { detail: 'Delete is temporarily disabled' } });
    await del();
    await expectToast(page, /Delete is temporarily disabled|Failed to delete/);
    await expect(card(page, 'ann-3')).toBeVisible();
    await mock.failNext('/api/announcements/ann-3', { method: 'DELETE', status: 200, body: { success: false, message: 'Announcement is locked' } });
    await del();
    await expectToast(page, /Announcement is locked/);
    await expect(card(page, 'ann-3')).toBeVisible();
    await del(); // third time works
    await expect(card(page, 'ann-3')).toHaveCount(0);
  });
});

test('admin history load failure shows an error with Retry; Retry recovers', async ({ page, mock, issues }, testInfo) => {
  issues.allow(/api\/announcements/);
  await loginAs(page, 'admin');
  await mock.failNext('/api/announcements/org-0001', { status: 500, times: -1 });
  await visit(page, '/admin/chat/announcements');
  if (isPhoneProject(testInfo.project.name)) await page.getByTestId('announcement-tabs').getByText('History').click();
  await expect(page.getByRole('button', { name: /retry|try again/i }).first()).toBeVisible();
  await mock.clearFailures();
  await page.getByRole('button', { name: /retry|try again/i }).first().click();
  await expect(cards(page)).toHaveCount(4);
});

test('admin history empty state offers Compose', async ({ page, mock }, testInfo) => {
  for (const id of ['ann-1', 'ann-2', 'ann-3', 'ann-4']) await mockApi(mock.tenant, 'DELETE', `/api/announcements/${id}`);
  await loginAs(page, 'admin');
  await visit(page, '/admin/chat/announcements');
  await showHistory(page, testInfo.project.name);
  await expect(page.getByText('No announcements yet')).toBeVisible();
  await expect(page.getByRole('button', { name: /Compose/ }).first()).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('admin: branch and department', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/chat/announcements-targeted');
    await expect(page.getByTestId('target-option-101')).toBeVisible();
  });

  test('branch: pick (tap again deselects), label + "Sending to", payload with numeric branch_id, success subtitle names the branch', async ({ page, mock }, testInfo) => {
    await fillCompose(page, 'Parking update', 'Use Basement 3 from Monday.');
    await expect(sendBtn(page)).toBeDisabled(); // no branch yet
    await page.getByTestId('target-option-101').click();
    await expect(page.getByTestId('announcement-sending-to')).toContainText('Head Office');
    await expect(sendBtn(page)).toContainText('Send to Head Office');
    await expect(sendBtn(page)).toBeEnabled();
    await page.getByTestId('target-option-101').click(); // deselect
    await expect(page.getByTestId('announcement-sending-to')).toHaveCount(0);
    await expect(sendBtn(page)).toBeDisabled();
    await page.getByTestId('target-option-102').click();
    await expect(sendBtn(page)).toContainText('Send to Warehouse');
    await sendBtn(page).click();
    const call = (await mock.waitForRequest('/api/announcements', { method: 'POST', predicate: (r) => r.body?.target === 'branch' })).body;
    expect(call).toEqual({ org_id: 'org-0001', sent_by_id: ADMIN, title: 'Parking update', message: 'Use Basement 3 from Monday.', target: 'branch', branch_id: 102 });
    await expect(page.getByTestId('announcement-success-subtitle')).toHaveText('Warehouse staff notified'); // not the generic fallback
    await expect(page.getByTestId('announcement-title')).toHaveValue('');
    await expect(page.getByTestId('announcement-sending-to')).toHaveCount(0);
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await showHistory(page, testInfo.project.name);
    await expect(cards(page).first()).toContainText('Parking update');
    await expect(cards(page).first()).toContainText('Warehouse'); // pill shows the branch, not "All Staff"
  });

  test('department: switching type clears the branch choice; payload carries dept_id; subtitle names the department', async ({ page, mock }) => {
    await fillCompose(page, 'Stand-up', 'Moved to 10:30.');
    await page.getByTestId('target-option-101').click();
    await page.getByTestId('announcement-target').getByText('Department').click();
    await expect(page.getByTestId('announcement-sending-to')).toHaveCount(0); // branch choice dropped
    await expect(sendBtn(page)).toBeDisabled();
    await expect(page.getByTestId('announcement-title')).toHaveValue('Stand-up'); // draft kept
    await page.getByTestId('target-option-dept-103').click();
    await expect(sendBtn(page)).toContainText('Send to Engineering');
    await sendBtn(page).click();
    const call = (await mock.waitForRequest('/api/announcements', { method: 'POST', predicate: (r) => r.body?.target === 'dept' })).body;
    expect(call).toEqual({ org_id: 'org-0001', sent_by_id: ADMIN, title: 'Stand-up', message: 'Moved to 10:30.', target: 'dept', dept_id: 'dept-103' });
    expect(call).not.toHaveProperty('branch_id');
    await expect(page.getByTestId('announcement-success-subtitle')).toHaveText('Engineering staff notified');
  });

  test('history shows only branch / department announcements; search matches branch and department names; delete works here too', async ({ page, mock }, testInfo) => {
    await showHistory(page, testInfo.project.name);
    await expect(cards(page)).toHaveCount(2);
    await expect(card(page, 'ann-3')).toContainText('Head Office');
    await expect(card(page, 'ann-4')).toContainText('Engineering');
    await expect(card(page, 'ann-1')).toHaveCount(0);
    await expect(card(page, 'ann-2')).toHaveCount(0);
    await page.getByTestId('announcement-search').fill('engineering');
    await expect(cards(page)).toHaveCount(1);
    await page.getByTestId('announcement-search').fill('head office');
    await expect(card(page, 'ann-3')).toBeVisible();
    await page.getByTestId('announcement-search').fill('');
    await page.getByRole('button', { name: 'Delete announcement Engineering stand-up' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await mock.waitForRequest('/api/announcements/ann-4', { method: 'DELETE' });
    await expect(cards(page)).toHaveCount(1);
  });

  test('a failing branch list shows an error with Retry', async ({ page, mock, issues }) => {
    issues.allow(/branches/);
    await mock.failNext('/home/branches*', { status: 500, times: -1 });
    await visit(page, '/admin/chat/announcements-targeted');
    await expect(page.getByRole('button', { name: /retry|try again/i }).first()).toBeVisible();
    await mock.clearFailures();
    await page.getByRole('button', { name: /retry|try again/i }).first().click();
    await expect(page.getByTestId('target-option-101')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Staff feeds
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const feedFor = async (tenant: string, uid: string) => (await mockApi<{ data: { id: string; target: string }[] }>(tenant, 'GET', `/api/announcements/employee/${uid}`)).data;
const staffKeys = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter((k) => /announcement/i.test(k)));

test.describe('staff feeds', () => {
  test('hub counts equal the unread items per feed; opening a feed clears ITS count (hub card and Chat tab), persisted across reload', async ({ page, mock }, testInfo) => {
    const feed = await feedFor(mock.tenant, USERS.staff.userId);
    const broadcast = feed.filter((a) => a.target === 'all' || a.target === 'selected');
    const targeted = feed.filter((a) => a.target === 'branch' || a.target === 'dept');
    expect(broadcast).toHaveLength(2);
    expect(targeted).toHaveLength(1);
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-broadcast')).toHaveText('2');
    await expect(page.getByTestId('hub-badge-targeted')).toHaveText('1');
    await page.getByTestId('hub-card-broadcast').click();
    await page.waitForURL('**/staff/chat/broadcast');
    for (const a of broadcast) await expect(card(page, a.id)).toBeVisible();
    for (const a of targeted) await expect(card(page, a.id)).toHaveCount(0);
    await expect(card(page, 'ann-1')).toContainText('All Staff');
    await expect(card(page, 'ann-2')).toContainText('Selected Staff');
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-broadcast')).toHaveCount(0);
    await expect(page.getByTestId('hub-badge-targeted')).toHaveText('1'); // the other feed is untouched
    await page.reload();
    await expect(page.getByTestId('hub-card-broadcast')).toBeVisible();
    await expect(page.getByTestId('hub-badge-broadcast')).toHaveCount(0);
    await expect(page.getByTestId('hub-badge-targeted')).toHaveText('1');
    await page.getByTestId('hub-card-targeted').click();
    await page.waitForURL('**/staff/chat/targeted');
    await expect(card(page, 'ann-3')).toBeVisible();
    await expect(card(page, 'ann-3')).toContainText('Head Office');
    await expect(card(page, 'ann-4')).toHaveCount(0);
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-targeted')).toHaveCount(0);
    if (isPhoneProject(testInfo.project.name)) await expect(page.getByRole('tab', { name: /^Chat, \d+ unread/ }).or(page.getByRole('link', { name: /^Chat, \d+ unread/ })).first()).toBeVisible(); // still chat + group unread
  });

  test('search filters the broadcast feed (title / message), trimmed + case-insensitive; the targeted feed also matches branch / department names', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat/broadcast');
    await page.getByTestId('announcement-search').fill('  FOUNDERS ');
    await expect(card(page, 'ann-1')).toBeVisible();
    await expect(card(page, 'ann-2')).toHaveCount(0);
    await page.getByTestId('announcement-search').fill('zzzz');
    await expect(page.getByText('No results')).toBeVisible();
    await visit(page, '/staff/chat/targeted');
    await page.getByTestId('announcement-search').fill('head office');
    await expect(card(page, 'ann-3')).toBeVisible();
    await page.getByTestId('announcement-search').fill('engineering');
    await expect(page.getByText('No results')).toBeVisible(); // Aarav is not in Engineering: ann-4 is not his
  });

  test('seen ids are stored per user: the manager still has unread items after the staff member read the feeds', async ({ page, mock, context }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat/broadcast');
    await expect(card(page, 'ann-1')).toBeVisible();
    const mgrFeed = (await feedFor(mock.tenant, USERS.manager.userId)).filter((a) => a.target === 'all' || a.target === 'selected');
    const other = await context.newPage(); // same browser profile (same localStorage), another account
    await loginAs(other, 'manager');
    await visit(other, '/staff/chat');
    await expect(other.getByTestId('hub-badge-broadcast')).toHaveText(String(mgrFeed.length));
    await visit(other, '/staff/chat/broadcast');
    await expect(other.getByTestId('broadcast-feed')).toBeVisible();
    const keys = await staffKeys(other);
    expect(keys.filter((k) => k.includes(USERS.staff.userId)).length).toBeGreaterThan(0);
    expect(keys.filter((k) => k.includes(USERS.manager.userId)).length).toBeGreaterThan(0);
    await other.close();
  });

  test('a new announcement pushed live raises the badge, shows in the open feed, and a duplicate push (socket + FCM) never double counts', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-broadcast')).toHaveText('2');
    await mock.waitForSocket(USERS.staff.userId);
    const created = await mockApi<{ announcement_id: string }>(mock.tenant, 'POST', '/api/announcements', {
      org_id: 'org-0001', sent_by_id: ADMIN, title: 'Fire drill at noon', message: 'Please gather at the assembly point.', target: 'all',
    });
    // the mock pushed one event; replay it a second time like a foreground push arriving next to the socket frame
    await mock.push(USERS.staff.userId, { type: 'announcement', target: 'all', data: { announcement_id: created.announcement_id, title: 'Fire drill at noon', target: 'all' } });
    await expect(page.getByTestId('hub-badge-broadcast')).toHaveText('3'); // healed to the exact server count (2 + 1), not 4
    await expect(page.getByTestId('hub-badge-targeted')).toHaveText('1');
    await page.getByTestId('hub-card-broadcast').click();
    await expect(card(page, created.announcement_id)).toBeVisible();
    await expect(card(page, created.announcement_id)).toContainText('Fire drill at noon');
    // one more arrives while the feed is open: it is shown and counted as seen at once
    const second = await mockApi<{ announcement_id: string }>(mock.tenant, 'POST', '/api/announcements', {
      org_id: 'org-0001', sent_by_id: ADMIN, title: 'Second notice', message: 'While you are reading.', target: 'all',
    });
    await expect(card(page, second.announcement_id)).toBeVisible();
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-broadcast')).toHaveCount(0);
  });

  test('an announcement deleted by the admin disappears from the feed on refresh', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat/broadcast');
    await expect(card(page, 'ann-1')).toBeVisible();
    await mockApi(mock.tenant, 'DELETE', '/api/announcements/ann-1');
    await visit(page, '/staff/chat/broadcast');
    await expect(card(page, 'ann-1')).toHaveCount(0);
    await expect(card(page, 'ann-2')).toBeVisible();
  });

  test('a failing feed shows an error with Retry and a failed load never resets the badge; Retry recovers', async ({ page, mock, issues }) => {
    issues.allow(/announcements\/employee/);
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-broadcast')).toHaveText('2');
    await mock.failNext('/api/announcements/employee/*', { status: 500, times: -1 });
    await visit(page, '/staff/chat/broadcast');
    await expect(page.getByRole('button', { name: /retry|try again/i }).first()).toBeVisible();
    await mock.clearFailures();
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-broadcast')).toHaveText('2'); // nothing was marked read by the failed load
    await page.getByTestId('hub-card-broadcast').click();
    await expect(card(page, 'ann-1')).toBeVisible();
  });
});
