/**
 * Q1 - public / auth journeys: welcome, admin login, staff login (device mismatch -> Request Access), company registration.
 * Visual screenshots (light + dark) go to <artifacts>/q1-shots/<project>/auth-*.png
 */
import { expect, expectToast, loginAs, loginViaUi, OTP, readSession, seedStorage, STORAGE, test, USERS, visit } from '../support';
import { pngFile, snapBoth } from '../support/q1';

const UNREGISTERED = '9222200001';

test.describe('Q1 welcome', () => {
  test('welcome shows both portals and routes to each login; back returns to welcome', async ({ page }, testInfo) => {
    await visit(page, '/');
    await expect(page.getByTestId('welcome-card')).toBeVisible();
    await expect(page.getByText('Admin Portal')).toBeVisible();
    await expect(page.getByText('Employee Access')).toBeVisible();
    await snapBoth(page, testInfo, 'auth-welcome');
    await page.getByTestId('portal-admin').click();
    await expect(page.getByTestId('admin-login')).toBeVisible();
    await snapBoth(page, testInfo, 'auth-admin-login');
    await page.getByTestId('auth-back').click();
    // regression (Q1-D1): back must pop to the existing welcome screen, not stack a second copy under it
    await expect(page.getByTestId('welcome-card')).toHaveCount(1);
    await page.getByTestId('portal-staff').click();
    await expect(page.getByTestId('login-card')).toBeVisible();
    await snapBoth(page, testInfo, 'auth-staff-login');
  });

  test('a signed-in admin opening the welcome screen is redirected to the dashboard', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/');
    await page.waitForURL('**/admin/home');
  });
});

