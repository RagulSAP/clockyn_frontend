/**
 * Q2b - Admin CRM hub (`/admin/crm`): menu cards, work-status overview (counts vs the mock's own lead data, status filter,
 * date chips in IST, custom date), lead details sheet, carry-forward inbox (approve with confirmation / reject, refresh, failures),
 * desktop two-column vs phone tabs, plan gate (a blocked organisation sees only the lock card and no lead / CFR request is made).
 */
import type { Page } from '@playwright/test';

import { test, expect, loginAs, visit, USERS, expectToast } from '../support';
import { mockApi } from '../support/q2';
import { calendarDayName, chipDate, effectiveDay, fmtDate, istDay, isPhone, tally, type WireLead } from '../support/q2b';

const ADMIN = USERS.admin.userId;
const stat = (page: Page, k: string) => page.getByTestId(`crm-stat-${k}`);
const row = (page: Page, id: string) => page.getByTestId(`crm-lead-row-${id}`);
const rows = (page: Page) => page.locator('[data-testid^="crm-lead-row-"]');
const leadsOf = async (tenant: string) => (await mockApi<{ data: WireLead[] }>(tenant, 'GET', '/api/leads/org-0001')).data;
const KEYS = ['total', 'unassigned', 'pending', 'working', 'completed', 'carry_forward'] as const;

/** The CFR inbox sits behind a tab on phones / tablets and next to the overview on desktop. */
async function openCfr(page: Page, phone: boolean): Promise<void> {
  if (phone) await page.getByRole('tab', { name: /Carry Forward Requests/ }).click();
  await expect(page.getByTestId('crm-cfr-section')).toBeVisible();
}

async function expectCounts(page: Page, expected: Record<(typeof KEYS)[number], number>): Promise<void> {
  for (const k of KEYS) await expect(stat(page, k)).toHaveAccessibleName(new RegExp(`, ${expected[k]}$`));
}

