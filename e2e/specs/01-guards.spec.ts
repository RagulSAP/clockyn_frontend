/**
 * Route guards, root redirects and the single-device session watcher (forced logout).
 * Rules under test: src/lib/routeGuard.ts, src/components/layout/RoleGuard.tsx, bootstrap/sessionWatch.ts.
 */
import { currentPath, expect, loginAs, logoutViaUi, readSession, test, USERS, visit, waitForAppReady } from '../support';

const pathname = (url: string): string => new URL(url).pathname;

test.describe('signed-out visitor', () => {
  for (const p of ['/admin/home', '/admin/staff', '/admin/payroll/payslips', '/admin/billing', '/staff/home', '/staff/requests/leave', '/staff/attendance']) {
    test(`deep link ${p} lands on the welcome screen`, async ({ page }) => {
      expect(await visit(page, p)).toBe('/');
      await expect(page.getByTestId('welcome-card')).toBeVisible();
      await expect(page.getByText('Get Started')).toBeVisible();
    });
  }

  test('welcome offers both portals', async ({ page }) => {
    await visit(page, '/');
    await expect(page.getByTestId('portal-admin')).toBeVisible();
    await expect(page.getByTestId('portal-staff')).toBeVisible();
  });
});

test.describe('staff session', () => {
  for (const p of ['/admin/home', '/admin/staff', '/admin/payroll/payslips', '/admin/reports', '/admin/billing']) {
    test(`/admin area ${p} redirects to the staff home`, async ({ page }) => {
      await loginAs(page, 'staff');
      expect(await visit(page, p)).toBe('/staff/home');
    });
  }

  test('field staff are guarded the same way', async ({ page }) => {
    await loginAs(page, 'fieldStaff');
    expect(await visit(page, '/admin/staff')).toBe('/staff/home');
  });

  test('own area is reachable', async ({ page }) => {
    await loginAs(page, 'staff');
    expect(await visit(page, '/staff/requests')).toBe('/staff/requests');
  });
});

test.describe('manager session', () => {
  for (const p of ['/admin/staff', '/admin/branches', '/admin/payroll/payslips', '/admin/shifts']) {
    test(`manager is allowed on ${p}`, async ({ page }) => {
      await loginAs(page, 'manager');
      expect(await visit(page, p)).toBe(p);
    });
  }

  test('manager also owns the /staff area', async ({ page }) => {
    await loginAs(page, 'manager');
    expect(await visit(page, '/staff/home')).toBe('/staff/home');
  });
});

test.describe('admin session', () => {
  for (const p of ['/staff/home', '/staff/requests/leave', '/staff/attendance', '/staff/profile']) {
    test(`/staff area ${p} redirects to the admin home`, async ({ page }) => {
      await loginAs(page, 'admin');
      expect(await visit(page, p)).toBe('/admin/home');
    });
  }
});

test.describe('root redirect and unknown routes', () => {
  test('signed-in admin at / goes to /admin/home', async ({ page }) => {
    await loginAs(page, 'admin');
    expect(await visit(page, '/')).toBe('/admin/home');
  });

  test('signed-in staff at / goes to /staff/home', async ({ page }) => {
    await loginAs(page, 'staff');
    expect(await visit(page, '/')).toBe('/staff/home');
  });

  test('unknown route shows the not-found screen with a way home', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/definitely/not/a/route');
    await expect(page.getByText('Page not found', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Go to home' }).click();
    await expect.poll(() => pathname(page.url())).toBe('/admin/home');
  });
});

test.describe('forced logout (session watcher)', () => {
  test('check-session force_logout signs the staff user out and explains why', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await mock.forceLogout([USERS.staff.userId]);
    await page.goto('/staff/home');
    await waitForAppReady(page, { idle: false });

    await expect.poll(() => pathname(page.url()), { timeout: 15_000 }).toBe('/');
    await expect(page.getByTestId('signout-notice')).toContainText('another device');
    expect(await readSession(page)).toBeNull();

    const call = await mock.waitForRequest('/requests/check-session/');
    expect(call.path).toBe(`/requests/check-session/${USERS.staff.userId}`);
    expect(call.query.device_token).toBe(USERS.staff.deviceToken);
  });

  test('guarded screens stay out of reach after a forced logout', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await mock.forceLogout([USERS.staff.userId]);
    await page.goto('/staff/home');
    await expect.poll(() => pathname(page.url()), { timeout: 15_000 }).toBe('/');
    expect(await visit(page, '/staff/requests')).toBe('/');
  });

  test('another device taking over the account forces this one out', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await mock.takeOverDevice(USERS.staff.mobile);
    await page.goto('/staff/home');
    await expect.poll(() => pathname(page.url()), { timeout: 15_000 }).toBe('/');
    await expect(page.getByTestId('signout-notice')).toBeVisible();
  });

  test('manager sessions are watched too', async ({ page, mock }) => {
    await loginAs(page, 'manager');
    await mock.forceLogout([USERS.manager.userId]);
    await page.goto('/staff/home');
    await expect.poll(() => pathname(page.url()), { timeout: 15_000 }).toBe('/');
  });

  test('grace window: no check right after a fresh login', async ({ page, mock }) => {
    await loginAs(page, 'staff', { freshLogin: true });
    await mock.forceLogout([USERS.staff.userId]);
    await visit(page, '/staff/home');
    await page.waitForTimeout(2_500);
    expect(currentPath(page)).toBe('/staff/home');
    expect(await mock.requests({ path: '/requests/check-session/' })).toHaveLength(0);
    expect(await readSession(page)).not.toBeNull();
  });

  test('fails open: a server error from check-session never signs the user out', async ({ page, mock, issues }) => {
    issues.allow(/check-session/);
    await loginAs(page, 'staff');
    await mock.failNext('/requests/check-session/*', { status: 500, times: -1 });
    await visit(page, '/staff/home');
    await mock.waitForRequest('/requests/check-session/');
    await page.waitForTimeout(1_000);
    expect(currentPath(page)).toBe('/staff/home');
    expect(await readSession(page)).not.toBeNull();
  });

  test('admins have no device session: check-session is never polled', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await mock.forceLogout([USERS.admin.userId]);
    await visit(page, '/admin/home');
    await page.waitForTimeout(2_000);
    expect(currentPath(page)).toBe('/admin/home');
    expect(await mock.requests({ path: '/requests/check-session/' })).toHaveLength(0);
  });

  test('a healthy staff session polls check-session with its device token and stays signed in', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    const call = await mock.waitForRequest('/requests/check-session/');
    expect(call.query.device_token).toBe(USERS.staff.deviceToken);
    expect(currentPath(page)).toBe('/staff/home');
  });
});

test.describe('sign-out from the UI', () => {
  for (const role of ['admin', 'staff'] as const) {
    test(`${role}: logging out returns to the welcome screen and clears the persisted session`, async ({ page }) => {
      await loginAs(page, role);
      await visit(page, role === 'admin' ? '/admin/home' : '/staff/home');
      await logoutViaUi(page, role);
      await expect.poll(() => pathname(page.url()), { timeout: 15_000 }).toBe('/');
      expect(await readSession(page)).toBeNull();
    });
  }
});
