/**
 * Q4 - bearer-token sessions (security WP12, app side). The backend issues an opaque `access_token` with the OTP /
 * trusted-device / registration step; the app keeps it in the persisted session and sends `Authorization: Bearer <token>`
 * on every non-public request and `?token=` on sockets. With the mock's `requireAuth` flag on, anything without a valid
 * token answers 401, so these journeys prove the whole chain. A 401 means "session expired": sign out once, keep the
 * trusted-device token, show the welcome screen and a toast. Sign-out calls POST /auth/logout best-effort.
 */
import { expect, expectToast, loginAs, loginViaUi, logoutViaUi, readSession, STORAGE, test, USERS, visit } from '../support';
import type { RecordedRequest } from '../support';

const EXPIRED = /Your session expired\. Please sign in again\./;
const PUBLIC_PREFIXES = ['/auth/config', '/auth/generate-otp', '/auth/validate-otp', '/auth/verify-device-token', '/auth/login', '/auth/employee-login', '/auth/register', '/auth/check-', '/auth/org-logo/', '/profile-photo/', '/version/check', '/health', '/ready', '/files/'];
const isProtected = (r: RecordedRequest): boolean => r.method !== 'WS' && !PUBLIC_PREFIXES.some((p) => r.path.startsWith(p));

type TokenSession = NonNullable<Awaited<ReturnType<typeof readSession>>> & { accessToken?: string; tokenExpiresAt?: number };
const tokenOf = async (page: Parameters<typeof readSession>[0]): Promise<TokenSession> => (await readSession(page)) as TokenSession;
const pathOf = (url: string): string => new URL(url).pathname;