test.describe('Q1 admin login', () => {
  test('mobile validation: button disabled below 10 digits, non-digits stripped, enabled at 10', async ({ page }) => {
    await visit(page, '/admin-login');
    const input = page.getByTestId('mobile-input');
    const action = page.getByTestId('login-action');
    await input.fill('98ab76');
    await expect(input).toHaveValue('9876');
    await expect(action).toBeDisabled();
    await input.fill(USERS.admin.mobile);
    await expect(action).toBeEnabled();
    await expect(action).toHaveText(/Get OTP/);
  });

  test('OTP step: 6 boxes, "OTP sent to", Verify hidden until 6 digits, change number goes back', async ({ page }) => {
    await visit(page, '/admin-login');
    await page.getByTestId('mobile-input').fill(USERS.admin.mobile);
    await page.getByTestId('login-action').click();
    await expectToast(page, /login mobile OTP sent/i);
    await expect(page.getByText(`OTP sent to ${USERS.admin.mobile}`)).toBeVisible();
    await expect(page.getByTestId('login-action')).toHaveCount(0);
    await page.getByTestId('otp-input').fill('12345');
    await expect(page.getByTestId('login-action')).toHaveCount(0);
    await page.getByTestId('otp-input').fill('123456');
    await expect(page.getByTestId('login-action')).toHaveText(/Verify & Continue/);
    await page.getByRole('button', { name: 'Change number' }).click();
    await expect(page.getByTestId('mobile-input')).toBeVisible();
  });

  test('wrong OTP clears the boxes, shows the server detail and keeps the session empty', async ({ page }) => {
    await visit(page, '/admin-login');
    await page.getByTestId('mobile-input').fill(USERS.admin.mobile);
    await page.getByTestId('login-action').click();
    await page.getByTestId('otp-input').fill('654321');
    await page.getByTestId('login-action').click();
    await expectToast(page, /Invalid or expired login mobile OTP/);
    await expect(page.getByTestId('otp-input')).toHaveValue('');
    expect(await readSession(page)).toBeNull();
  });

  test('trusted device: Continue signs in without an OTP request', async ({ page, mock }) => {
    await loginViaUi(page, 'admin'); // issues + stores the trusted-device token
    await page.evaluate(() => window.localStorage.removeItem('@clockyn/auth'));
    await mock.clearRequests();
    await page.goto('/admin-login');
    await page.getByTestId('mobile-input').fill(USERS.admin.mobile);
    await expect(page.getByTestId('login-action')).toHaveText(/Continue/);
    await page.getByTestId('login-action').click();
    await page.waitForURL('**/admin/home');
    expect(await mock.requests({ path: '/auth/generate-otp' })).toHaveLength(0);
  });

  test('a stale trusted-device token falls back to Get OTP', async ({ page }) => {
    await seedStorage(page, { [`${STORAGE.deviceToken}:${USERS.admin.mobile}`]: 'stale' });
    await visit(page, '/admin-login');
    await page.getByTestId('mobile-input').fill(USERS.admin.mobile);
    await expect(page.getByTestId('login-action')).toHaveText(/Get OTP/);
  });

  test('send-OTP failure shows the server detail; a network failure shows a friendly message', async ({ page, mock, issues }) => {
    issues.allow(/generate-otp/);
    await visit(page, '/admin-login');
    await mock.failNext('/auth/generate-otp', { status: 403, body: { detail: 'Your account is inactive. Please contact your admin.' } });
    await page.getByTestId('mobile-input').fill(USERS.admin.mobile);
    await page.getByTestId('login-action').click();
    await expectToast(page, /account is inactive/i);
    await expect(page.getByTestId('login-action')).toBeEnabled();
    await mock.failNext('/auth/generate-otp', { networkError: true, times: -1 }); // the browser may retry a reset POST once
    await page.getByTestId('login-action').click();
    await expectToast(page, /network connection failed/i);
    await expect(page.getByTestId('login-action')).toBeEnabled();
    await mock.clearFailures();
  });

  test('server success:false after a verified OTP is surfaced and no session is persisted', async ({ page, mock, issues }) => {
    issues.allow(/auth\/login/);
    await visit(page, '/admin-login');
    await mock.failNext('/auth/login', { status: 200, body: { success: false, message: 'Your subscription is blocked' } });
    await page.getByTestId('mobile-input').fill(USERS.admin.mobile);
    await page.getByTestId('login-action').click();
    await page.getByTestId('otp-input').fill(OTP);
    await page.getByTestId('login-action').click();
    await expectToast(page, /subscription is blocked/i);
    expect(await readSession(page)).toBeNull();
    expect(new URL(page.url()).pathname).toBe('/admin-login');
    // spent OTP: the user returns to the number step (the stored token enables Continue)
    await expect(page.getByTestId('mobile-input')).toBeVisible();
  });

  test('wrong role in the login body is rejected BEFORE a session is persisted', async ({ page, mock, issues }) => {
    issues.allow(/auth\/login/);
    await visit(page, '/admin-login');
    // the OTP passes for the admin number, but the lookup answers with an employee identity
    await mock.failNext('/auth/login', { status: 200, body: { success: true, user_id: 'stf-0001', role_id: 3, org_id: 'org-0001', org_name: 'Acme Traders' } });
    await page.getByTestId('mobile-input').fill(USERS.admin.mobile);
    await page.getByTestId('login-action').click();
    await page.getByTestId('otp-input').fill(OTP);
    await page.getByTestId('login-action').click();
    await expectToast(page, /Access denied/i);
    expect(await readSession(page)).toBeNull();
    expect(new URL(page.url()).pathname).toBe('/admin-login');
  });

  test('an unknown number continues to registration with the mobile pre-verified', async ({ page }) => {
    await visit(page, '/admin-login');
    await page.getByTestId('mobile-input').fill(UNREGISTERED);
    await page.getByTestId('login-action').click();
    await page.getByTestId('otp-input').fill(OTP);
    await page.getByTestId('login-action').click();
    await page.waitForURL('**/register**');
    await expect(page.getByTestId('reg-mobile-verified')).toBeVisible();
    expect(await readSession(page)).toBeNull();
  });
});

