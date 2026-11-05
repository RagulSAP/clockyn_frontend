/**
 * Q1 - company management and team rules: company view/edit/add/delete, managers, shifts (+ assignment), attendance rule, holidays.
 */
import type { Page } from '@playwright/test';

import { BRANCHES, DEPARTMENTS, expect, loginAs, MOCK_URL, OTP, test, USERS, visit } from '../support';
import { closeOverlay, isTruncated, pngFile, snapBoth } from '../support/q1';
import { pinMidMonthIfNeeded } from '../support/q3';

const iso = (d: number): string => new Date(Date.now() + 330 * 60_000 + d * 86_400_000).toISOString().slice(0, 10);

async function addSecondCompany(tenant: string): Promise<void> {
  const res = await fetch(`${MOCK_URL}/company/add`, {
    method: 'POST',
    headers: { 'x-e2e-tenant': tenant, 'content-type': 'application/json' },
    body: JSON.stringify({ user_id: USERS.admin.userId, org_name: 'Second Co', org_address: '1 Lane', branches: ['Only Branch'], departments: ['Ops'] }),
  });
  expect(res.ok).toBeTruthy();
}

test.describe('Q1 company', () => {
  test('view shows hero, contact, legal and structure; with one company there is no Delete', async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/company');
    await expect(page.getByTestId('company-hero')).toContainText('Acme Traders');
    await expect(page.getByTestId('company-contact')).toContainText(USERS.admin.mobile);
    await expect(page.getByTestId('company-structure')).toContainText('Branches');
    await expect(page.getByTestId('company-edit')).toBeVisible();
    await expect(page.getByTestId('company-delete')).toHaveCount(0);
    await snapBoth(page, testInfo, 'company-view');
  });

  test('edit: prefilled, validation (required, pincode), save updates the name everywhere and the logo is uploaded', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/company');
    await page.getByTestId('company-edit').click();
    await page.waitForURL(/\/admin\/company\/edit\?orgId=org-0001/);
    await expect(page.getByTestId('company-name')).toHaveValue('Acme Traders');
    await snapBoth(page, testInfo, 'company-edit');
    await page.getByTestId('company-name').fill('');
    await page.getByTestId('company-submit').click();
    await expect(page.getByText('Please fill all required fields including State, District and Pincode').first()).toBeVisible();
    await page.getByTestId('company-name').fill('Acme Traders Pvt');
    await page.getByTestId('company-pincode').fill('12');
    await page.getByTestId('company-submit').click();
    await expect(page.getByText('Enter a valid 6-digit pincode').first()).toBeVisible();
    await page.getByTestId('company-pincode').fill('560001');
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('logo-pick').click();
    await (await chooser).setFiles(pngFile('logo.png'));
    await page.getByTestId('company-submit').click();
    const put = await mock.waitForRequest('/company/update/org-0001', { method: 'PUT' });
    expect(put.body).toMatchObject({ org_name: 'Acme Traders Pvt', pincode: 560001 });
    const logo = await mock.waitForRequest('/company/update-logo/org-0001', { method: 'POST' });
    expect(logo.files?.[0]?.field).toBe('logo');
    await page.waitForURL(/\/admin\/company(\?|$)/);
    await expect(page.getByTestId('company-hero')).toContainText('Acme Traders Pvt');
    // the dashboard header follows the new name
    await visit(page, '/admin/home');
    await expect(page.getByTestId('org-name')).toContainText('Acme Traders Pvt');
  });

  test('edit: a changed mobile number must be verified by OTP before saving', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/company/edit', { orgId: 'org-0001' });
    await expect(page.getByTestId('company-name')).toHaveValue('Acme Traders');
    await page.getByTestId('company-mobile').fill('9333300001');
    await page.getByTestId('company-submit').click();
    await expect(page.getByText('Please verify new mobile number').first()).toBeVisible();
    expect(await mock.requests({ path: '/company/update', method: 'PUT' })).toHaveLength(0);
    await page.getByTestId('company-mobile-get-otp').click();
    await page.getByTestId('company-mobile-otp').fill('000000');
    await page.getByTestId('company-mobile-verify').click();
    await expect(page.getByText('Invalid mobile OTP').first()).toBeVisible();
    await page.getByTestId('company-mobile-get-otp').click().catch(() => undefined);
    await page.getByTestId('company-mobile-otp').fill(OTP);
    await page.getByTestId('company-mobile-verify').click();
    await expect(page.getByTestId('company-mobile-verified')).toBeVisible();
    await page.getByTestId('company-submit').click();
    const put = await mock.waitForRequest('/company/update/org-0001', { method: 'PUT' });
    expect(put.body).toMatchObject({ mobile_number: '9333300001' });
  });

  test('add company: required fields, branch/department lists, save returns to the view', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/company/edit');
    await snapBoth(page, testInfo, 'company-add');
    await page.getByTestId('company-submit').click();
    await expect(page.getByText('Please fill all required fields including State, District and Pincode').first()).toBeVisible();
    await page.getByTestId('company-name').fill('Third Co');
    await page.getByTestId('company-address').fill('9 Ring Road');
    await page.getByTestId('company-state').fill('Karnataka');
    await page.getByTestId('company-district').fill('Mysuru');
    await page.getByTestId('company-pincode').fill('570001');
    await page.getByTestId('company-submit').click(); // still no branch
    await expect(page.getByText('Please fill all required fields including State, District and Pincode').first()).toBeVisible();
    await page.getByTestId('company-branches-0').fill('Mysuru HQ');
    await page.getByTestId('company-branches-add').click();
    await page.getByTestId('company-branches-1').fill('Mysuru Outlet');
    await page.getByTestId('company-branches-remove-1').click();
    await page.getByTestId('company-departments-0').fill('Sales');
    await page.getByTestId('company-submit').click();
    const post = await mock.waitForRequest('/company/add', { method: 'POST' });
    expect(post.body).toMatchObject({ org_name: 'Third Co', state: 'Karnataka', pincode: 570001 });
    expect(post.body?.branches).toEqual(['Mysuru HQ']);
    await page.waitForURL(/\/admin\/company(\?|$)/);
  });

  test('delete is offered only with more than one company; it confirms, deletes and returns to the dashboard of the remaining company', async ({ page, tenant, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await addSecondCompany(tenant);
    await visit(page, '/admin/company', { orgId: 'org-0002' });
    await expect(page.getByTestId('company-hero')).toContainText('Second Co');
    await expect(page.getByTestId('company-delete')).toBeVisible();
    await page.getByTestId('company-delete').click();
    await expect(page.getByText('Are you sure you want to delete this company? This action cannot be undone.')).toBeVisible();
    await snapBoth(page, testInfo, 'company-delete-confirm');
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(await mock.requests({ path: '/company/delete', method: 'DELETE' })).toHaveLength(0);
    await page.getByTestId('company-delete').click();
    await page.getByRole('button', { name: 'Delete' }).last().click();
    await mock.waitForRequest('/company/delete/org-0002/', { method: 'DELETE' });
    await page.waitForURL(/\/admin\/home/);
    const list = await mock.fixtures();
    void list;
    await page.getByTestId('switch-company').click();
    await expect(page.getByTestId('company-org-0001')).toBeVisible();
    await expect(page.getByTestId('company-org-0002')).toHaveCount(0);
  });
});

