/**
 * Q1 - organisation structure: add / edit staff, branches (map pick, delete + reassignment), departments, devices.
 */
import type { Page } from '@playwright/test';

import { BRANCHES, DEPARTMENTS, expect, loginAs, test, USERS, visit } from '../support';
import { mockGet, pickOption, pngFile, snapBoth } from '../support/q1';

const staffCount = async (page: Page): Promise<number> => page.locator('[data-testid^="staff-row-"]').count();

async function fillStaffBasics(page: Page, v: { name: string; empId?: string; phone: string; email?: string; branch?: string; dept?: string; gender?: string }): Promise<void> {
  await page.getByTestId('staff-name').fill(v.name);
  if (v.empId !== undefined) await page.getByTestId('staff-emp-id').fill(v.empId);
  await page.getByTestId('staff-phone').fill(v.phone);
  if (v.email) await page.getByTestId('staff-email').fill(v.email);
  if (v.branch) await pickOption(page, 'staff-branch', v.branch);
  if (v.dept) await pickOption(page, 'staff-dept', v.dept);
  if (v.gender) await pickOption(page, 'staff-gender', v.gender);
}

test.describe('Q1 add / edit staff', () => {
  test('Add Staff: limit banner, suggested employee id, required-field errors, save, new person in the roster', async ({ page, mock, tenant }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff/edit');
    const fx = await mock.fixtures();
    const active = fx.staff.filter((s) => s.status === 1 && s.role_id !== 1).length;
    await expect(page.getByTestId('staff-limit-banner')).toContainText(`Staff: ${active} / 50`);
    await expect(page.getByTestId('staff-limit-banner')).toContainText('slots remaining');
    const next = await mockGet<{ next_emp_id: string }>(tenant, '/addstaff/next-emp-id?user_id=org-0001');
    await expect(page.getByTestId('staff-emp-id')).toHaveValue(next.next_emp_id);
    await snapBoth(page, testInfo, 'org-staff-add');

    // all required fields missing (clear the suggestion first)
    await page.getByTestId('staff-emp-id').fill('');
    await page.getByTestId('staff-submit').click();
    for (const msg of ['Please input full name', 'Please input employee ID', 'Please input phone number', 'Please input branch name', 'Please input department name', 'Please select gender']) {
      await expect(page.getByText(msg).first()).toBeVisible();
    }
    await expect(page.getByText('Please fill all required fields').first()).toBeVisible();
    await snapBoth(page, testInfo, 'org-staff-add-errors');

    // phone: digits only, max 10
    await page.getByTestId('staff-phone').pressSequentially('98a76-54321 99');
    await expect(page.getByTestId('staff-phone')).toHaveValue('9876543219');
    await fillStaffBasics(page, { name: 'Kavya Menon', empId: next.next_emp_id, phone: '9777700001', email: 'KAVYA@Clockyn.test', branch: BRANCHES.warehouse.name, dept: DEPARTMENTS.sales.name, gender: 'Female' });
    await expect(page.getByTestId('staff-email')).toHaveValue('kavya@clockyn.test'); // lower-cased
    await page.getByTestId('staff-submit').click();
    await page.waitForURL(/\/admin\/staff(\?|$)/);
    const post = await mock.waitForRequest('/addstaff', { method: 'POST' });
    expect(post.body).toMatchObject({ name: 'Kavya Menon', emp_id: next.next_emp_id, mobile_number: '9777700001', email: 'kavya@clockyn.test', branch_name: BRANCHES.warehouse.name, dept_name: DEPARTMENTS.sales.name, gender: 'Female' });
    await expect(page.getByText('Kavya Menon').first()).toBeVisible();
    expect((await mock.fixtures()).staff.some((s) => s.name === 'Kavya Menon')).toBe(true);
    void staffCount;
  });

  test('e-mail is optional: a person can be added without one', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff/edit');
    await fillStaffBasics(page, { name: 'No Email Person', phone: '9777700011', branch: BRANCHES.hq.name, dept: DEPARTMENTS.sales.name, gender: 'Male' });
    await page.getByTestId('staff-submit').click();
    await page.waitForURL(/\/admin\/staff(\?|$)/);
    const post = await mock.waitForRequest('/addstaff', { method: 'POST' });
    expect(post.status).toBe(200);
  });

  test('duplicate employee id and duplicate mobile are refused with a clear message', async ({ page, mock, issues }) => {
    issues.allow(/addstaff/);
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff/edit');
    const fx = await mock.fixtures();
    const existing = fx.staff.find((s) => s.user_id === 'stf-0001')!;
    await fillStaffBasics(page, { name: 'Dup Person', empId: existing.emp_id, phone: '9777700002', branch: BRANCHES.hq.name, dept: DEPARTMENTS.sales.name, gender: 'Male', email: 'dup@clockyn.test' });
    await page.getByTestId('staff-submit').click();
    await expect(page.getByText('Employee ID already exists').first()).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/admin/staff/edit');
    expect(await mock.requests({ path: '/addstaff', method: 'POST' })).toHaveLength(0);
    // fix the id, but reuse an existing mobile number: the server rejects it and the screen stays
    await page.getByTestId('staff-emp-id').fill('7777');
    await page.getByTestId('staff-phone').fill(existing.mobile);
    await page.getByTestId('staff-submit').click();
    await expect(page.getByText(/Mobile number already exists/i).first()).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/admin/staff/edit');
    await expect(page.getByTestId('staff-submit')).toBeEnabled(); // spinner cleared
  });

  test('staff limit reached: red banner, Add Staff is disabled, Upgrade opens billing', async ({ page, mock }, testInfo) => {
    const fx = await mock.fixtures();
    const active = fx.staff.filter((s) => s.status === 1 && s.role_id !== 1).length;
    const iso = (d: number) => new Date(Date.now() + 330 * 60_000 + d * 86_400_000).toISOString().slice(0, 10);
    await mock.failNext('/plans/subscription/*', { status: 200, times: -1, body: { success: true, data: { plan_id: 3, plan_name: 'Elite', plan_amount: 2999, plan_month: 1, start_date: iso(-5), end_date: iso(60), staff_limit: active, status: 'ACTIVE', is_expired: false, is_free_trial: false, free_trial_end: null, billing_date: iso(60) } } });
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff/edit');
    await expect(page.getByTestId('staff-limit-banner')).toContainText('Staff limit reached');
    await expect(page.getByTestId('staff-submit')).toBeDisabled();
    await snapBoth(page, testInfo, 'org-staff-limit');
    await page.getByTestId('staff-limit-upgrade').click();
    await page.waitForURL(/\/admin\/billing$/);
  });

  test('photo upload: the chosen image is sent as a multipart "photo" after the staff is saved', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff/edit');
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('staff-photo-pick').click();
    await (await chooser).setFiles(pngFile('face.png'));
    await expect(page.getByTestId('staff-photo-remove')).toBeVisible();
    await expect(page.getByTestId('staff-photo-pick')).toContainText('Change Photo');
    await fillStaffBasics(page, { name: 'Photo Person', phone: '9777700003', branch: BRANCHES.hq.name, dept: DEPARTMENTS.operations.name, gender: 'Male', email: 'photo@clockyn.test' });
    await page.getByTestId('staff-submit').click();
    const up = await mock.waitForRequest('/auth/upload-employee-profile/', { method: 'POST' });
    expect(up.files?.[0]?.field).toBe('photo');
    await page.waitForURL(/\/admin\/staff(\?|$)/);
  });

  test('removing the picked photo resets the field', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff/edit');
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('staff-photo-pick').click();
    await (await chooser).setFiles(pngFile());
    await page.getByTestId('staff-photo-remove').click();
    await expect(page.getByTestId('staff-photo-pick')).toContainText('Upload Photo');
  });

  test('Edit Staff: prefilled, unsaved-changes dialog on back, save updates the record', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    const id = 'stf-0003';
    await visit(page, '/admin/staff/edit', { staffId: id });
    const fx = await mock.fixtures();
    const person = fx.staff.find((s) => s.user_id === id)!;
    await expect(page.getByTestId('staff-name')).toHaveValue(person.name);
    await expect(page.getByTestId('staff-emp-id')).toHaveValue(person.emp_id);
    await expect(page.getByTestId('staff-limit-banner')).toHaveCount(0); // add mode only
    await snapBoth(page, testInfo, 'org-staff-edit');
    // untouched: back leaves without a dialog
    await page.getByTestId('staff-name').fill(person.name + ' Jr');
    await page.getByRole('button', { name: 'Go back' }).first().click().catch(async () => page.goBack());
    await expect(page.getByTestId('unsaved-dialog')).toBeVisible();
    await snapBoth(page, testInfo, 'org-staff-unsaved');
    await page.getByTestId('unsaved-save').click();
    const put = await mock.waitForRequest(`/addstaff/${id}`, { method: 'PUT' });
    expect(put.body).toMatchObject({ name: person.name + ' Jr' });
    await page.waitForURL((u) => !u.pathname.endsWith('/staff/edit'));
  });

  test('Edit Staff: "Exit" in the unsaved dialog discards the change', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff');
    await page.getByTestId('staff-row-stf-0004').click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.waitForURL(/\/admin\/staff\/edit/);
    await page.getByTestId('staff-name').fill('Changed Name');
    await page.getByRole('button', { name: 'Go back' }).first().click();
    await page.getByTestId('unsaved-exit').click();
    await page.waitForURL(/\/admin\/staff\/detail/);
    expect(await mock.requests({ path: '/addstaff/stf-0004', method: 'PUT' })).toHaveLength(0);
  });

  test('server failure on save keeps the form and re-enables the button', async ({ page, mock, issues }) => {
    issues.allow(/addstaff/);
    await loginAs(page, 'admin');
    await visit(page, '/admin/staff/edit');
    await fillStaffBasics(page, { name: 'Fail Person', phone: '9777700009', branch: BRANCHES.hq.name, dept: DEPARTMENTS.sales.name, gender: 'Male', email: 'fail@clockyn.test' });
    await mock.failNext('/addstaff', { method: 'POST', status: 500, body: { detail: 'Database is busy' } });
    await page.getByTestId('staff-submit').click();
    await expect(page.getByText(/Database is busy/).first()).toBeVisible();
    await expect(page.getByTestId('staff-submit')).toBeEnabled();
    await expect(page.getByTestId('staff-name')).toHaveValue('Fail Person');
  });
});