test.describe('Q1 staff login', () => {
  test('staff mobile -> OTP -> home; device token is persisted per mobile', async ({ page }) => {
    await loginViaUi(page, 'fieldStaff');
    expect(new URL(page.url()).pathname).toBe('/staff/home');
    const token = await page.evaluate((k) => window.localStorage.getItem(k), `${STORAGE.deviceToken}:${USERS.fieldStaff.mobile}`);
    expect(token).toBeTruthy();
  });

  test('device mismatch: notice, Request Access opens the pre-login request, submit files it and returns to login', async ({ page, mock }, testInfo) => {
    await seedStorage(page, { [`${STORAGE.deviceToken}:${USERS.staff.mobile}`]: 'stale-token' });
    await visit(page, '/staff-login');
    await page.getByTestId('mobile-input').fill(USERS.staff.mobile);
    await expect(page.getByTestId('mismatch-notice')).toBeVisible();
    await snapBoth(page, testInfo, 'auth-staff-mismatch');
    await page.getByTestId('login-action').click();
    await page.waitForURL('**/device-change-request**');
    await expect(page.getByTestId('device-warning')).toBeVisible();
    // validation first
    await page.getByTestId('device-submit').click();
    await expect(page.getByText(/reason/i).first()).toBeVisible();
    await page.getByTestId('device-reason').fill('Lost my phone yesterday');
    await page.getByTestId('device-submit').click();
    await expect(page.getByText('Device change request submitted successfully')).toBeVisible();
    await page.waitForURL('**/staff-login');
    const posted = await mock.lastRequest('/requests/device-change', 'POST');
    expect(posted?.body).toMatchObject({ user_id: USERS.staff.userId });
  });

  test('changing the number clears the stale device-mismatch state', async ({ page }) => {
    await seedStorage(page, { [`${STORAGE.deviceToken}:${USERS.staff.mobile}`]: 'stale-token' });
    await visit(page, '/staff-login');
    const input = page.getByTestId('mobile-input');
    await input.fill(USERS.staff.mobile);
    await expect(page.getByTestId('mismatch-notice')).toBeVisible();
    await input.fill(USERS.fieldStaff.mobile);
    await expect(page.getByTestId('mismatch-notice')).toHaveCount(0);
    await expect(page.getByTestId('login-action')).toHaveText(/Get OTP|Continue|Checking/);
    await input.fill(USERS.staff.mobile.slice(0, 9));
    await expect(page.getByTestId('login-action')).toBeDisabled();
  });

  test('an inactive employee is refused with the server message', async ({ page, mock, issues }) => {
    issues.allow(/generate-otp/);
    const fx = await mock.fixtures();
    const inactive = fx.staff.find((s) => s.status === 0 && s.role_id === 3);
    expect(inactive).toBeTruthy();
    await visit(page, '/staff-login');
    await page.getByTestId('mobile-input').fill(inactive!.mobile);
    await page.getByTestId('login-action').click();
    await expectToast(page, /inactive/i);
  });
});

