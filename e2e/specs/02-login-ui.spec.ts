/**
 * Login through the real UI (welcome -> portal -> mobile -> OTP) against the mock backend: validates the
 * `loginViaUi` helper and the contract the OTP flow relies on (123456 accepted, device token persisted, portal
 * checks, error messages).
 */
import { expect, expectToast, loginViaUi, OTP, readSession, seedStorage, STORAGE, test, USERS, visit } from '../support';

test.describe('UI login', () => {
  test('admin signs in with mobile + OTP and lands on the admin home', async ({ page, mock }) => {
    await loginViaUi(page, 'admin');
    expect(new URL(page.url()).pathname).toBe('/admin/home');
    const session = await readSession(page);
    expect(session).toMatchObject({ userId: USERS.admin.userId, roleId: 1, orgName: 'Acme Traders' });
    // the mock issued a trusted-device token and the app stored it for this mobile
    const token = await page.evaluate((k) => window.localStorage.getItem(k), `${STORAGE.deviceToken}:${USERS.admin.mobile}`);
    expect(token).toBeTruthy();
    expect((await mock.requests({ path: '/auth/validate-otp' }))[0].body).toMatchObject({ contact: USERS.admin.mobile, otp_code: OTP, purpose: 'login' });
  });

  test('staff signs in via Employee Access and the session carries the device token', async ({ page }) => {
    await loginViaUi(page, 'staff');
    expect(new URL(page.url()).pathname).toBe('/staff/home');
    const session = await readSession(page);
    expect(session).toMatchObject({ userId: USERS.staff.userId, roleId: 3 });
    expect(session?.deviceToken).toBeTruthy();
  });

  test('manager signs in via Employee Access and receives permissions', async ({ page }) => {
    await loginViaUi(page, 'manager');
    expect(new URL(page.url()).pathname).toBe('/staff/home');
    const session = await readSession(page);
    expect(session).toMatchObject({ userId: USERS.manager.userId, roleId: 2 });
    expect(session?.managerPermissions).toHaveLength(10);
  });

  test('a returning trusted device skips the OTP', async ({ page }) => {
    // the mock accepts this token for the staff user (single active device)
    await seedStorage(page, { [`${STORAGE.deviceToken}:${USERS.staff.mobile}`]: USERS.staff.deviceToken as string });
    await visit(page, '/staff-login');
    await page.getByTestId('mobile-input').fill(USERS.staff.mobile);
    await expect(page.getByTestId('login-action')).toHaveText(/Continue/);
    await page.getByTestId('login-action').click();
    await page.waitForURL('**/staff/home');
    expect(await readSession(page)).toMatchObject({ userId: USERS.staff.userId, deviceToken: USERS.staff.deviceToken });
  });

  test('a device that lost the account to another phone is asked to request access', async ({ page, mock }) => {
    await seedStorage(page, { [`${STORAGE.deviceToken}:${USERS.staff.mobile}`]: 'stale-token' });
    await visit(page, '/staff-login');
    await page.getByTestId('mobile-input').fill(USERS.staff.mobile);
    await expect(page.getByTestId('mismatch-notice')).toBeVisible();
    await expect(page.getByTestId('login-action')).toHaveText(/Request Access/);
    // the mock auto-filed a pending device-change request for the admin
    const fx = await mock.fixtures();
    expect(fx.requests.some((r) => r.type === 'device_change' && r.userId === USERS.staff.userId && r.status === 'pending')).toBe(true);
  });

  test('wrong OTP is rejected and keeps the user on the login screen', async ({ page }) => {
    await visit(page, '/admin-login');
    await page.getByTestId('mobile-input').fill(USERS.admin.mobile);
    await page.getByTestId('login-action').click();
    await expect(page.getByTestId('otp-input')).toBeVisible();
    await page.getByTestId('otp-input').fill('000000');
    await page.getByTestId('login-action').click();
    await expectToast(page, /Invalid or expired login mobile OTP/);
    expect(new URL(page.url()).pathname).toBe('/admin-login');
    expect(await readSession(page)).toBeNull();
  });

  test('employee number on the admin portal is refused with the server message', async ({ page }) => {
    await visit(page, '/admin-login');
    await page.getByTestId('mobile-input').fill(USERS.staff.mobile);
    await page.getByTestId('login-action').click();
    await expectToast(page, /employee account/i);
    await expect(page.getByTestId('otp-input')).toHaveCount(0);
  });

  test('admin number on the staff portal is refused', async ({ page }) => {
    await visit(page, '/staff-login');
    await page.getByTestId('mobile-input').fill(USERS.admin.mobile);
    await page.getByTestId('login-action').click();
    await expectToast(page, /admin account/i);
  });

  test('unknown employee number reports "no user"', async ({ page, issues }) => {
    issues.allow(/generate-otp -> 404/); // the server's intended answer
    await visit(page, '/staff-login');
    await page.getByTestId('mobile-input').fill('9111100000');
    await page.getByTestId('login-action').click();
    await expectToast(page, /no user with this phone number/i);
  });
});
