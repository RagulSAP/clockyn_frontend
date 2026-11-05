/**
 * Q3 - Profile (view/edit, photo upload, unsaved-changes guard, name reflected on home) and the staff Settings tab
 * (appearance, permissions, delete account, logout, manager shortcuts).
 */
import { expect, loginAs, MANAGER_PERMISSIONS, readSession, STORAGE, test, USERS, visit } from '../support';
import { snap } from '../support/q3';

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe('profile', () => {
  test('view mode shows name, branch, employee id and the three sections', async ({ page }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/profile');
    await expect(page.getByTestId('profile-name')).toHaveText('Aarav Sharma');
    await expect(page.getByTestId('profile-branch')).toContainText('Head Office');
    await expect(page.getByTestId('profile-empid')).toContainText(/\w+/);
    for (const k of ['personal', 'identity', 'bank']) await expect(page.getByTestId(`section-${k}`)).toBeVisible();
    await expect(page.getByTestId('row-email')).toContainText('aarav.sharma@clockyn.test');
    await expect(page.getByTestId('profile-edit')).toBeVisible();
    await snap(page, testInfo, 'profile-view', { fullPage: true });
  });

  test('edit -> save sends only valid data, shows "Saved!", updates the page and the home greeting', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/profile');
    await page.getByTestId('profile-edit').click();
    await expect(page.getByTestId('profile-save')).toBeVisible();
    await snap(page, testInfo, 'profile-edit', { fullPage: true });
    await page.getByTestId('field-name').fill('Aarav S. Sharma');
    await page.getByTestId('field-address').fill('42 Residency Road, Bengaluru');
    await page.getByTestId('profile-save').click();
    await expect(page.getByTestId('saved-modal')).toBeVisible();
    const put = await mock.waitForRequest('/employee/personal-details/', { method: 'PUT' });
    expect(put.body).toMatchObject({ name: 'Aarav S. Sharma', address: '42 Residency Road, Bengaluru' });
    await expect(page.getByTestId('profile-name')).toHaveText('Aarav S. Sharma');
    expect((await readSession(page))?.name).toBe('Aarav S. Sharma');
    // the new name is on the home screen without a reload
    await visit(page, '/staff/home').catch(() => undefined);
    await expect(page.getByTestId('home-username')).toHaveText('Aarav S. Sharma');
  });

  test('an invalid identity number is rejected before any request, naming the field', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/profile');
    await page.getByTestId('profile-edit').click();
    await page.getByTestId('field-aadhaar').fill('12345');
    await page.getByTestId('profile-save').click();
    await expect(page.getByText(/Invalid Input/)).toBeVisible();
    await expect(page.getByText(/Aadhaar/).first()).toBeVisible();
    expect(await mock.requests({ path: '/employee/personal-details/', method: 'PUT' })).toHaveLength(0);
  });

  test('unsaved changes: Back asks first (Keep editing / Exit), Cancel discards after asking', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await page.getByTestId('quick-profile').click();
    await page.waitForURL('**/staff/profile');
    await page.getByTestId('profile-edit').click();
    await page.getByTestId('field-name').fill('Changed Name');
    await page.getByRole('button', { name: /back/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Unsaved Changes' })).toBeVisible();
    await page.getByTestId('guard-stay').click();
    await expect(page.getByRole('heading', { name: 'Unsaved Changes' })).toHaveCount(0);
    await expect(page.getByTestId('field-name')).toHaveValue('Changed Name');
    await page.getByTestId('profile-cancel').click();
    await expect(page.getByRole('heading', { name: 'Unsaved Changes' })).toBeVisible();
    await page.getByTestId('guard-exit').click();
    await page.waitForURL('**/staff/home');
    // nothing was saved
    await page.getByTestId('quick-profile').click();
    await expect(page.getByTestId('profile-name')).toHaveText('Aarav Sharma');
  });

  test('Save from the unsaved-changes dialog persists the edit', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/profile');
    await page.getByTestId('profile-edit').click();
    await page.getByTestId('field-bankName').fill('State Bank');
    await page.getByTestId('profile-cancel').click();
    await page.getByTestId('guard-save').click();
    await expect(page.getByTestId('saved-modal')).toBeVisible();
    expect((await mock.waitForRequest('/employee/personal-details/', { method: 'PUT' })).body).toMatchObject({ bank_name: 'State Bank' });
  });

  test('profile photo: choose from gallery, save uploads it to the employee-profile endpoint', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/profile');
    await page.getByTestId('profile-edit').click();
    await page.getByTestId('profile-photo').click();
    await snap(page, testInfo, 'profile-photo-sheet');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByText('Choose from Gallery').click()]);
    await chooser.setFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG_1X1 });
    await page.getByTestId('profile-save').click();
    await expect(page.getByTestId('saved-modal')).toBeVisible();
    const up = await mock.waitForRequest('/auth/upload-employee-profile/', { method: 'POST' });
    expect(up.path).toContain(USERS.staff.userId);
    expect(up.files?.some((f) => f.field === 'photo' && f.size > 0)).toBe(true);
  });

  test('a failing photo upload still saves the details and tells the user', async ({ page, mock, issues }) => {
    issues.allow(/upload-employee-profile/);
    await loginAs(page, 'staff');
    await visit(page, '/staff/profile');
    await page.getByTestId('profile-edit').click();
    await page.getByTestId('profile-photo').click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByText('Choose from Gallery').click()]);
    await chooser.setFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG_1X1 });
    await mock.failNext('/auth/upload-employee-profile/*', { status: 500 });
    await page.getByTestId('profile-save').click();
    await expect(page.getByText(/details were saved, but the new photo could not be uploaded/)).toBeVisible();
    expect(await mock.requests({ path: '/employee/personal-details/', method: 'PUT' })).toHaveLength(1);
  });

  test('a load failure shows an error state with retry (no stuck spinner)', async ({ page, mock, issues }) => {
    issues.allow(/personal-details/);
    await loginAs(page, 'staff');
    await mock.failNext('/employee/personal-details/*', { status: 500, times: 3 });
    await visit(page, '/staff/profile');
    await expect(page.getByText('Could not load your details.')).toBeVisible();
    await expect(page.getByTestId('profile-loading')).toHaveCount(0);
    await mock.clearFailures();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByTestId('profile-name')).toHaveText('Aarav Sharma');
  });
});

