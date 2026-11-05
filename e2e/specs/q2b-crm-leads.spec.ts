/**
 * Q2b - Admin CRM View / Assign Leads and Enter / Edit Lead: day filter, assign (branch / department filtered employees),
 * reassign, multi-assignee lead = ONE card, edit keeps the required date (payload), delete with confirmation, deep link with
 * `leadId`, enter-lead validation + payloads, required-date picker, double-tap guard, category add / delete / load failure.
 */
import type { Page } from '@playwright/test';

import { test, expect, loginAs, visit, USERS, expectToast } from '../support';
import { mockApi } from '../support/q2';
import { calendarDayName, effectiveDay, fmtDate, istDay, type WireLead } from '../support/q2b';

const cardsOf = (page: Page) => page.locator('[data-testid^="crm-lead-card-"]');
const card = (page: Page, id: string) => page.getByTestId(`crm-lead-card-${id}`);
const leadsOf = async (tenant: string) => (await mockApi<{ data: WireLead[] }>(tenant, 'GET', '/api/leads/org-0001')).data;
const dialog = (page: Page) => page.getByRole('dialog').last();

async function fillNewLead(page: Page, v: { name?: string; mobile?: string; address?: string; category?: string }): Promise<void> {
  if (v.name !== undefined) await page.getByPlaceholder('Enter full name').fill(v.name);
  if (v.mobile !== undefined) await page.getByPlaceholder('Enter mobile number').fill(v.mobile);
  if (v.address !== undefined) await page.getByPlaceholder('Enter address').fill(v.address);
  if (v.category) {
    await page.getByTestId('crm-category-trigger').click();
    await page.getByText(v.category, { exact: true }).first().click();
  }
}

