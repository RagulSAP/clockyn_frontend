/**
 * Q3 - Staff CRM (/staff/crm): my leads, filters, work-status updates, carry-forward request, add lead,
 * new-lead badge (appears, clears on open) and the plan gate (plan-status API, not a stored plan id).
 * Seed: stf-0001 has lead-004 (pending), lead-005 (working), lead-010 (completed), all dated today.
 */
import type { Page } from '@playwright/test';

import { expect, loginAs, test, USERS, visit } from '../support';
import { snap } from '../support/q3';

const card = (page: Page, id: string) => page.getByTestId(`crm-emp-lead-${id}`);
/** The CRM entry of the tab bar (phone) or sidebar (desktop), by accessible name. */
const crmNav = (page: Page, name: RegExp) => page.getByRole('tab', { name }).or(page.getByRole('link', { name }));

test.describe('my leads', () => {
  test('lists the leads assigned to me for today and filters them by work status', async ({ page }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/crm');
    for (const id of ['lead-004', 'lead-005', 'lead-010']) await expect(card(page, id)).toBeVisible();
    await expect(card(page, 'lead-006')).toHaveCount(0); // someone else's
    await expect(card(page, 'lead-001')).toHaveCount(0); // unassigned
    await snap(page, testInfo, 'staff-crm-list');
    await page.getByRole('radio', { name: 'Pending', exact: true }).click();
    await expect(card(page, 'lead-004')).toBeVisible();
    await expect(card(page, 'lead-005')).toHaveCount(0);
    await page.getByRole('radio', { name: 'Working', exact: true }).click();
    await expect(card(page, 'lead-005')).toBeVisible();
    await expect(card(page, 'lead-004')).toHaveCount(0);
    await page.getByRole('radio', { name: 'Completed', exact: true }).click();
    await expect(card(page, 'lead-010')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Carry Forward' })).toHaveCount(0); // no such chip
    await page.getByRole('radio', { name: 'All', exact: true }).click();
    await expect(card(page, 'lead-004')).toBeVisible();
  });

  test('a manager (role 2) gets the same screen with their own leads', async ({ page }) => {
    await loginAs(page, 'manager');
    await visit(page, '/staff/crm');
    await expect(page.getByTestId('staff-crm')).toBeVisible();
    await expect(card(page, 'lead-007')).toBeVisible(); // assigned to mgr-0001
  });

  test('no assigned leads shows the empty state', async ({ page }) => {
    await loginAs(page, 'fieldStaff');
    await visit(page, '/staff/crm');
    await expect(page.getByText('No Leads Assigned')).toBeVisible();
    await expect(page.getByText(/Pull down to refresh/)).toBeVisible();
  });

  test('a load failure shows an error with retry', async ({ page, mock, issues }) => {
    issues.allow(/leads\/employee/);
    await loginAs(page, 'staff');
    await mock.failNext('/api/leads/employee/*', { status: 500, times: 4, body: { detail: 'Leads service down' } });
    await visit(page, '/staff/crm');
    await expect(page.getByText('Leads service down')).toBeVisible();
    await mock.clearFailures();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(card(page, 'lead-004')).toBeVisible();
  });
});

test.describe('work status', () => {
  test('choosing Working sends the update and the card reflects it', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/crm');
    await page.getByTestId('crm-status-lead-004').click();
    await expect(page.getByTestId('crm-status-sheet')).toBeVisible();
    await snap(page, testInfo, 'staff-crm-status-sheet');
    await page.getByTestId('crm-status-option-working').click();
    const call = await mock.waitForRequest('/api/leads/lead-004/work-status', { method: 'PUT' });
    expect(call.query).toMatchObject({ work_status: 'working', user_id: USERS.staff.userId });
    await expect(page.getByTestId('crm-status-lead-004')).toHaveAccessibleName(/working/i);
    // re-synced from the server
    await page.reload();
    await expect(page.getByTestId('crm-status-lead-004')).toHaveAccessibleName(/working/i);
  });

  test('a failed update leaves the card unchanged', async ({ page, mock, issues }) => {
    issues.allow(/work-status/);
    await loginAs(page, 'staff');
    await visit(page, '/staff/crm');
    await mock.failNext('/api/leads/lead-004/work-status', { status: 500 });
    await page.getByTestId('crm-status-lead-004').click();
    await page.getByTestId('crm-status-option-completed').click();
    await mock.waitForRequest('/api/leads/lead-004/work-status', { method: 'PUT' });
    await expect(page.getByTestId('crm-status-lead-004')).toHaveAccessibleName(/pending/i);
  });
});

test.describe('carry-forward request', () => {
  test('Carry Forward needs a reason, then posts it and shows "Request Sent!"', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/crm');
    await page.getByTestId('crm-status-lead-004').click();
    await page.getByTestId('crm-status-option-carry_forward').click();
    await expect(page.getByTestId('crm-cfr-modal')).toBeVisible();
    await expect(page.getByTestId('crm-cfr-modal')).toContainText('Kiran Textiles');
    expect(await mock.requests({ path: '/carry-forward/request' })).toHaveLength(0); // no API call yet
    await expect(page.getByTestId('crm-cfr-send')).toBeDisabled();
    await snap(page, testInfo, 'staff-crm-cfr');
    await page.getByTestId('crm-cfr-reason').fill('  Client travelling this week  ');
    await expect(page.getByTestId('crm-cfr-send')).toBeEnabled();
    await page.getByTestId('crm-cfr-send').click();
    await expect(page.getByText('Request Sent!')).toBeVisible();
    const call = await mock.waitForRequest('/api/leads/carry-forward/request', { method: 'POST' });
    expect(call.query).toMatchObject({ leads_id: 'lead-004', user_id: USERS.staff.userId, description: 'Client travelling this week' });
    expect(call.query.forward_date).toBeFalsy();
    await expect(page.getByTestId('crm-cfr-modal')).toHaveCount(0);
    await expect(card(page, 'lead-004')).toContainText('Client travelling this week'); // CFR reason shown on the card
    const fx = await mock.fixtures();
    expect(fx.leads.find((l) => l.id === 'lead-004')).toBeTruthy();
  });
});