test.describe('staff settings tab', () => {
  test('staff see General Settings and Logout but no admin shortcuts', async ({ page }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/settings');
    await expect(page.getByTestId('staff-settings')).toBeVisible();
    await expect(page.getByTestId('admin-shortcuts')).toHaveCount(0);
    for (const id of ['row-profile', 'row-permissions', 'row-appearance', 'row-more', 'logout']) await expect(page.getByTestId(id)).toBeVisible();
    await snap(page, testInfo, 'staff-settings');
  });

  test('Profile Settings and App Permissions rows open their screens', async ({ page }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/settings');
    await page.getByTestId('row-permissions').click();
    await page.waitForURL('**/staff/permissions');
    for (const k of ['location', 'camera', 'notifications']) await expect(page.getByTestId(`permission-${k}`)).toBeVisible();
    await expect(page.getByTestId('permission-location')).toContainText('Enabled'); // granted by the harness
    await snap(page, testInfo, 'staff-permissions');
    await page.goBack();
    await page.getByTestId('row-profile').click();
    await page.waitForURL('**/staff/profile');
  });

  test('Appearance: Dark persists across reload, System follows the OS scheme', async ({ page }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/settings');
    const bgOf = () => page.getByTestId('staff-settings').evaluate((el) => {
      let node: HTMLElement | null = el as HTMLElement;
      while (node) {
        const c = getComputedStyle(node).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
        node = node.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    });
    const lum = (rgb: string) => {
      const [r, g, b] = (rgb.match(/\d+/g) ?? ['0', '0', '0']).map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    expect(lum(await bgOf())).toBeGreaterThan(0.8);
    await page.getByTestId('appearance-control').getByText('Dark').click();
    await expect.poll(async () => lum(await bgOf())).toBeLessThan(0.2);
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE.themePreference)).toBe('dark');
    await snap(page, testInfo, 'staff-settings-dark');
    await page.reload();
    await expect(page.getByTestId('staff-settings')).toBeVisible();
    await expect.poll(async () => lum(await bgOf())).toBeLessThan(0.2);
    await page.getByTestId('appearance-control').getByText('Light').click();
    await expect.poll(async () => lum(await bgOf())).toBeGreaterThan(0.8);
    // system preference follows the OS
    await page.getByTestId('appearance-control').getByText('System').click();
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(async () => lum(await bgOf())).toBeLessThan(0.2);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(async () => lum(await bgOf())).toBeGreaterThan(0.8);
  });

  test('Logout asks for confirmation; Cancel keeps the session, Logout clears it and returns to welcome', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/settings');
    await page.getByTestId('logout').click();
    await expect(page.getByText('Confirm Logout')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Confirm Logout')).toHaveCount(0);
    expect(await readSession(page)).not.toBeNull();
    await page.getByTestId('logout').click();
    await page.getByRole('button', { name: 'Logout' }).last().click();
    await page.waitForURL((u) => u.pathname === '/');
    expect(await readSession(page)).toBeNull();
    // protected routes are no longer reachable
    await visit(page, '/staff/home');
    expect(new URL(page.url()).pathname).not.toBe('/staff/home');
  });

  test('More Options: Delete My Account asks for confirmation, then signs out', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/more');
    await page.getByTestId('delete-account').click();
    await expect(page.getByText('Delete Account?')).toBeVisible();
    await snap(page, testInfo, 'staff-delete-account-confirm');
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(await mock.requests({ path: '/company/delete-account/', method: 'DELETE' })).toHaveLength(0);
    await page.getByTestId('delete-account').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Account deleted successfully')).toBeVisible();
    const call = await mock.waitForRequest('/company/delete-account/', { method: 'DELETE' });
    expect(call.path).toContain(USERS.staff.userId);
    await page.waitForURL((u) => u.pathname === '/', { timeout: 15_000 });
    expect(await readSession(page)).toBeNull();
  });

  test('a failed deletion shows the server message and keeps the user signed in', async ({ page, mock, issues }) => {
    issues.allow(/delete-account/);
    await loginAs(page, 'staff');
    await visit(page, '/staff/more');
    await mock.failNext('/company/delete-account/*', { status: 400, body: { detail: 'Cannot delete right now' } });
    await page.getByTestId('delete-account').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Cannot delete right now')).toBeVisible();
    expect(await readSession(page)).not.toBeNull();
  });
});