test.describe('hub overview', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/crm');
    await expect(page.getByTestId('crm-stats-grid')).toBeVisible();
  });

  test('menu cards (Enter Leads, View / Assign Leads with today count) navigate to their screens', async ({ page, mock }) => {
    const today = (await leadsOf(mock.tenant)).filter((l) => effectiveDay(l) === istDay(0));
    await expect(page.getByTestId('crm-menu-enter')).toContainText('Enter Leads');
    await expect(page.getByTestId('crm-menu-assign')).toContainText(`${today.length} leads today`);
    await page.getByTestId('crm-menu-assign').click();
    await page.waitForURL('**/admin/crm/leads');
    await expect(page.getByTestId('assign-leads')).toBeVisible();
    await visit(page, '/admin/crm');
    await page.getByTestId('crm-menu-enter').click();
    await page.waitForURL('**/admin/crm/leads/edit');
    await expect(page.getByTestId('crm-lead-save')).toBeVisible();
  });

  test('status counts equal the mock data; tapping a cell filters the lead-wise list to exactly those leads', async ({ page, mock }) => {
    const today = (await leadsOf(mock.tenant)).filter((l) => effectiveDay(l) === istDay(0));
    const expected = tally(today);
    await expectCounts(page, expected);
    await expect(rows(page)).toHaveCount(expected.total);
    expect(expected.unassigned).toBeGreaterThan(0);
    expect(expected.carry_forward).toBeGreaterThan(0);

    await stat(page, 'unassigned').click();
    await expect(rows(page)).toHaveCount(expected.unassigned);
    await expect(row(page, 'lead-001')).toBeVisible();
    await expect(row(page, 'lead-001')).toContainText('Unassigned');

    await stat(page, 'working').click();
    const working = today.filter((l) => l.assigned_user_id && l.work_status === 'working');
    await expect(rows(page)).toHaveCount(working.length);
    for (const l of working) await expect(row(page, l.leads_id)).toContainText(l.assigned_user_name!);

    await stat(page, 'carry_forward').click();
    await expect(rows(page)).toHaveCount(expected.carry_forward);
    await expect(row(page, 'lead-011')).toBeVisible();

    await stat(page, 'completed').click();
    await expect(rows(page)).toHaveCount(expected.completed);
    await stat(page, 'pending').click();
    await expect(rows(page)).toHaveCount(expected.pending);
    await stat(page, 'total').click();
    await expect(rows(page)).toHaveCount(expected.total);
  });

  test('day chips: Yesterday / Tomorrow / a picked date re-count the overview (IST days); the picked date shows as dd/MM and clears back to Today', async ({ page, mock }) => {
    const all = await leadsOf(mock.tenant);
    const yesterday = all.filter((l) => effectiveDay(l) === istDay(-1));
    expect(yesterday.length).toBeGreaterThan(0);
    await page.getByTestId('crm-overview').getByRole('radio', { name: 'Yesterday' }).click();
    await expectCounts(page, tally(yesterday));
    await expect(rows(page)).toHaveCount(yesterday.length);
    await expect(row(page, yesterday[0].leads_id)).toBeVisible();

    await page.getByTestId('crm-overview').getByRole('radio', { name: 'Tomorrow' }).click();
    await expectCounts(page, tally([]));
    await expect(page.getByText('No leads here')).toBeVisible();

    // a lead with a customer-required date on a day of the current month, found through the calendar
    // (the 1st, unless that is today or yesterday - the seeded leads live on those days - then the 3rd)
    const first = `${istDay(0).slice(0, 8)}01`;
    const pickDay = first === istDay(0) || first === istDay(-1) ? `${istDay(0).slice(0, 8)}03` : first;
    await mockApi(mock.tenant, 'POST', '/api/leads/create', { org_id: 'org-0001', name: 'Calendar Probe', mobile: '9811122233', address: 'Probe Road', category: 'General', remarks: '', required_date: pickDay });
    await page.getByRole('button', { name: 'Refresh' }).click();
    await page.getByTestId('crm-overview').getByRole('radio', { name: 'Pick Date' }).click();
    await page.getByRole('button', { name: new RegExp(`^${calendarDayName(pickDay)}`) }).click();
    await expect(page.getByTestId('crm-overview').getByRole('radio', { name: chipDate(pickDay) })).toBeChecked();
    await expectCounts(page, { ...tally([]), total: 1, unassigned: 1 });
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Calendar Probe');
    await expect(rows(page).first()).toContainText(fmtDate(pickDay));
    await page.getByRole('button', { name: 'Clear picked date' }).click();
    await expect(page.getByTestId('crm-overview').getByRole('radio', { name: 'Today' })).toBeChecked();
    await expect(rows(page).first()).toBeVisible();
  });

  test('"today" is the IST day: after 00:00 IST (still the previous UTC day) today\'s leads belong to Yesterday', async ({ page, mock }) => {
    const dayBefore = istDay(0); // the mock's seed day
    await page.clock.install({ time: new Date(`${dayBefore}T20:00:00Z`) }); // = 01:30 IST of the NEXT day, still `dayBefore` in UTC
    await visit(page, '/admin/crm');
    await expect(page.getByTestId('crm-stats-grid')).toBeVisible();
    const seeded = (await leadsOf(mock.tenant)).filter((l) => effectiveDay(l) === dayBefore);
    await expect(page.getByTestId('crm-menu-assign')).toContainText('0 leads today');
    await expectCounts(page, tally([]));
    await page.getByTestId('crm-overview').getByRole('radio', { name: 'Yesterday' }).click();
    await expectCounts(page, tally(seeded));
  });

  test('lead details sheet shows the lead; the Unassigned pill jumps into the assign view of that lead', async ({ page }) => {
    await row(page, 'lead-004').click();
    const sheet = page.getByTestId('crm-lead-detail');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Kiran Textiles');
    await expect(sheet).toContainText('9845010411');
    await expect(sheet).toContainText('13 Market Street, Bengaluru');
    await expect(sheet).toContainText('Corporate');
    await expect(sheet).toContainText('Aarav Sharma');
    await expect(sheet).toContainText(fmtDate(istDay(0)));
    await expect(sheet).toContainText('Call back next week');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await row(page, 'lead-001').click(); // unassigned
    await expect(page.getByTestId('crm-lead-detail')).toContainText('Unassigned');
    await page.keyboard.press('Escape');
    await page.getByTestId('crm-assign-pill-lead-001').click();
    await page.waitForURL(/\/admin\/crm\/leads\?leadId=lead-001/);
    await expect(page.getByTestId('crm-assign-branch')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Assign Lead' })).toBeVisible();
  });

  test('a failing lead load shows an error with Retry (no stuck skeleton); Retry recovers', async ({ page, mock, issues }) => {
    issues.allow(/api\/leads/);
    await mock.failNext('/api/leads/org-0001', { status: 500, times: -1 });
    await visit(page, '/admin/crm');
    await expect(page.getByRole('button', { name: /retry|try again/i }).first()).toBeVisible();
    await mock.clearFailures();
    await page.getByRole('button', { name: /retry|try again/i }).first().click();
    await expect(page.getByTestId('crm-stats-grid')).toBeVisible();
  });

  test('the refresh action reloads leads and carry-forward requests', async ({ page, mock }) => {
    await mock.clearRequests();
    await page.getByRole('button', { name: 'Refresh' }).click();
    await mock.waitForRequest('/api/leads/org-0001', { method: 'GET' });
    await mock.waitForRequest('/api/leads/carry-forward/requests/', { method: 'GET' });
  });

  test('a lead added elsewhere shows after refresh and moves the counts', async ({ page, mock }) => {
    const before = (await leadsOf(mock.tenant)).filter((l) => effectiveDay(l) === istDay(0));
    await mockApi(mock.tenant, 'POST', '/api/leads/create', { org_id: 'org-0001', name: 'Walk-in Client', mobile: '9822233344', address: 'Brigade Road', category: 'Retail', remarks: '', required_date: istDay(0) });
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expectCounts(page, { ...tally(before), total: before.length + 1, unassigned: tally(before).unassigned + 1 });
    await expect(row(page, 'lead-101')).toContainText('Walk-in Client');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('carry forward inbox', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/crm');
    await openCfr(page, isPhone(testInfo));
  });

  test('requests show employee, reason, requested-for and submitted dates; pending first with a pending counter; resolved ones show their status only', async ({ page }) => {
    await expect(page.getByTestId('crm-cfr-pending-count')).toHaveText('1 pending');
    const cfr1 = page.getByTestId('crm-cfr-cfr-1');
    await expect(cfr1).toContainText('Green Valley Farms');
    await expect(cfr1).toContainText('Chirag Patel');
    await expect(cfr1).toContainText('Client asked to meet next week');
    await expect(cfr1).toContainText(fmtDate(istDay(7)));
    await expect(cfr1).toContainText(fmtDate(istDay(0)));
    await expect(cfr1.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(cfr1.getByRole('button', { name: 'Reject' })).toBeVisible();
    const cfr2 = page.getByTestId('crm-cfr-cfr-2');
    await expect(cfr2).toContainText('Prime Hardware');
    await expect(cfr2.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(cfr2).toContainText('Approved');
    const order = await page.locator('[data-testid^="crm-cfr-cfr-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(order).toEqual(['crm-cfr-cfr-1', 'crm-cfr-cfr-2']);
  });

  test('approve asks for confirmation naming the requested-for date (Cancel sends nothing); confirming sends admin id + action, toasts, flips the card and refreshes the leads', async ({ page, mock }, testInfo) => {
    const cfr1 = page.getByTestId('crm-cfr-cfr-1');
    await cfr1.getByRole('button', { name: 'Approve' }).click();
    const dialog = page.getByRole('dialog').last();
    await expect(dialog.getByText('Approve Request?')).toBeVisible();
    await expect(dialog).toContainText(`Requested for: ${fmtDate(istDay(7))}`);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    expect(await mock.requests({ path: '/api/leads/carry-forward/cfr-1/action', method: 'PUT' })).toHaveLength(0);
    await expect(cfr1.getByRole('button', { name: 'Approve' })).toBeVisible();

    await cfr1.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('dialog').last().getByRole('button', { name: 'Yes, Approve' }).click();
    const call = await mock.waitForRequest('/api/leads/carry-forward/cfr-1/action', { method: 'PUT' });
    expect(call.query).toMatchObject({ action: 'approved', admin_id: ADMIN });
    await expectToast(page, 'CFR approved successfully');
    await expect(cfr1.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(cfr1).toContainText('Approved');
    await expect(page.getByTestId('crm-cfr-pending-count')).toHaveCount(0);
    // the leads were reloaded: the server moved lead-011 to the forward date, so today has one lead less
    await expect.poll(async () => (await mock.requests({ path: '/api/leads/org-0001', method: 'GET' })).length).toBeGreaterThan(1);
    const after = (await leadsOf(mock.tenant)).find((l) => l.leads_id === 'lead-011')!;
    expect(after.created_date).toBe(istDay(7));
    if (isPhone(testInfo)) await page.getByRole('tab', { name: /Work Status Overview/ }).click();
    await expect(stat(page, 'total')).toHaveAccessibleName(/, 9$/);
    await expect(row(page, 'lead-011')).toHaveCount(0);
  });

  test('reject sends the action at once (no confirmation) and marks the request Rejected', async ({ page, mock }) => {
    await page.getByTestId('crm-cfr-cfr-1').getByRole('button', { name: 'Reject' }).click();
    const call = await mock.waitForRequest('/api/leads/carry-forward/cfr-1/action', { method: 'PUT' });
    expect(call.query).toMatchObject({ action: 'rejected', admin_id: ADMIN });
    await expect(page.getByTestId('crm-cfr-cfr-1')).toContainText('Rejected');
    await expect(page.getByTestId('crm-cfr-pending-count')).toHaveCount(0);
    expect((await leadsOf(mock.tenant)).find((l) => l.leads_id === 'lead-011')!.created_date).toBe(istDay(0)); // untouched
  });

  test('a failing approve toasts the server error, keeps the request pending and re-enables the buttons', async ({ page, mock, issues }) => {
    issues.allow(/carry-forward/);
    await mock.failNext('/api/leads/carry-forward/cfr-1/action', { method: 'PUT', status: 500, body: { detail: 'CFR service unavailable' } });
    const cfr1 = page.getByTestId('crm-cfr-cfr-1');
    await cfr1.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('dialog').last().getByRole('button', { name: 'Yes, Approve' }).click();
    await expectToast(page, /CFR service unavailable|Failed to update request/);
    await expect(cfr1.getByRole('button', { name: 'Approve' })).toBeEnabled();
    await expect(cfr1.getByRole('button', { name: 'Reject' })).toBeEnabled();
    await expect(page.getByTestId('crm-cfr-pending-count')).toHaveText('1 pending');
  });

  test('submitted-day chips: Today lists both, Yesterday is empty, All restores', async ({ page }) => {
    const section = page.getByTestId('crm-cfr-section');
    await expect(section.getByRole('radio', { name: 'All' })).toBeChecked();
    await section.getByRole('radio', { name: 'Yesterday' }).click();
    await expect(page.getByText('No requests')).toBeVisible();
    await expect(page.locator('[data-testid^="crm-cfr-cfr-"]')).toHaveCount(0);
    await section.getByRole('radio', { name: 'Today' }).click();
    await expect(page.locator('[data-testid^="crm-cfr-cfr-"]')).toHaveCount(2);
    await section.getByRole('radio', { name: 'All' }).click();
    await expect(page.locator('[data-testid^="crm-cfr-cfr-"]')).toHaveCount(2);
  });
});

test.describe('layout', () => {
  test('desktop: overview and carry-forward inbox side by side, no tabs; phone: two tabs with the pending count on the second', async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/crm');
    await expect(page.getByTestId('crm-stats-grid')).toBeVisible();
    if (isPhone(testInfo)) {
      await expect(page.getByRole('tab', { name: /Work Status Overview/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Carry Forward Requests/ })).toContainText('1');
      await expect(page.getByTestId('crm-cfr-section')).toHaveCount(0);
      await page.getByRole('tab', { name: /Carry Forward Requests/ }).click();
      await expect(page.getByTestId('crm-cfr-section')).toBeVisible();
      await expect(page.getByTestId('crm-overview')).toHaveCount(0);
    } else {
      await expect(page.getByRole('tab')).toHaveCount(0);
      const a = (await page.getByTestId('crm-overview').boundingBox())!;
      const b = (await page.getByTestId('crm-cfr-section').boundingBox())!;
      expect(b.x).toBeGreaterThan(a.x + a.width - 2); // second column
      expect(Math.abs(a.y - b.y)).toBeLessThan(120); // same row
      expect(a.width).toBeGreaterThan(300);
      expect(b.width).toBeGreaterThan(300);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('plan gate', () => {
  test('a blocked organisation sees only the lock card (no menu cards, no stats) and no lead / carry-forward request is made', async ({ page, mock, issues }) => {
    issues.allow(/.*/);
    await mock.setPlan('expired');
    await loginAs(page, 'admin');
    await visit(page, '/admin/crm');
    await expect(page.getByTestId('crm-plan-blocked')).toBeVisible();
    await expect(page.getByText('CRM Unavailable')).toBeVisible();
    await expect(page.getByTestId('crm-menu-enter')).toHaveCount(0);
    await expect(page.getByTestId('crm-menu-assign')).toHaveCount(0);
    await expect(page.getByTestId('crm-stats-grid')).toHaveCount(0);
    const gated = await mock.requests({ path: '/api/leads' });
    expect(gated.map((r) => `${r.method} ${r.path}`)).toEqual([]);
    await page.getByTestId('crm-plan-blocked-action').click();
    await expect(page).toHaveURL(/billing|subscription|plan/i);
  });

  test('"no plan at all" is blocked the same way', async ({ page, mock, issues }) => {
    issues.allow(/.*/);
    await mock.setPlan('none');
    await loginAs(page, 'admin');
    await visit(page, '/admin/crm');
    await expect(page.getByTestId('crm-plan-blocked')).toBeVisible();
    expect(await mock.requests({ path: '/api/leads' })).toHaveLength(0);
  });

  test('an active plan is not gated; the card disappears when the plan is renewed (plan re-read on reload)', async ({ page, mock, issues }) => {
    issues.allow(/.*/);
    await mock.setPlan('expired');
    await loginAs(page, 'admin');
    await visit(page, '/admin/crm');
    await expect(page.getByTestId('crm-plan-blocked')).toBeVisible();
    await mock.setPlan('elite');
    await page.reload();
    await expect(page.getByTestId('crm-stats-grid')).toBeVisible();
    await expect(page.getByTestId('crm-plan-blocked')).toHaveCount(0);
  });

  test('direct visits to View / Assign and Enter Lead under a blocked plan show the server message (backend gate), nothing breaks', async ({ page, mock, issues }) => {
    issues.allow(/.*/);
    await mock.setPlan('expired');
    await loginAs(page, 'admin');
    await visit(page, '/admin/crm/leads');
    await expect(page.getByText(/plan has expired|free trial has ended|subscribe/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /retry|try again/i }).first()).toBeVisible();
    await visit(page, '/admin/crm/leads/edit');
    await page.getByLabel(/^Name/).first().fill('Gate Probe');
    await page.getByPlaceholder('Enter mobile number').fill('9811100022');
    await page.getByPlaceholder('Enter address').fill('Gate Street');
    await page.getByTestId('crm-category-trigger').click();
    await page.getByText('General', { exact: true }).first().click();
    await page.getByTestId('crm-lead-save').click();
    await expectToast(page, /plan has expired|free trial has ended|subscribe/i);
    await expect(page.getByTestId('crm-success-popup')).toHaveCount(0);
  });
});