test.describe('add lead', () => {
  const fillValid = async (page: Page) => {
    await page.getByPlaceholder('Enter full name').fill('Harbour Traders');
    await page.getByPlaceholder('Enter address').fill('7 Dock Road');
    await page.getByTestId('crm-category-trigger').click();
    await page.getByText('Wholesale', { exact: true }).click();
    await expect(page.getByText('Select Category')).toHaveCount(0); // sheet closed
    await page.getByPlaceholder('Enter mobile number').fill('9876543210');
  };

  test('required fields and mobile length are validated, a valid lead is saved and sent for assignment', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/crm');
    await page.getByTestId('crm-add-lead').click();
    await expect(page.getByTestId('crm-add-lead-sheet')).toBeVisible();
    await page.getByTestId('crm-add-lead-save').click();
    await expect(page.getByTestId('crm-add-lead-error')).toHaveText('Please fill all required fields.');
    await snap(page, testInfo, 'staff-crm-add-lead');
    await fillValid(page);
    await page.getByPlaceholder('Enter mobile number').fill('98765432');
    await page.getByTestId('crm-add-lead-save').click();
    await expect(page.getByTestId('crm-add-lead-error')).toHaveText('Mobile number must be 10 digits.');
    expect(await mock.requests({ path: '/api/leads/create' })).toHaveLength(0);
    await page.getByPlaceholder('Enter mobile number').fill('9876543210');
    await page.getByTestId('crm-add-lead-save').click();
    await expect(page.getByText('Lead saved and sent to your admin for assignment')).toBeVisible();
    const call = await mock.waitForRequest('/api/leads/create', { method: 'POST' });
    expect(call.body).toMatchObject({ name: 'Harbour Traders', mobile: '9876543210', address: '7 Dock Road', category: 'Wholesale' });
    await expect(page.getByTestId('crm-add-lead-sheet')).toHaveCount(0);
    // an unassigned lead is not part of "My Leads"
    await expect(page.getByText('Harbour Traders')).toHaveCount(0);
  });

  test('a server rejection is shown inside the sheet and the form is kept', async ({ page, mock, issues }) => {
    issues.allow(/leads\/create/);
    await loginAs(page, 'staff');
    await visit(page, '/staff/crm');
    await page.getByTestId('crm-add-lead').click();
    await fillValid(page);
    await mock.failNext('/api/leads/create', { status: 200, body: { success: false, message: 'Duplicate lead for this mobile number' } });
    await page.getByTestId('crm-add-lead-save').click();
    await expect(page.getByTestId('crm-add-lead-error')).toContainText(/Duplicate lead|Failed to save lead/);
    await expect(page.getByPlaceholder('Enter full name')).toHaveValue('Harbour Traders');
  });
});

test.describe('new-lead badge', () => {
  test('CRM shows the number of unseen leads, opening My Leads clears it, a newly assigned lead raises it again', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(crmNav(page, /^CRM, 3 unread/)).toBeVisible();
    await crmNav(page, /^CRM, 3 unread/).first().click();
    await page.waitForURL('**/staff/crm');
    await expect(card(page, 'lead-004')).toBeVisible();
    await expect(crmNav(page, /^CRM, \d+ unread/)).toHaveCount(0);
    // stays cleared after a reload (seen ids persisted)
    await visit(page, '/staff/home');
    await expect(page.getByTestId('punch-button')).toBeVisible();
    await expect(crmNav(page, /^CRM, \d+ unread/)).toHaveCount(0);
    // the admin assigns a new lead; the next launch counts it
    const res = await page.request.post(`http://127.0.0.1:${process.env.MOCK_PORT ?? 8787}/api/leads/assign?leads_id=lead-001&user_id=${USERS.staff.userId}`, { headers: { 'x-e2e-tenant': mock.tenant } });
    expect(res.ok()).toBe(true);
    await page.reload();
    await expect(crmNav(page, /^CRM, 1 unread/).first()).toBeVisible();
  });
});

test.describe('CRM tab plan gate (staff roles use the plan-status API)', () => {
  test('Elite opens the CRM tab', async ({ page, mock }) => {
    await mock.setPlan('elite');
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await crmNav(page, /^CRM/).first().click();
    await page.waitForURL('**/staff/crm');
    await expect(card(page, 'lead-004')).toBeVisible();
  });

  for (const plan of ['core', 'prime', 'expired'] as const) {
    test(`${plan}: the tab toasts instead of opening, and the screen (deep link) shows "CRM Unavailable" without fetching leads`, async ({ page, mock, issues }) => {
      issues.allow(/leads\/employee|chat\/list|group-chat\/list/);
      await mock.setPlan(plan);
      await loginAs(page, 'staff');
      await visit(page, '/staff/home');
      await expect(page.getByTestId('punch-button')).toBeVisible();
      await crmNav(page, /^CRM/).first().click();
      await expect(page.getByText(/plan/i).first()).toBeVisible();
      expect(new URL(page.url()).pathname).toBe('/staff/home');
      await mock.clearRequests();
      await visit(page, '/staff/crm');
      await expect(page.getByTestId('crm-plan-blocked')).toBeVisible();
      await expect(page.getByText('CRM Unavailable')).toBeVisible();
      expect(await mock.requests({ path: '/api/leads/employee/' })).toHaveLength(0);
    });
  }
});