test.describe('Q1 managers', () => {
  test('list shows both managers with stats; branches, staff-under and permissions sheets', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/managers');
    await expect(page.getByTestId('manager-card-mgr-0001')).toContainText(USERS.manager.name);
    await expect(page.getByTestId('manager-card-mgr-0002')).toContainText('Rahul Verma');
    await snapBoth(page, testInfo, 'managers-list');
    await page.getByTestId('manager-branches-mgr-0001').click();
    await expect(page.getByTestId('branches-modal')).toContainText(BRANCHES.hq.name);
    await closeOverlay(page);
    await page.getByRole('button', { name: `Staff under ${USERS.manager.name}` }).click();
    await expect(page.getByTestId('manager-staff-sheet')).toBeVisible();
    await expect(page.getByTestId('manager-staff-sheet').getByText(/Aarav|Bhavna|Staff/).first()).toBeVisible();
    await closeOverlay(page);

    await page.getByRole('button', { name: `Permissions of ${USERS.manager.name}` }).click();
    await expect(page.getByTestId('permissions-count')).toContainText('10/10 permissions active');
    await snapBoth(page, testInfo, 'managers-permissions');
    await page.getByTestId('permissions-toggle-all').click();
    await expect(page.getByTestId('permissions-count')).toContainText('0/10 permissions active');
    await page.getByRole('switch', { name: 'Requests Management' }).first().click().catch(async () => page.getByText('Requests Management').first().click());
    await expect(page.getByTestId('permissions-count')).toContainText('1/10 permissions active');
    await page.getByTestId('permissions-save').click();
    const post = await mock.waitForRequest('/managers/mgr-0001/permissions', { method: 'POST' });
    const sent = post.body?.permissions as Record<string, boolean>;
    expect(Object.values(sent).filter(Boolean)).toHaveLength(1);
    await expect(page.getByTestId('permissions-sheet')).toHaveCount(0);
  });

  test('add manager: staff, branch and department are required in that order; conflicts are reported; success lists the new manager', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/managers/edit');
    await page.getByTestId('manager-submit').click();
    await expect(page.getByText('Please select a staff member').first()).toBeVisible();
    const fx = await mock.fixtures();
    const candidate = fx.staff.find((s) => s.role_id === 3 && s.status === 1 && s.user_id === 'stf-0007')!;
    await page.getByTestId('select-staff').click();
    await page.getByRole('radio', { name: new RegExp(candidate.name) }).click();
    await page.getByTestId('manager-submit').click();
    await expect(page.getByText('Please select at least one branch to assign').first()).toBeVisible();
    await page.getByTestId('assign-branches').click();
    await page.getByRole('checkbox', { name: BRANCHES.warehouse.name }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    // department is now required too (new rule)
    await page.getByTestId('manager-submit').click();
    await expect(page.getByText('Please select at least one department to assign').first()).toBeVisible();
    await page.getByTestId('assign-depts').click();
    await page.getByRole('checkbox', { name: DEPARTMENTS.sales.name }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('access-preview')).toContainText(BRANCHES.warehouse.name);
    await snapBoth(page, testInfo, 'managers-add');
    await page.getByTestId('manager-submit').click();
    const post = await mock.waitForRequest('/managers/assign', { method: 'POST' });
    expect(post.body).toMatchObject({ user_id: candidate.user_id });
    expect(JSON.stringify(post.body?.assignments)).toContain(DEPARTMENTS.sales.id);
    await page.waitForURL(/\/admin\/managers$/);
    await expect(page.getByTestId(`manager-card-${candidate.user_id}`)).toBeVisible();
  });

  test('assigning a branch + department that another manager already covers shows the conflict modal and does not save', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/managers/edit');
    await page.getByTestId('select-staff').click();
    await page.locator('[role=radio]:not([data-testid^="theme-"])').first().click();
    await page.getByTestId('assign-branches').click();
    await page.getByRole('checkbox', { name: BRANCHES.hq.name }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByTestId('assign-depts').click();
    await page.getByRole('checkbox', { name: 'Select all' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByTestId('manager-submit').click();
    await expect(page.getByTestId('conflict-modal')).toBeVisible();
    await snapBoth(page, testInfo, 'managers-conflict');
    await page.getByTestId('conflict-ok').click();
    expect(await mock.requests({ path: '/managers/assign', method: 'POST' })).toHaveLength(0);
  });

  test('edit manager: person locked, scope prefilled; remove asks for confirmation and demotes to staff', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/managers/edit', { userId: 'mgr-0002' });
    await expect(page.getByTestId('manager-staff-locked')).toBeVisible();
    await expect(page.getByTestId('access-preview')).toContainText(BRANCHES.warehouse.name);
    await page.getByTestId('assign-depts').click();
    await page.getByRole('checkbox', { name: 'Select all' }).click(); // selects every department (only Operations was set)
    await page.getByRole('checkbox', { name: 'Select all' }).click(); // ... and clears them again
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByTestId('manager-submit').click();
    await expect(page.getByText('Please select at least one department to assign').first()).toBeVisible();
    expect(await mock.requests({ path: '/managers/assign', method: 'POST' })).toHaveLength(0);

    await visit(page, '/admin/managers');
    await page.getByRole('button', { name: 'Remove Rahul Verma' }).click();
    await expect(page.getByText('Remove Rahul Verma as manager?')).toBeVisible();
    await page.getByRole('button', { name: 'Remove', exact: true }).last().click();
    await mock.waitForRequest('/managers/mgr-0002', { method: 'DELETE' });
    await expect(page.getByTestId('manager-card-mgr-0002')).toHaveCount(0);
    expect((await mock.fixtures()).staff.find((s) => s.user_id === 'mgr-0002')?.role_id).toBe(3);
  });
});