test.describe('bearer token (requireAuth on)', () => {
  test.beforeEach(async ({ mock }) => {
    await mock.requireAuth(true);
  });

  test('OTP login stores the token; data requests and the socket carry it; public calls do not', async ({ page, mock }) => {
    await loginViaUi(page, 'admin');
    const session = await tokenOf(page);
    expect(session.accessToken).toMatch(/^tok-adm-\d+-[0-9a-f]+$/);
    expect(session.tokenExpiresAt).toBeGreaterThan(Date.now() + 80 * 86_400_000); // expires_in 7776000 s = 90 days

    await visit(page, '/admin/staff');
    await expect(page.getByText(USERS.staff.name).first()).toBeVisible();

    const rows = await mock.requests();
    const data = rows.filter(isProtected);
    expect(data.length).toBeGreaterThan(0);
    for (const r of data) {
      expect(r.auth, `${r.method} ${r.path}`).toBe(`Bearer ${session.accessToken}`);
      expect(r.status, `${r.method} ${r.path}`).toBeLessThan(400);
    }
    // the login steps themselves are public: no header
    for (const r of rows.filter((x) => ['/auth/generate-otp', '/auth/validate-otp', '/auth/login'].includes(x.path))) expect(r.auth).toBeNull();

    // the realtime socket authenticates through ?token=
    await mock.waitForSocket(USERS.admin.userId);
    const ws = (await mock.requests({ method: 'WS' })).filter((r) => r.status === 101);
    expect(ws.length).toBeGreaterThan(0);
    expect(ws[ws.length - 1].query.token).toBe(session.accessToken);
  });

  test('trusted-device "Continue" (no OTP) also gets a token and the app works', async ({ page, mock }) => {
    await loginViaUi(page, 'admin');
    const first = (await tokenOf(page)).accessToken;
    await page.evaluate(() => window.localStorage.removeItem('@clockyn/auth'));
    await mock.clearRequests();
    await page.goto('/admin-login');
    await page.getByTestId('mobile-input').fill(USERS.admin.mobile);
    await expect(page.getByTestId('login-action')).toHaveText(/Continue/);
    await page.getByTestId('login-action').click();
    await page.waitForURL('**/admin/home');
    const second = (await tokenOf(page)).accessToken;
    expect(second).toMatch(/^tok-adm-/);
    expect(second).not.toBe(first); // a fresh token per verification
    expect(await mock.requests({ path: '/auth/generate-otp' })).toHaveLength(0);
    const data = (await mock.requests()).filter(isProtected);
    expect(data.length).toBeGreaterThan(0);
    for (const r of data) expect(r.auth).toBe(`Bearer ${second}`);
  });

  test('staff OTP login: token + device token in the session', async ({ page, mock }) => {
    await loginViaUi(page, 'staff');
    const session = await tokenOf(page);
    expect(session.accessToken).toMatch(/^tok-stf-/);
    expect(session.deviceToken).toBeTruthy();
    const data = (await mock.requests()).filter(isProtected);
    expect(data.length).toBeGreaterThan(0);
    for (const r of data) expect(r.auth).toBe(`Bearer ${session.accessToken}`);
  });

  test('revoked token mid-session: next request 401 -> signed out once, welcome screen + toast, trusted device kept', async ({ page, mock, issues }) => {
    issues.allow(/ -> 401|WebSocket connection to .* failed/); // the socket is refused with the same bad token
    await loginViaUi(page, 'admin');
    expect((await tokenOf(page)).accessToken).toBeTruthy();
    const deviceKey = `${STORAGE.deviceToken}:${USERS.admin.mobile}`;
    expect(await page.evaluate((k) => window.localStorage.getItem(k), deviceKey)).toBeTruthy();

    await mock.revokeTokens();
    await mock.clearRequests();
    await page.goto('/admin/staff'); // boots with the stored (now revoked) token; several requests fail together

    await expect.poll(() => pathOf(page.url()), { timeout: 20_000 }).toBe('/');
    await expectToast(page, EXPIRED);
    await expect(page.getByText(EXPIRED)).toHaveCount(1); // once, however many requests failed
    await expect(page.getByTestId('welcome-card')).toBeVisible();
    expect(await readSession(page)).toBeNull();
    expect(await page.evaluate((k) => window.localStorage.getItem(k), deviceKey)).toBeTruthy(); // trusted-device token survives

    // an expired token is not worth a logout call
    expect(await mock.requests({ path: '/auth/logout' })).toHaveLength(0);
    const failed = (await mock.requests()).filter((r) => r.status === 401);
    expect(failed.length).toBeGreaterThan(0);

    // the next sign-in skips the OTP
    await page.goto('/admin-login');
    await page.getByTestId('mobile-input').fill(USERS.admin.mobile);
    await expect(page.getByTestId('login-action')).toHaveText(/Continue/);
    await page.getByTestId('login-action').click();
    await page.waitForURL('**/admin/home');
    expect((await tokenOf(page)).accessToken).toMatch(/^tok-adm-/);
    expect(await mock.requests({ path: '/auth/generate-otp' })).toHaveLength(0);
  });

  test('a stored session without a token (signed in before tokens existed) is asked to sign in again', async ({ page, issues }) => {
    issues.allow(/ -> 401|WebSocket connection to .* failed/); // the socket is refused with the same bad token
    await loginAs(page, 'admin');
    await page.goto('/admin/home');
    await expect.poll(() => pathOf(page.url()), { timeout: 20_000 }).toBe('/');
    await expectToast(page, EXPIRED);
    expect(await readSession(page)).toBeNull();
  });

  test('sign-out calls POST /auth/logout with the token before the session is cleared', async ({ page, mock }) => {
    await loginViaUi(page, 'admin');
    const token = (await tokenOf(page)).accessToken;
    await mock.clearRequests();
    await logoutViaUi(page, 'admin');
    await expect.poll(() => pathOf(page.url()), { timeout: 15_000 }).toBe('/');
    expect(await readSession(page)).toBeNull();

    const call = await mock.waitForRequest('/auth/logout', { method: 'POST' });
    expect(call.body).toMatchObject({ user_id: USERS.admin.userId });
    expect(call.auth).toBe(`Bearer ${token}`);
    expect(call.status).toBe(200);
    expect(await mock.requests({ path: '/auth/logout' })).toHaveLength(1);
  });

  test('staff sign-out also sends the device token; the trusted device survives sign-out', async ({ page, mock }) => {
    await loginViaUi(page, 'staff');
    const session = await tokenOf(page);
    await logoutViaUi(page, 'staff');
    await expect.poll(() => pathOf(page.url()), { timeout: 15_000 }).toBe('/');
    const call = await mock.waitForRequest('/auth/logout', { method: 'POST' });
    expect(call.body).toMatchObject({ user_id: USERS.staff.userId, device_token: session.deviceToken });
    expect(call.auth).toBe(`Bearer ${session.accessToken}`);
    expect(await page.evaluate((k) => window.localStorage.getItem(k), `${STORAGE.deviceToken}:${USERS.staff.mobile}`)).toBeTruthy();
  });

  test('a failing /auth/logout never blocks the sign-out', async ({ page, mock, issues }) => {
    issues.allow(/auth\/logout/);
    await loginViaUi(page, 'admin');
    await mock.failNext('/auth/logout', { status: 500, times: -1 });
    await logoutViaUi(page, 'admin');
    await expect.poll(() => pathOf(page.url()), { timeout: 15_000 }).toBe('/');
    expect(await readSession(page)).toBeNull();
    await expect(page.getByText(EXPIRED)).toHaveCount(0); // a failed logout call is not a "session expired" event
    await mock.clearFailures();
  });
});

test.describe('default mock (requireAuth off): tokens are still issued and sent, nothing else changes', () => {
  test('login stores a token and requests carry it even though the server does not demand it', async ({ page, mock }) => {
    await loginViaUi(page, 'admin');
    const session = await tokenOf(page);
    expect(session.accessToken).toMatch(/^tok-adm-/);
    const data = (await mock.requests()).filter(isProtected);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.auth === `Bearer ${session.accessToken}`)).toBe(true);
  });

  test('a tokenless seeded session keeps working and sends no Authorization header', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    const data = (await mock.requests()).filter(isProtected);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.auth === null)).toBe(true);
    expect(pathOf(page.url())).toBe('/admin/home');
  });
});