test.describe('view / assign leads', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('today list: one card per lead, completed ones last and locked; Yesterday shows the lead created yesterday', async ({ page, mock }) => {
    await visit(page, '/admin/crm/leads');
    const today = (await leadsOf(mock.tenant)).filter((l) => effectiveDay(l) === istDay(0));
    await expect(cardsOf(page)).toHaveCount(today.length);
    await expect(page.getByTestId('crm-assign-lead-001')).toHaveText('Assign');
    await expect(page.getByTestId('crm-assign-lead-004')).toHaveText('Reassign');
    const ids = await cardsOf(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('crm-lead-card-', '')));
    const completed = today.filter((l) => l.work_status === 'completed').map((l) => l.leads_id);
    expect(ids.slice(-completed.length).sort()).toEqual([...completed].sort());
    for (const id of completed) {
      await expect(page.getByTestId(`crm-edit-${id}`)).toBeDisabled();
      await expect(page.getByTestId(`crm-delete-${id}`)).toBeDisabled();
      await expect(page.getByTestId(`crm-assign-${id}`)).toBeDisabled();
    }
    await page.getByRole('radio', { name: 'Yesterday' }).click();
    await expect(cardsOf(page)).toHaveCount((await leadsOf(mock.tenant)).filter((l) => effectiveDay(l) === istDay(-1)).length);
    await page.getByRole('radio', { name: 'Tomorrow' }).click();
    await expect(page.getByText('No leads found for this date')).toBeVisible();
  });

  test('a multi-assignee lead (two server rows) renders ONE card with both names and counts once on the hub', async ({ page, mock }) => {
    await mock.setState({ dupLeadRows: { 'lead-004': 'stf-0003' } });
    await visit(page, '/admin/crm/leads');
    await expect(card(page, 'lead-004')).toHaveCount(1);
    await expect(card(page, 'lead-004')).toContainText('Aarav Sharma, Chirag Patel');
    const today = (await leadsOf(mock.tenant)).filter((l) => effectiveDay(l) === istDay(0));
    expect(new Set(today.map((l) => l.leads_id)).size).toBeLessThan(today.length); // the server really sent a duplicate row
    await expect(cardsOf(page)).toHaveCount(new Set(today.map((l) => l.leads_id)).size);
    await visit(page, '/admin/crm');
    await expect(page.getByTestId('crm-lead-row-lead-004')).toHaveCount(1);
  });

  test('assign: employees are filtered by branch and department (server query), assign posts the employee + their branch / dept, success popup, card shows the assignee', async ({ page, mock }) => {
    await visit(page, '/admin/crm/leads');
    await page.getByTestId('crm-assign-lead-001').click();
    await expect(page.getByRole('heading', { name: 'Assign Lead' })).toBeVisible();
    await expect(page.getByTestId(`crm-employee-${USERS.staff.userId}`)).toBeVisible();
    await expect(page.getByTestId('crm-employee-stf-0002')).toBeVisible();
    await page.getByTestId('crm-assign-branch').click();
    await page.getByRole('radio', { name: 'Warehouse' }).click();
    await mock.waitForRequest('/addstaff/all-staff/', { predicate: (r) => r.query.branch_id === '102' });
    await expect(page.getByTestId('crm-employee-stf-0002')).toBeVisible(); // Bhavna, Warehouse
    await expect(page.getByTestId(`crm-employee-${USERS.staff.userId}`)).toHaveCount(0); // Aarav, Head Office
    await page.getByTestId('crm-assign-dept').click();
    await page.getByRole('radio', { name: 'Operations' }).click();
    await mock.waitForRequest('/addstaff/all-staff/', { predicate: (r) => r.query.branch_id === '102' && r.query.dept_id === 'dept-102' });
    await page.getByTestId('crm-assign-employee-stf-0002').click();
    const call = await mock.waitForRequest('/api/leads/assign', { method: 'POST' });
    expect(call.query).toMatchObject({ leads_id: 'lead-001', org_id: 'org-0001', user_id: 'stf-0002', branch_id: '102', dept_id: 'dept-102' });
    await expect(page.getByTestId('crm-success-popup')).toContainText('Lead Assigned!');
    await expect(card(page, 'lead-001')).toContainText('Assigned to: Bhavna Rao', { timeout: 8_000 }); // popup closes, back on the list
    await expect(page.getByTestId('crm-assign-lead-001')).toHaveText('Reassign');
  });

  test('reassign: the current assignee is not offered; PUT assignment with the new employee; popup says Reassigned', async ({ page, mock }) => {
    await visit(page, '/admin/crm/leads');
    await page.getByTestId('crm-assign-lead-004').click();
    await expect(page.getByRole('heading', { name: 'Reassign Lead' })).toBeVisible();
    await expect(page.getByTestId('crm-employee-stf-0003')).toBeVisible();
    await expect(page.getByTestId(`crm-employee-${USERS.staff.userId}`)).toHaveCount(0); // Aarav holds it now
    await page.getByTestId('crm-assign-employee-stf-0003').click();
    const call = await mock.waitForRequest('/api/leads/assignment/lead-004', { method: 'PUT' });
    expect(call.query).toMatchObject({ user_id: 'stf-0003' });
    await expect(page.getByTestId('crm-success-popup')).toContainText('Lead Reassigned!');
    await expect(card(page, 'lead-004')).toContainText('Assigned to: Chirag Patel', { timeout: 8_000 });
  });

  test('an assign failure toasts the server error and stays in the assign view; double tap assigns once', async ({ page, mock, issues }) => {
    issues.allow(/api\/leads\/assign/);
    await visit(page, '/admin/crm/leads');
    await page.getByTestId('crm-assign-lead-001').click();
    await mock.failNext('/api/leads/assign', { method: 'POST', status: 500, body: { detail: 'Assignment service down' } });
    await page.getByTestId(`crm-assign-employee-${USERS.staff.userId}`).click();
    await expectToast(page, /Assignment service down|Failed to assign lead/);
    await expect(page.getByTestId('crm-assign-branch')).toBeVisible();
    await expect(page.getByTestId(`crm-assign-employee-${USERS.staff.userId}`)).toBeEnabled();
    await page.getByTestId(`crm-assign-employee-${USERS.staff.userId}`).dblclick();
    await expect(page.getByTestId('crm-success-popup')).toBeVisible();
    expect((await mock.requests({ path: '/api/leads/assign', method: 'POST' })).filter((r) => r.status === 200)).toHaveLength(1);
  });

  test('delete asks for confirmation (Cancel keeps the lead); confirming deletes with a toast; a failure keeps it', async ({ page, mock, issues }) => {
    issues.allow(/api\/leads/);
    await visit(page, '/admin/crm/leads');
    await page.getByTestId('crm-delete-lead-001').click();
    await expect(dialog(page).getByText('Delete Lead')).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    expect(await mock.requests({ path: '/api/leads/lead-001', method: 'DELETE' })).toHaveLength(0);
    await expect(card(page, 'lead-001')).toBeVisible();
    await mock.failNext('/api/leads/lead-001', { method: 'DELETE', status: 500, body: { detail: 'Cannot delete right now' } });
    await page.getByTestId('crm-delete-lead-001').click();
    await dialog(page).getByRole('button', { name: 'Delete', exact: true }).click();
    await expectToast(page, /Cannot delete right now|Failed to delete lead/);
    await expect(card(page, 'lead-001')).toBeVisible();
    await page.getByTestId('crm-delete-lead-001').click();
    await dialog(page).getByRole('button', { name: 'Delete', exact: true }).click();
    await mock.waitForRequest('/api/leads/lead-001', { method: 'DELETE' });
    await expectToast(page, 'Lead deleted successfully');
    await expect(card(page, 'lead-001')).toHaveCount(0);
  });

  test('deep link with leadId opens that lead\'s assign view; unknown / completed ids explain themselves', async ({ page }) => {
    await visit(page, '/admin/crm/leads', { leadId: 'lead-001' });
    await expect(page.getByRole('heading', { name: 'Assign Lead' })).toBeVisible();
    await expect(page.getByText('Sunrise Stores').first()).toBeVisible();
    await page.getByRole('button', { name: 'Go back' }).click(); // back to the list first
    await expect(card(page, 'lead-001')).toBeVisible();
    await visit(page, '/admin/crm/leads', { leadId: 'lead-999' });
    await expectToast(page, 'Lead not found');
    await visit(page, '/admin/crm/leads', { leadId: 'lead-006' }); // completed
    await expectToast(page, 'Completed leads cannot be assigned');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('edit lead', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('edit is prefilled including the required date and SAVES it (payload carries required_date); popup says Updated and returns', async ({ page, mock }) => {
    await visit(page, '/admin/crm/leads');
    await page.getByTestId('crm-edit-lead-004').click();
    await page.waitForURL(/leadId=lead-004/);
    await expect(page.getByPlaceholder('Enter full name')).toHaveValue('Kiran Textiles');
    await expect(page.getByPlaceholder('Enter mobile number')).toHaveValue('9845010411');
    await expect(page.getByTestId('crm-category-trigger')).toContainText('Corporate');
    await expect(page.getByTestId('crm-required-date')).toContainText(fmtDate(istDay(0)));
    await page.getByPlaceholder('Enter remarks').fill('Updated remark');
    await page.getByTestId('crm-lead-save').click();
    const call = await mock.waitForRequest('/api/leads/lead-004', { method: 'PUT' });
    expect(call.body).toEqual({ org_id: 'org-0001', name: 'Kiran Textiles', mobile: '9845010411', address: '13 Market Street, Bengaluru', category: 'Corporate', remarks: 'Updated remark', required_date: istDay(0) });
    await expect(page.getByTestId('crm-success-popup')).toContainText('Lead Updated!');
    await page.waitForURL('**/admin/crm/leads', { timeout: 8_000 }); // back to where the edit started
    expect((await leadsOf(mock.tenant)).find((l) => l.leads_id === 'lead-004')!.created_date).toBe(istDay(0)); // not blanked
  });

  test('clearing the required date saves null; a lead without a date keeps null; unknown id shows "Lead not found"', async ({ page, mock, issues }) => {
    await visit(page, '/admin/crm/leads/edit', { leadId: 'lead-004' });
    await expect(page.getByTestId('crm-required-date')).toContainText(fmtDate(istDay(0)));
    await page.getByRole('button', { name: 'Clear required date' }).click();
    await page.getByTestId('crm-lead-save').click();
    expect((await mock.waitForRequest('/api/leads/lead-004', { method: 'PUT' })).body?.required_date).toBeNull();
    await visit(page, '/admin/crm/leads/edit', { leadId: 'lead-002' });
    await expect(page.getByTestId('crm-required-date')).toContainText('Select a date');
    await page.getByTestId('crm-lead-save').click();
    expect((await mock.waitForRequest('/api/leads/lead-002', { method: 'PUT' })).body?.required_date).toBeNull();
    issues.allow(/.*/);
    await visit(page, '/admin/crm/leads/edit', { leadId: 'lead-404' });
    await expect(page.getByText('Lead not found').first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('enter lead', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/crm/leads/edit');
    await expect(page.getByTestId('crm-lead-save')).toBeVisible();
  });

  test('validation: empty save lists the required fields; mobile accepts digits only (max 10) and must be 10 digits', async ({ page, mock }) => {
    await page.getByTestId('crm-lead-save').click();
    await expectToast(page, 'Please fill all required fields');
    await expect(page.getByText('Required', { exact: true })).toHaveCount(4); // name, mobile, address, category
    await fillNewLead(page, { name: 'Probe', address: 'Somewhere', category: 'General' });
    await page.getByPlaceholder('Enter mobile number').fill('98ab76543210999');
    await expect(page.getByPlaceholder('Enter mobile number')).toHaveValue('9876543210');
    await page.getByPlaceholder('Enter mobile number').fill('98765 43210'); // formatted paste keeps all 10 digits
    await expect(page.getByPlaceholder('Enter mobile number')).toHaveValue('9876543210');
    await page.getByPlaceholder('Enter mobile number').fill('987654321');
    await page.getByTestId('crm-lead-save').click();
    await expectToast(page, 'Mobile number must be exactly 10 digits');
    expect(await mock.requests({ path: '/api/leads/create', method: 'POST' })).toHaveLength(0);
  });

  test('create: trimmed payload with required date from the picker, popup "Lead Saved!", lands on the hub, lead is unassigned; double tap saves once', async ({ page, mock }) => {
    await fillNewLead(page, { name: '  Fresh Lead  ', mobile: '9811122200', address: ' 5 MG Road ', category: 'Retail' });
    await page.getByPlaceholder('Enter remarks').fill('Hot prospect');
    await page.getByTestId('crm-required-date').click();
    await page.getByRole('button', { name: new RegExp(`^${calendarDayName(istDay(0))}`) }).click();
    await expect(page.getByTestId('crm-required-date')).toContainText(fmtDate(istDay(0)));
    await page.getByTestId('crm-lead-save').dblclick();
    await expect(page.getByTestId('crm-success-popup')).toContainText('Lead Saved!');
    expect((await mock.requests({ path: '/api/leads/create', method: 'POST' }))).toHaveLength(1);
    expect((await mock.requests({ path: '/api/leads/create', method: 'POST' }))[0].body).toEqual({ org_id: 'org-0001', name: 'Fresh Lead', mobile: '9811122200', address: '5 MG Road', category: 'Retail', remarks: 'Hot prospect', required_date: istDay(0) });
    await page.waitForURL('**/admin/crm', { timeout: 8_000 });
    const created = (await leadsOf(mock.tenant)).find((l) => l.client_name === 'Fresh Lead')!;
    expect(created.assigned_user_id).toBeNull();
    await expect(page.getByTestId(`crm-lead-row-${created.leads_id}`)).toContainText('Unassigned');
  });

  test('no required date sends null; a failed save toasts and keeps the form', async ({ page, mock, issues }) => {
    issues.allow(/api\/leads/);
    await fillNewLead(page, { name: 'No Date', mobile: '9811122201', address: 'Anywhere', category: 'General' });
    await mock.failNext('/api/leads/create', { method: 'POST', status: 500, body: { detail: 'Lead store offline' } });
    await page.getByTestId('crm-lead-save').click();
    await expectToast(page, /Lead store offline|Failed to save lead/);
    await expect(page.getByPlaceholder('Enter full name')).toHaveValue('No Date');
    await expect(page.getByTestId('crm-success-popup')).toHaveCount(0);
    await page.getByTestId('crm-lead-save').click();
    const ok = await mock.waitForRequest('/api/leads/create', { method: 'POST', predicate: (r) => r.status === 200 });
    expect(ok.body?.required_date).toBeNull();
  });

  test('categories: add selects the new one; duplicate and empty names are rejected; delete confirms and clears a selected one; load failure offers Retry', async ({ page, mock, issues }) => {
    issues.allow(/api\/leads\/categories/);
    await page.getByTestId('crm-category-add').click();
    await page.getByTestId('crm-category-add-confirm').click();
    await expectToast(page, 'Please enter category name');
    await page.getByPlaceholder('Enter category name').fill('Retail');
    await page.getByTestId('crm-category-add-confirm').click();
    await expectToast(page, /already exists/i);
    await page.getByPlaceholder('Enter category name').fill('Pharma');
    await page.getByTestId('crm-category-add-confirm').click();
    const add = await mock.waitForRequest('/api/leads/categories', { method: 'POST', predicate: (r) => r.query.category_name === 'Pharma' });
    expect(add.query).toMatchObject({ category_name: 'Pharma', org_id: 'org-0001' });
    await expectToast(page, 'Category added successfully');
    await expect(page.getByTestId('crm-category-trigger')).toContainText('Pharma');

    await page.getByTestId('crm-category-trigger').click();
    await page.getByRole('button', { name: 'Delete category Pharma' }).click();
    await expect(dialog(page).getByText('Delete category?')).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    expect(await mock.requests({ path: '/api/leads/categories/cat-', method: 'DELETE' })).toHaveLength(0);
    await page.getByRole('button', { name: 'Delete category Pharma' }).click();
    await dialog(page).getByRole('button', { name: 'Delete', exact: true }).click();
    await expectToast(page, 'Category deleted successfully');
    await expect(page.getByTestId('crm-category-trigger')).toContainText('Select Category'); // selected one was removed
    await page.keyboard.press('Escape');

    await mock.failNext('/api/leads/categories/org-0001', { status: 500, times: -1 });
    await visit(page, '/admin/crm/leads/edit');
    await page.getByTestId('crm-category-trigger').click();
    await expect(page.getByTestId('crm-category-error')).toBeVisible();
    await mock.clearFailures();
    await page.getByTestId('crm-category-error').getByRole('button', { name: /retry|try again/i }).click();
    await expect(page.getByText('Wholesale', { exact: true }).first()).toBeVisible();
  });
});