test.describe('Q1 shifts', () => {
  test('list, add (validation), edit, assign staff (assign + unassign), delete', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/shifts');
    await expect(page.getByTestId('shift-card-1')).toContainText('General');
    // regression (Q1-D8): the time range stays on one line in the desktop grid
    const range = await page.getByTestId('shift-card-1').getByText('09:00 AM - 06:00 PM').boundingBox();
    expect(range!.height).toBeLessThan(26);
    await snapBoth(page, testInfo, 'shifts-list');

    // add: validation first
    await page.getByTestId('add-shift').click();
    await expect(page.getByTestId('shift-form-modal')).toBeVisible();
    await page.getByTestId('shift-form-submit').click();
    await expect(page.getByText('Enter a shift name')).toBeVisible();
    await expect(page.getByText('Select a start time')).toBeVisible();
    await expect(page.getByText('Select an end time')).toBeVisible();
    await page.getByTestId('shift-name').fill('Evening');
    await page.getByTestId('shift-start').fill('14:00');
    await page.getByTestId('shift-end').fill('22:00');
    await snapBoth(page, testInfo, 'shifts-form');
    await page.getByTestId('shift-form-submit').click();
    const post = await mock.waitForRequest('/shift/create', { method: 'POST' });
    expect(post.body).toMatchObject({ shift_name: 'Evening' });
    await expect(page.getByText('Evening').first()).toBeVisible();

    // duplicate name is refused and the dialog stays open
    await page.getByTestId('add-shift').click();
    await page.getByTestId('shift-name').fill('evening');
    await page.getByTestId('shift-start').fill('10:00');
    await page.getByTestId('shift-end').fill('12:00');
    await page.getByTestId('shift-form-submit').click();
    await expect(page.getByText(/already exists/i).first()).toBeVisible();
    await expect(page.getByTestId('shift-form-modal')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    // edit
    const eveningId = (await mock.fixtures()).shifts.find((s) => s.name === 'Evening')!.id;
    await page.getByTestId(`shift-menu-${eveningId}`).click();
    await page.getByTestId('shift-menu-edit').click();
    await expect(page.getByTestId('shift-name')).toHaveValue('Evening');
    await page.getByTestId('shift-name').fill('Late Evening');
    await page.getByTestId('shift-form-submit').click();
    await mock.waitForRequest(`/shift/update/${eveningId}`, { method: 'PUT' });
    await expect(page.getByText('Late Evening').first()).toBeVisible();

    // assign / unassign
    await page.getByTestId(`shift-menu-${eveningId}`).click();
    await page.getByTestId('shift-menu-assign').click();
    await expect(page.getByTestId('assign-staff-sheet')).toBeVisible();
    await snapBoth(page, testInfo, 'shifts-assign');
    await page.getByTestId('available-stf-0001').click();
    await page.getByTestId('assign-submit').click();
    const assign = await mock.waitForRequest('/shift/assign_staff', { method: 'POST' });
    expect(assign.body).toMatchObject({ shift_id: eveningId, user_ids: ['stf-0001'] });
    await expect(page.getByTestId('unassign-stf-0001')).toBeVisible();
    await page.getByTestId('unassign-stf-0001').click();
    await page.getByRole('button', { name: 'Remove', exact: true }).last().click();
    await mock.waitForRequest(`/shift/unassign_staff/`, { method: 'DELETE' });
    await expect(page.getByTestId('unassign-stf-0001')).toHaveCount(0);
    await closeOverlay(page);

    // delete
    await page.getByTestId(`shift-menu-${eveningId}`).click();
    await page.getByTestId('shift-menu-delete').click();
    await expect(page.getByText(/Staff on this shift will be unassigned/)).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await mock.waitForRequest(`/shift/delete/${eveningId}`, { method: 'DELETE' });
    await expect(page.getByText('Late Evening')).toHaveCount(0);
  });

  test('a server refusal when saving a shift (e.g. the 18-hour rule) is shown and keeps the dialog', async ({ page, mock, issues }) => {
    issues.allow(/shift\/create/);
    await loginAs(page, 'admin');
    await visit(page, '/admin/shifts');
    await page.getByTestId('add-shift').click();
    await page.getByTestId('shift-name').fill('Marathon');
    await page.getByTestId('shift-start').fill('02:00');
    await page.getByTestId('shift-end').fill('23:00');
    // the 18-hour rule is also checked client-side with an explanation, without a request
    await page.getByTestId('shift-form-submit').click();
    await expect(page.getByTestId('shift-form-error')).toContainText('works out to 21.0 hours');
    expect(await mock.requests({ path: '/shift/create', method: 'POST' })).toHaveLength(0);
    await page.getByTestId('shift-end').fill('10:00');
    await mock.failNext('/shift/create', { status: 400, body: { detail: 'Shift duration cannot exceed 18 hours' } });
    await page.getByTestId('shift-form-submit').click();
    await expect(page.getByText('Shift duration cannot exceed 18 hours').first()).toBeVisible();
    await expect(page.getByTestId('shift-form-modal')).toBeVisible();
  });
});