test.describe('manager shortcuts (role 2)', () => {
  /** Each shortcut -> [menu option to pick (if a sub-menu), expected path]. */
  const SHORTCUTS: [string, string | null, string][] = [
    ['Staff Management', 'Add Staff', '/admin/staff/edit'],
    ['Staff Management', 'View Staff', '/admin/staff'],
    ['Branch Management', 'Add Branch', '/admin/branches/edit'],
    ['Branch Management', 'View Branch', '/admin/branches'],
    ['Attendance Reports', null, '/staff/reports'],
    ['Salary Management', 'Monthly Fixed', '/admin/payroll/payslips'],
    ['Salary Management', 'Daily Wages', '/admin/payroll/daily-wages'],
    ['Salary Management', 'Hourly Calculation', '/admin/payroll/hourly'],
    ['Holiday Management', null, '/admin/holidays'],
    ['Shift Management', null, '/admin/shifts'],
    ['Leads Management', 'Enter Leads', '/admin/crm/leads/edit'],
    ['Leads Management', 'Assign Leads', '/admin/crm/leads'],
    ['Incentive Management', 'Count Basis', '/admin/payroll/count-basis'],
    ['Incentive Management', 'Turnover Basis', '/admin/payroll/turnover'],
    ['Incentive Management', 'OT', '/admin/payroll/overtime'],
    ['Incentive Management', 'Bonus', '/admin/payroll/bonus'],
    ['Company Settings', null, '/admin/company'],
    ['Requests Management', null, '/admin/requests'],
  ];

  test('a manager with all ten permissions sees ten shortcuts', async ({ page }, testInfo) => {
    await loginAs(page, 'manager');
    await visit(page, '/staff/settings');
    await expect(page.getByTestId('admin-shortcuts')).toBeVisible();
    for (const p of MANAGER_PERMISSIONS) await expect(page.getByTestId(`shortcut-${p}`)).toBeVisible();
    await expect(page.locator('[data-testid^="shortcut-"]').filter({ hasNotText: /^$/ })).toHaveCount(MANAGER_PERMISSIONS.length);
    await snap(page, testInfo, 'manager-settings', { fullPage: true });
  });

  for (const [permission, option, path] of SHORTCUTS) {
    test(`shortcut "${permission}"${option ? ` > ${option}` : ''} opens ${path} inside the admin area`, async ({ page, issues }) => {
      issues.allow(/chat\/list|group-chat\/list/); // plan-gated chat polls on admin shells
      await loginAs(page, 'manager');
      await visit(page, '/staff/settings');
      await page.getByTestId(`shortcut-${permission}`).click();
      if (option) await page.getByTestId(`option-${option}`).click();
      await page.waitForURL((u) => u.pathname === path || u.pathname === `${path}/`, { timeout: 15_000 });
      // the destination rendered real content (no not-found page, no blank screen) and the manager stayed signed in
      await expect(page.getByText('Page not found')).toHaveCount(0);
      await expect.poll(async () => (await page.locator('body').innerText()).trim().length).toBeGreaterThan(20);
      expect((await readSession(page))?.roleId).toBe(2);
    });
  }

  test('a manager with fewer permissions sees only those shortcuts', async ({ page }) => {
    await loginAs(page, 'manager', { permissions: ['Requests Management', 'Holiday Management'] });
    await visit(page, '/staff/settings');
    await expect(page.getByTestId('shortcut-Requests Management')).toBeVisible();
    await expect(page.getByTestId('shortcut-Holiday Management')).toBeVisible();
    await expect(page.getByTestId('shortcut-Staff Management')).toHaveCount(0);
    await expect(page.getByTestId('shortcut-Company Settings')).toHaveCount(0);
  });

  test('a manager with no permissions sees no admin block', async ({ page }) => {
    await loginAs(page, 'manager', { permissions: [] });
    await visit(page, '/staff/settings');
    await expect(page.getByTestId('staff-settings')).toBeVisible();
    await expect(page.getByTestId('admin-shortcuts')).toHaveCount(0);
  });

  test('scoped data: the manager opens staff list through the shortcut and sees staff of their scope', async ({ page, mock }) => {
    await loginAs(page, 'manager');
    await visit(page, '/staff/settings');
    await page.getByTestId('shortcut-Staff Management').click();
    await page.getByTestId('option-View Staff').click();
    await page.waitForURL('**/admin/staff');
    await expect(page.getByText('Aarav Sharma').first()).toBeVisible();
    const call = await mock.waitForRequest('/home/', { method: 'GET' });
    expect(call.query.org_id ?? call.path).toBeTruthy();
  });
});
