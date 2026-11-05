/**
 * Q4 - e-mail sign-in deployment (backend USER_AUTH=email): the app asks for an e-mail address instead of a mobile
 * number, the one-time code goes to the mailbox, and registration verifies only the e-mail (no mobile OTP anywhere).
 */
import { expect, expectToast, OTP, readSession, test, USERS, visit } from '../support';

const NEW_EMAIL = 'founder@northwind.example';
const NEW_MOBILE = '9222200002';

test.describe('e-mail sign-in mode', () => {
  test.beforeEach(async ({ mock }) => {
    await mock.setState({ userAuth: 'email' });
  });

  test('admin: email field, code sent to the mailbox, verified, dashboard; no SMS channel is used', async ({ page, mock }) => {
    await visit(page, '/admin-login');
    await expect(page.getByText('Sign in with your email address')).toBeVisible();
    await expect(page.getByTestId('mobile-input')).toHaveCount(0);
    const input = page.getByTestId('email-input');
    const action = page.getByTestId('login-action');
    await expect(action).toBeDisabled();
    await input.fill('anita');
    await expect(action).toBeDisabled();
    await input.fill(USERS.admin.mobile);
    await expect(action).toBeDisabled(); // a phone number is not a valid sign-in id here
    await input.fill(`  ${USERS.admin.email.toUpperCase()} `);
    await expect(input).toHaveValue(USERS.admin.email);
    await expect(action).toBeEnabled();
    await action.click();
    await expectToast(page, /login email OTP sent/i);
    await expect(page.getByText(`We emailed a code to ${USERS.admin.email}`)).toBeVisible();
    await page.getByTestId('otp-input').fill(OTP);
    await page.getByTestId('login-action').click();
    await page.waitForURL('**/admin/home');

    const sent = await mock.requests({ path: '/auth/generate-otp' });
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toMatchObject({ contact: USERS.admin.email, purpose: 'login', role_id: 1 });
    const login = await mock.lastRequest('/auth/login', 'POST');
    expect(login?.body).toMatchObject({ login_id: USERS.admin.email });
  });

  test('staff: signs in with the work email, wrong code is rejected, trusted device skips the code next time', async ({ page, mock }) => {
    await visit(page, '/staff-login');
    await page.getByTestId('email-input').fill(USERS.manager.email);
    await page.getByTestId('login-action').click();
    await expectToast(page, /login email OTP sent/i);
    await page.getByTestId('otp-input').fill('654321');
    await page.getByTestId('login-action').click();
    await expectToast(page, /Invalid or expired login email OTP/);
    await expect(page.getByTestId('otp-input')).toHaveValue('');
    expect(await readSession(page)).toBeNull();

    await page.getByTestId('otp-input').fill(OTP);
    await page.getByTestId('login-action').click();
    await page.waitForURL('**/staff/home');

    // sign out locally, come back: the stored device token (keyed by the e-mail) lets the user skip the code
    await page.evaluate(() => window.localStorage.removeItem('@clockyn/auth'));
    await mock.clearRequests();
    await page.goto('/staff-login');
    await page.getByTestId('email-input').fill(USERS.manager.email);
    await expect(page.getByTestId('login-action')).toHaveText(/Continue/);
    await page.getByTestId('login-action').click();
    await page.waitForURL('**/staff/home');
    expect(await mock.requests({ path: '/auth/generate-otp' })).toHaveLength(0);
  });

  test('staff: an unknown email is told so (no code sent)', async ({ page, issues }) => {
    issues.allow(/\/auth\/generate-otp -> 404/);
    await visit(page, '/staff-login');
    await page.getByTestId('email-input').fill('nobody@nowhere.example');
    await page.getByTestId('login-action').click();
    await expectToast(page, /no user with this email address/i);
    await expect(page.getByTestId('otp-input')).toHaveCount(0);
  });

  test('new admin: unknown email -> code -> registration with the e-mail locked and the mobile number as a plain field', async ({ page, mock }) => {
    await visit(page, '/admin-login');
    await page.getByTestId('email-input').fill(NEW_EMAIL);
    await page.getByTestId('login-action').click();
    await page.getByTestId('otp-input').fill(OTP);
    await page.getByTestId('login-action').click();
    await page.waitForURL('**/register**');

    await expect(page.getByTestId('reg-email-verified')).toBeVisible();
    await expect(page.getByTestId('reg-mobile-get-otp')).toHaveCount(0);
    await expect(page.getByText('We verify your e-mail with a one-time code. You will sign in with it.')).toBeVisible();
    const submit = page.getByTestId('register-submit');
    await expect(submit).toBeDisabled();

    await page.getByTestId('reg-org-name').fill('Northwind Traders');
    await page.getByTestId('reg-address').fill('7 Canal Road');
    await page.getByTestId('reg-state').fill('Kerala');
    await page.getByTestId('reg-district').fill('Kochi');
    await page.getByTestId('reg-pincode').fill('682001');
    await page.getByTestId('reg-branches-0').fill('Head Office');
    await expect(submit).toBeDisabled(); // the mobile number is still required

    const mobile = page.getByTestId('reg-mobile-input');
    await mobile.fill('98ab');
    await expect(mobile).toHaveValue('98');
    await expect(submit).toBeDisabled();
    await mobile.fill(NEW_MOBILE);
    await expect(submit).toBeEnabled();
    await submit.click();
    await page.waitForURL('**/admin/home');

    const reg = await mock.lastRequest('/auth/register', 'POST');
    expect(reg?.body).toMatchObject({ org_name: 'Northwind Traders', mobile_number: NEW_MOBILE, email: NEW_EMAIL });
    // no code was ever requested for a mobile number
    const codes = await mock.requests({ path: '/auth/generate-otp' });
    expect(codes.every((c) => String((c.body as { contact?: string }).contact).includes('@'))).toBe(true);
  });
});