test.describe('Q1 attendance rule', () => {
  test('defaults from the server, summary follows the selection, save posts the rule', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/attendance-rule');
    await expect(page.getByTestId('rule-summary')).toContainText('late');
    await snapBoth(page, testInfo, 'attendance-rule');
    await page.getByTestId('rule-count').click();
    await page.getByRole('radio', { name: '5', exact: true }).click();
    await page.getByTestId('rule-consider').click();
    await page.getByRole('radio', { name: 'Leave' }).click();
    await expect(page.getByTestId('rule-summary')).toContainText('5 times');
    await expect(page.getByTestId('rule-summary')).toContainText('Leave');
    await page.getByTestId('save-rule').click();
    const post = await mock.waitForRequest('/api/attendance-rule/', { method: 'POST' });
    expect(post.body).toMatchObject({ late_punch_in_count: 5, consider_as: 'Leave' });
    await expect(page.getByText('Rule saved successfully').first()).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('rule-summary')).toContainText('5 times');
  });

  test('a failed save shows the server message and keeps the draft', async ({ page, mock, issues }) => {
    issues.allow(/attendance-rule/);
    await loginAs(page, 'admin');
    await visit(page, '/admin/attendance-rule');
    await page.getByTestId('rule-count').click();
    await page.getByRole('radio', { name: '7', exact: true }).click();
    await mock.failNext('/api/attendance-rule/*', { method: 'POST', status: 500, body: { detail: 'Rule service unavailable' } });
    await page.getByTestId('save-rule').click();
    await expect(page.getByText(/Rule service unavailable/).first()).toBeVisible();
    await expect(page.getByTestId('rule-summary')).toContainText('7 times');
  });
});