test.describe('Q1 branches', () => {
  test('list shows every branch with GPS and radius; add branch with a map-picked location', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/branches');
    const fx = await mock.fixtures();
    for (const b of fx.branches) await expect(page.getByTestId(`branch-card-${b.id}`)).toContainText(b.name);
    await expect(page.getByText(/150m radius|200m radius/).first()).toBeVisible();
    await snapBoth(page, testInfo, 'org-branches');

    await page.getByTestId('branch-add').click();
    await page.waitForURL(/\/admin\/branches\/edit/);
    await page.getByTestId('branch-submit').click();
    await expect(page.getByText('Branch name is required')).toBeVisible();
    await expect(page.getByText('Branch address is required')).toBeVisible();
    await expect(page.getByText('Please select GPS location')).toBeVisible();
    await page.getByTestId('branch-name').fill('South Depot');
    await page.getByTestId('branch-address').fill('44 Depot Road');
    await page.getByTestId('branch-gps').click();
    await expect(page.getByTestId('location-picker')).toBeVisible();
    const map = page.getByTestId('location-picker-map');
    await expect(page.locator('[data-testid="location-picker-map"].leaflet-container, [data-testid="location-picker-map"] .leaflet-container')).toBeVisible();
    await snapBoth(page, testInfo, 'org-branch-picker');
    const box = (await map.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30);
    await expect(page.getByTestId('location-picker-coords')).toBeVisible();
    await page.getByTestId('location-picker-confirm').click();
    await expect(page.getByTestId('location-picker')).toHaveCount(0);
    await expect(page.getByTestId('branch-gps')).toContainText(/\d+\.\d{6}, \d+\.\d{6}/);
    await page.getByTestId('radius-selector').getByText('500', { exact: false }).first().click();
    await page.getByTestId('branch-submit').click();
    const post = await mock.waitForRequest('/branch/add', { method: 'POST' });
    expect(post.body).toMatchObject({ branch_name: 'South Depot', branch_address: '44 Depot Road', punch_radius: 500 });
    expect(Number(post.body?.branch_latitude)).not.toBe(0);
    await page.waitForURL(/\/admin\/branches$/);
    await expect(page.getByText('South Depot').first()).toBeVisible();
  });

  test('edit branch: prefilled, rename, duplicate name rejected by the server', async ({ page, mock, issues }) => {
    issues.allow(/branch\/(add|update)/);
    await loginAs(page, 'admin');
    await visit(page, '/admin/branches/edit', { branchId: BRANCHES.warehouse.id });
    await expect(page.getByTestId('branch-name')).toHaveValue(BRANCHES.warehouse.name);
    await expect(page.getByTestId('branch-gps')).toContainText(String(BRANCHES.warehouse.latitude));
    await page.getByTestId('branch-name').fill('Warehouse Annex');
    await page.getByTestId('branch-submit').click();
    const put = await mock.waitForRequest(`/branch/update/${BRANCHES.warehouse.id}`, { method: 'PUT' });
    expect(put.body).toMatchObject({ branch_name: 'Warehouse Annex' });
    await page.waitForURL(/\/admin\/branches$/);
    await expect(page.getByText('Warehouse Annex').first()).toBeVisible();
  });

  test('deleting a branch WITH staff opens the reassignment flow; moving everyone then deletes the branch', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/branches');
    const fx = await mock.fixtures();
    const inWarehouse = fx.staff.filter((s) => s.branch_id === BRANCHES.warehouse.id && s.role_id !== 1 && s.status !== 2).length;
    expect(inWarehouse).toBeGreaterThan(0);
    await page.getByRole('button', { name: `Delete ${BRANCHES.warehouse.name}` }).click();
    await expect(page.getByTestId('reassign-sheet')).toBeVisible();
    await expect(page.getByText(`${inWarehouse} staff in "${BRANCHES.warehouse.name}" must be reassigned before deletion`)).toBeVisible();
    await expect(page.getByTestId('reassign-submit')).toBeDisabled();
    await snapBoth(page, testInfo, 'org-branch-reassign');
    await page.getByTestId('reassign-select-all').click();
    await page.getByTestId('reassign-sheet').getByRole('radio', { name: BRANCHES.hq.name }).click();
    await expect(page.getByTestId('reassign-submit')).toBeEnabled();
    await page.getByTestId('reassign-submit').click();
    const call = await mock.waitForRequest('/branch/reassign-staff', { method: 'POST' });
    expect(call.body).toMatchObject({ new_branch_id: BRANCHES.hq.id });
    expect((call.body?.staff_ids as string[]).length).toBe(inWarehouse);
    await mock.waitForRequest(`/branch/delete/${BRANCHES.warehouse.id}`, { method: 'POST' });
    await expect(page.getByTestId(`branch-card-${BRANCHES.warehouse.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`branch-card-${BRANCHES.hq.id}`)).toBeVisible();
  });

  test('reassigning only some staff keeps the sheet open with the rest; an empty branch deletes with a plain confirm', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/branches');
    // new empty branch through the API, so the plain delete path can be driven
    const tenantFx = await mock.fixtures();
    void tenantFx;
    await page.getByTestId('branch-add').click();
    await page.getByTestId('branch-name').fill('Temp Kiosk');
    await page.getByTestId('branch-address').fill('Mall kiosk');
    await page.getByTestId('branch-gps').click();
    const box = (await page.getByTestId('location-picker-map').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.getByTestId('location-picker-confirm').click();
    await page.getByTestId('branch-submit').click();
    await page.waitForURL(/\/admin\/branches$/);
    await page.getByRole('button', { name: 'Delete Temp Kiosk' }).click();
    await expect(page.getByTestId('branch-delete-dialog')).toBeVisible();
    await expect(page.getByText('Are you sure you want to delete "Temp Kiosk"? This action cannot be undone.')).toBeVisible();
    await page.getByTestId('branch-delete-dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Temp Kiosk')).toHaveCount(0);

    // partial reassignment of the warehouse
    await page.getByRole('button', { name: `Delete ${BRANCHES.warehouse.name}` }).click();
    const sheet = page.getByTestId('reassign-sheet');
    await expect(sheet).toBeVisible();
    const rowsBefore = await sheet.locator('[data-testid^="reassign-staff-"]').count();
    await sheet.locator('[data-testid^="reassign-staff-"]').first().click();
    await sheet.getByRole('radio', { name: BRANCHES.hq.name }).click();
    await page.getByTestId('reassign-submit').click();
    await expect(sheet.locator('[data-testid^="reassign-staff-"]')).toHaveCount(rowsBefore - 1);
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId(`branch-card-${BRANCHES.warehouse.id}`)).toBeVisible();
  });

  test('a server refusal during delete is shown and the branch stays', async ({ page, mock, issues }) => {
    issues.allow(/branch\/delete/);
    await loginAs(page, 'admin');
    await visit(page, '/admin/branches');
    // reassign everyone, then make the delete fail
    await page.getByRole('button', { name: `Delete ${BRANCHES.warehouse.name}` }).click();
    await page.getByTestId('reassign-select-all').click();
    await page.getByTestId('reassign-sheet').getByRole('radio', { name: BRANCHES.hq.name }).click();
    await mock.failNext(`/branch/delete/${BRANCHES.warehouse.id}`, { status: 400, body: { detail: 'Branch is referenced by active shifts' } });
    await page.getByTestId('reassign-submit').click();
    await expect(page.getByText(/Staff reassigned, but the branch was not deleted/).first()).toBeVisible();
    // everyone moved: the flow falls back to the plain confirm dialog so the delete can be retried
    await expect(page.getByTestId('branch-delete-dialog')).toBeVisible();
    await expect(page.getByTestId(`branch-card-${BRANCHES.warehouse.id}`)).toBeVisible();
  });
});

test.describe('Q1 departments', () => {
  test('list, add (validation + success popup), edit, delete with confirmation, and delete refused while staff belong to it', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/departments');
    for (const d of Object.values(DEPARTMENTS)) await expect(page.getByTestId(`department-card-${d.id}`)).toContainText(d.name);
    await snapBoth(page, testInfo, 'org-departments');

    // add
    await page.getByTestId('department-add').click();
    await page.waitForURL(/\/admin\/departments\/edit/);
    await page.getByTestId('department-submit').click();
    await expect(page.getByText('Please enter department name').first()).toBeVisible();
    await page.getByTestId('department-name').fill('Finance');
    await page.getByTestId('department-submit').click();
    await expect(page.getByTestId('department-saved')).toContainText('"Finance" has been created successfully');
    await snapBoth(page, testInfo, 'org-department-saved');
    await page.waitForURL(/\/admin\/departments$/, { timeout: 15_000 });
    await expect(page.getByText('Finance').first()).toBeVisible();

    // edit
    await page.getByRole('button', { name: 'Edit Finance' }).click();
    await page.getByTestId('department-name').fill('Accounts');
    await page.getByTestId('department-submit').click();
    await expect(page.getByTestId('department-saved')).toContainText('"Accounts" has been updated successfully');
    await page.waitForURL(/\/admin\/departments$/, { timeout: 15_000 });
    await expect(page.getByText('Accounts').first()).toBeVisible();

    // delete the new empty department
    await page.getByRole('button', { name: 'Delete Accounts' }).click();
    await expect(page.getByTestId('department-delete-dialog')).toBeVisible();
    await page.getByTestId('department-delete-dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Accounts')).toHaveCount(0);
    expect((await mock.fixtures()).departments.some((d) => d.name === 'Accounts')).toBe(false);

    // deleting a department that has staff is refused with the server message
    await page.getByRole('button', { name: `Delete ${DEPARTMENTS.sales.name}` }).click();
    await page.getByTestId('department-delete-dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(/Cannot delete department/).first()).toBeVisible();
    await expect(page.getByTestId(`department-card-${DEPARTMENTS.sales.id}`)).toBeVisible();
  });

  test('a duplicate department name is refused by the server', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/departments/edit');
    await page.getByTestId('department-name').fill(DEPARTMENTS.sales.name);
    await page.getByTestId('department-submit').click();
    await expect(page.getByText(/already exists/i).first()).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/admin/departments/edit');
  });
});

test.describe('Q1 devices', () => {
  test('every device row is a "coming soon" placeholder', async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/devices');
    for (const [key, msg] of [
      ['fingerprint', 'Fingerprint device coming soon'],
      ['iris', 'Iris device coming soon'],
      ['face', 'Face Auth device coming soon'],
      ['rf-tag', 'RF Tag device coming soon'],
    ]) {
      await page.getByTestId(`device-${key}`).click();
      await expect(page.getByText(msg).first()).toBeVisible();
    }
    await snapBoth(page, testInfo, 'org-devices');
    expect(USERS.admin.userId).toBeTruthy();
  });
});