test.describe('Q1 registration', () => {
  async function toRegister(page: import('@playwright/test').Page): Promise<void> {
    await visit(page, '/admin-login');
    await page.getByTestId('mobile-input').fill(UNREGISTERED);
    await page.getByTestId('login-action').click();
    await page.getByTestId('otp-input').fill(OTP);
    await page.getByTestId('login-action').click();
    await page.waitForURL('**/register**');
    await expect(page.getByTestId('reg-mobile-verified')).toBeVisible();
  }

  test('full registration: details, email OTP, branches/departments, statutory ids, logo -> dashboard', async ({ page, mock }, testInfo) => {
    await toRegister(page);
    const submit = page.getByTestId('register-submit');
    await expect(submit).toBeDisabled();
    await snapBoth(page, testInfo, 'auth-register-empty');

    // required-field errors only after leaving a field
    await page.getByTestId('reg-org-name').click();
    await page.getByTestId('reg-address').click();
    await expect(page.getByText('Company name is required')).toBeVisible();

    await page.getByTestId('reg-org-name').fill('Zenith Retail');
    await page.getByTestId('reg-address').fill('12 Park Street');
    await page.getByTestId('reg-state').fill('Karnataka');
    await page.getByTestId('reg-district').fill('Bengaluru');
    await page.getByTestId('reg-pincode').pressSequentially('56a0001x');
    await expect(page.getByTestId('reg-pincode')).toHaveValue('560001'); // digits only, max 6

    // email: format error after blur, Get OTP disabled; duplicate email blocked
    const email = page.getByTestId('reg-email-input');
    await email.fill('not-an-email');
    await email.blur();
    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    await expect(page.getByTestId('reg-email-get-otp')).toBeDisabled();
    await email.fill(USERS.admin.email);
    await expect(page.getByText('Email already registered')).toBeVisible();
    await expect(page.getByTestId('reg-email-get-otp')).toBeDisabled();
    await email.fill('Owner@Zenith.example');
    await expect(email).toHaveValue('owner@zenith.example'); // lower-cased
    await page.getByTestId('reg-email-get-otp').click();
    await expectToast(page, /Registration email OTP sent/i);
    await expect(page.getByText('Sent OTP to owner@zenith.example')).toBeVisible();
    await expect(page.getByTestId('reg-email-verify')).toBeDisabled();
    await page.getByTestId('reg-email-otp-input').fill('000000');
    await page.getByTestId('reg-email-verify').click();
    await expectToast(page, /Invalid or expired registration email OTP/);
    await page.getByTestId('reg-email-otp-input').fill(OTP);
    await page.getByTestId('reg-email-verify').click();
    await expect(page.getByTestId('reg-email-verified')).toBeVisible();

    // still no branch -> disabled
    await expect(submit).toBeDisabled();
    await page.getByTestId('reg-branches-0').fill('Main Branch');
    await page.getByTestId('reg-branches-add').click();
    await page.getByTestId('reg-branches-1').fill('Second Branch');
    await page.getByTestId('reg-branches-remove-1').click();
    await expect(page.getByTestId('reg-branches-1')).toHaveCount(0);
    await page.getByTestId('reg-departments-0').fill('Sales');
    await page.getByTestId('reg-departments-add').click();
    await page.getByTestId('reg-departments-1').fill('sales '); // duplicate (case-insensitive) is de-duplicated

    // optional statutory details: errors are displayed but never block
    await page.getByTestId('reg-toggle-more').click();
    await page.getByTestId('reg-pan').fill('abcde1234');
    await expect(page.getByText('Invalid PAN format (e.g., ABCDE1234F)')).toBeVisible();
    await page.getByTestId('reg-pan').fill('abcde1234f');
    await expect(page.getByTestId('reg-pan')).toHaveValue('ABCDE1234F');
    await page.getByTestId('reg-cin').fill('bad');
    await expect(page.getByText('Invalid CIN format')).toBeVisible();
    await page.getByTestId('reg-tan').fill('xyz');
    await expect(page.getByText(/Invalid TAN format/)).toBeVisible();
    await page.getByTestId('reg-category').fill('Retail');
    await snapBoth(page, testInfo, 'auth-register-filled');

    // logo upload via the file chooser
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('logo-picker').click();
    await (await chooser).setFiles(pngFile('logo.png'));
    await expect(page.getByText('Tap to change logo')).toBeVisible();

    await expect(submit).toBeEnabled();
    await submit.click();
    await page.waitForURL('**/admin/home');
    await expectToast(page, 'Awesome! Welcome to Zenith Retail');

    const reg = await mock.lastRequest('/auth/register', 'POST');
    expect(reg?.body).toMatchObject({
      org_name: 'Zenith Retail',
      mobile_number: UNREGISTERED,
      email: 'owner@zenith.example',
      state: 'Karnataka',
      district: 'Bengaluru',
      pincode: 560001,
      pan_number: 'ABCDE1234F',
      business_category: 'Retail',
      branches: ['Main Branch'],
      departments: ['Sales'],
    });
    const logo = await mock.lastRequest('/auth/upload-org-logo', 'POST');
    expect(logo?.files?.[0]?.field).toBe('logo');
    const session = await readSession(page);
    expect(session).toMatchObject({ roleId: 1, orgName: 'Zenith Retail' });
  });

  test('registration failure shows the server message and keeps the form', async ({ page, mock, issues }) => {
    issues.allow(/auth\/register/);
    await toRegister(page);
    await page.getByTestId('reg-org-name').fill('Zenith Retail');
    await page.getByTestId('reg-address').fill('12 Park Street');
    await page.getByTestId('reg-state').fill('Karnataka');
    await page.getByTestId('reg-district').fill('Bengaluru');
    await page.getByTestId('reg-pincode').fill('560001');
    await page.getByTestId('reg-email-input').fill('owner@zenith.example');
    await page.getByTestId('reg-email-get-otp').click();
    await page.getByTestId('reg-email-otp-input').fill(OTP);
    await page.getByTestId('reg-email-verify').click();
    await expect(page.getByTestId('reg-email-verified')).toBeVisible();
    await page.getByTestId('reg-branches-0').fill('HQ');
    await mock.failNext('/auth/register', { status: 400, body: { detail: 'Email already registered' } });
    await page.getByTestId('register-submit').click();
    await expectToast(page, /Email already registered/);
    expect(new URL(page.url()).pathname).toBe('/register');
    await expect(page.getByTestId('register-submit')).toBeEnabled(); // spinner cleared
    expect(await readSession(page)).toBeNull();
  });

  test('registering a number that exists is blocked on the mobile OTP step', async ({ page }) => {
    // open the screen without a verified contact: the number can be typed and is duplicate-checked
    await visit(page, '/register');
    const mobile = page.getByTestId('reg-mobile-input');
    await mobile.fill('12');
    await mobile.blur();
    await expect(page.getByText('Enter a valid 10-digit mobile number')).toBeVisible();
    await mobile.fill(USERS.admin.mobile);
    await expect(page.getByText('Mobile number already registered')).toBeVisible();
    await expect(page.getByTestId('reg-mobile-get-otp')).toBeDisabled();
  });
});