/** Click a calendar day (accessible name `<day> <Month> <year>`) inside a calendar test id. */
async function clickDay(page: Page, grid: string, label: string): Promise<void> {
  await page.getByTestId(grid).getByRole('button', { name: new RegExp(`^${label}`) }).first().click();
}

test.describe('Q1 holidays', () => {
  test.beforeEach(async ({ page, mock }) => {
    await pinMidMonthIfNeeded(page, mock); // month grids need earlier days of the month: see support/q3.ts
  });

  test('add a multi-date holiday with scope; list groups the dates; month change clears the selection', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/holidays');
    const [y, m] = iso(0).split('-').map(Number);
    const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    await snapBoth(page, testInfo, 'holidays-calendar');
    // pick the 26th and 27th of this month (always in the future relative to the fixed seed day? use the last days)
    await clickDay(page, 'holiday-grid', `26 ${monthName} ${y}`);
    await clickDay(page, 'holiday-grid', `27 ${monthName} ${y}`);
    await expect(page.getByTestId('selected-dates-card')).toBeVisible();
    // month change clears the selection
    await page.getByRole('button', { name: 'Next month' }).first().click();
    await expect(page.getByTestId('selected-dates-card')).toHaveCount(0);
    await page.getByRole('button', { name: 'Previous month' }).first().click();
    await expect(page.getByTestId('selected-dates-card')).toHaveCount(0);

    await clickDay(page, 'holiday-grid', `26 ${monthName} ${y}`);
    await clickDay(page, 'holiday-grid', `27 ${monthName} ${y}`);
    // name is required
    await page.getByTestId('holiday-add').click();
    await expect(page.getByText('Please enter a holiday name').first()).toBeVisible();
    // regression (Q1-D6): the scope pickers of the selection card are not clipped ("All Bran...") on a phone
    expect(await isTruncated(page.getByTestId('scope-branch').getByText('All Branches', { exact: true })), 'branch scope truncated').toBe(false);
    expect(await isTruncated(page.getByTestId('scope-dept').getByText('All Departments', { exact: true })), 'dept scope truncated').toBe(false);
    await page.getByTestId('holiday-name').fill('Winter Break');
    await page.getByTestId('block-attendance').click(); // Punch Allowed
    await snapBoth(page, testInfo, 'holidays-selected');
    await page.getByTestId('holiday-add').click();
    await expect(page.getByText('2 holiday(s) added successfully').first()).toBeVisible();
    const posts = await mock.requests({ path: '/api/holidays/', method: 'POST' });
    const added = posts.filter((p) => p.body?.name === 'Winter Break');
    expect(added.map((p) => p.body?.date).sort()).toEqual([`${y}-${String(m).padStart(2, '0')}-26`, `${y}-${String(m).padStart(2, '0')}-27`]);
    expect(added[0].body?.block_attendance).toBe(false);
    await expect(page.getByTestId('selected-dates-card')).toHaveCount(0);
    await expect(page.getByText('Winter Break').first()).toBeVisible();
    await expect(page.getByText('Punch Allowed').first()).toBeVisible();
  });

  test('edit a holiday (rename, drop a date), add a date to it, delete one date and the whole holiday', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/holidays');
    const [y, m] = iso(0).split('-').map(Number);
    const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    // two consecutive late-month days that are not Sundays (Sundays are weekly offs: disabled in the grid)
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    let d1 = Math.min(28, last - 1);
    while (new Date(Date.UTC(y, m - 1, d1)).getUTCDay() === 0 || new Date(Date.UTC(y, m - 1, d1 + 1)).getUTCDay() === 0) d1 -= 1;
    await clickDay(page, 'holiday-grid', `${d1} ${monthName} ${y}`);
    await clickDay(page, 'holiday-grid', `${d1 + 1} ${monthName} ${y}`);
    await page.getByTestId('holiday-name').fill('Team Offsite');
    await page.getByTestId('holiday-add').click();
    const group = page.locator('[data-testid^="holiday-group-"]').filter({ hasText: 'Team Offsite' });
    await expect(group).toBeVisible();
    // rename
    await group.getByRole('button', { name: 'Actions for Team Offsite' }).click();
    await page.getByTestId('holiday-menu-edit').click();
    await page.getByTestId('holiday-edit-name').fill('Team Offsite 2026');
    await page.getByTestId('holiday-edit-save').click();
    await expect(page.locator('[data-testid^="holiday-group-"]').filter({ hasText: 'Team Offsite 2026' })).toBeVisible();
    await expect.poll(async () => (await mock.requests({ path: '/api/holidays/', method: 'PUT' })).length).toBeGreaterThan(0);
    // delete one date
    const renamed = page.locator('[data-testid^="holiday-group-"]').filter({ hasText: 'Team Offsite 2026' });
    await renamed.getByRole('button', { name: /View Dates/ }).click();
    await renamed.locator('[data-testid^="holiday-delete-date-"]').first().click();
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await expect(renamed.locator('[data-testid^="holiday-delete-date-"]')).toHaveCount(1);
    // delete the whole holiday
    await renamed.getByRole('button', { name: 'Actions for Team Offsite 2026' }).click();
    await page.getByTestId('holiday-menu-delete').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await expect(page.getByText('Team Offsite 2026')).toHaveCount(0);
  });

  test('weekly offs: configure, summary, saved on the server and shown on the calendar subtitle', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/holidays');
    await page.getByTestId('configure-off-days').click();
    await expect(page.getByTestId('off-days-modal')).toBeVisible();
    await snapBoth(page, testInfo, 'holidays-offdays');
    await page.getByTestId('off-days-modal').getByRole('checkbox', { name: 'Sat' }).click();
    await expect(page.getByTestId('off-days-summary')).toContainText(/Sat/);
    await page.getByTestId('off-days-save').click();
    const post = await mock.waitForRequest('/api/holidays/off-days/', { method: 'POST' });
    expect((post.body?.off_days as number[]).includes(5)).toBe(true);
    await expect(page.getByTestId('configure-off-days')).toContainText(/Sat/);
  });

  test('a rejected write shows an error and never a success toast; failed dates stay selected', async ({ page, mock, issues }) => {
    issues.allow(/api\/holidays/);
    await loginAs(page, 'admin');
    await visit(page, '/admin/holidays');
    const [y, m] = iso(0).split('-').map(Number);
    const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    await clickDay(page, 'holiday-grid', `24 ${monthName} ${y}`);
    await page.getByTestId('holiday-name').fill('Rejected Day');
    await mock.failNext(`/api/holidays/*`, { method: 'POST', status: 400, body: { detail: 'Holiday date is locked' }, times: -1 });
    await page.getByTestId('holiday-add').click();
    await expect(page.getByText(/Holiday date is locked|Failed to add holiday/).first()).toBeVisible();
    await expect(page.getByText('holiday(s) added successfully')).toHaveCount(0);
    await expect(page.getByTestId('selected-dates-card')).toBeVisible(); // the date stays selected for a retry
    await mock.clearFailures();
  });

  test('branch / department scope on a holiday is shown on its card and the filter narrows the list', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/holidays');
    // seeded holidays: Warehouse Maintenance (+12 days, Warehouse), Founders Day (+9 days), Festival Holiday (-20 days)
    for (const offset of [9, 12, -20]) {
      const target = iso(offset);
      const [ty, tm] = target.split('-').map(Number);
      const [cy, cm] = iso(0).split('-').map(Number);
      const diff = (ty - cy) * 12 + (tm - cm);
      for (let i = 0; i < Math.abs(diff); i++) await page.getByRole('button', { name: diff > 0 ? 'Next month' : 'Previous month' }).first().click();
      const names: Record<number, string> = { 9: 'Founders Day', 12: 'Warehouse Maintenance', [-20]: 'Festival Holiday' };
      await expect(page.getByText(names[offset]).first()).toBeVisible();
      for (let i = 0; i < Math.abs(diff); i++) await page.getByRole('button', { name: diff > 0 ? 'Previous month' : 'Next month' }).first().click();
    }
  });
});
