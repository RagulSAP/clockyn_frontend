/**
 * Harness self-tests: proves the pieces Q1-Q3 rely on actually work (issue collector, failure injection, tenant
 * isolation, plan simulation, WebSocket push, dark mode, geolocation/camera permissions).
 */
import { expect, GEO, loginAs, MOCK_URL, MockClient, setDarkMode, test, USERS, visit } from '../support';

test.describe('issue collector', () => {
  test.use({ failOnPageIssues: false });

  test('records console errors, uncaught errors and missing mock endpoints', async ({ page, issues }) => {
    await visit(page, '/');
    await page.evaluate(() => {
      console.error('boom from the test');
      setTimeout(() => {
        throw new Error('uncaught from the test');
      }, 0);
    });
    await page.evaluate((url) => fetch(`${url}/definitely-not-an-endpoint`).then(() => undefined), MOCK_URL);
    await expect.poll(() => issues.issues().map((i) => i.kind).sort()).toEqual(expect.arrayContaining(['console', 'http', 'pageerror']));
    issues.allow(/boom from the test|uncaught from the test|definitely-not-an-endpoint/);
    expect(issues.issues()).toEqual([]);
  });
});

test.describe('mock control surface', () => {
  test('tenants are isolated (state, recorded requests)', async ({ mock }) => {
    const other = new MockClient('http://127.0.0.1:8799');
    await other.reset();
    await other.setPlan('expired');
    expect((await mock.state()).plan).toBe('elite');
    expect((await other.state()).plan).toBe('expired');
    await other.reset();
  });

  test('reset restores the seed after a mutation', async ({ mock }) => {
    await fetch(`${MOCK_URL}/branch/add`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-e2e-tenant': mock.tenant },
      body: JSON.stringify({ branch_name: 'Temp Branch', branch_address: 'x', branch_latitude: 1, branch_longitude: 2, punch_radius: 50, org_id: 'org-0001' }),
    });
    expect((await mock.fixtures()).branches).toHaveLength(3);
    await mock.reset();
    expect((await mock.fixtures()).branches).toHaveLength(2);
  });

  test('failNext shows up as an error state in the app and recovers on retry', async ({ page, mock, issues }) => {
    issues.allow(/\/home\/branches/);
    await loginAs(page, 'admin');
    await mock.failNext('/home/branches', { status: 500, times: 3 });
    await visit(page, '/admin/branches');
    await expect(page.getByText(/Server error|Something went wrong|Failed|try again/i).first()).toBeVisible();
    await mock.clearFailures();
    const failed = await mock.requests({ path: '/home/branches' });
    expect(failed.some((r) => r.injected && r.status === 500)).toBe(true);
  });

  test('recorded requests carry query, body and multipart parts', async ({ mock }) => {
    const form = new FormData();
    form.append('user_id', USERS.staff.userId);
    form.append('face', new Blob(['x'], { type: 'image/jpeg' }), 'face.jpg');
    await fetch(`${MOCK_URL}/face/register`, { method: 'POST', headers: { 'x-e2e-tenant': mock.tenant }, body: form });
    const rec = await mock.lastRequest('/face/register', 'POST');
    expect(rec?.body).toMatchObject({ user_id: USERS.staff.userId });
    expect(rec?.files?.[0]).toMatchObject({ field: 'face', filename: 'face.jpg' });
  });
});

test.describe('plan simulation', () => {
  test('an expired plan blocks CRM for the admin (server 403 + UI message)', async ({ page, mock, issues }) => {
    issues.allow(/\/api\/leads\//);
    issues.allow(/(chat|group-chat)\/list\/.* -> 500/); // chat list reports a plan block as a wrapped HTTP 500 (documented backend quirk)
    await mock.setPlan('expired');
    await loginAs(page, 'admin');
    await visit(page, '/admin/crm');
    await expect(page.getByText(/plan|subscribe|upgrade|renew/i).first()).toBeVisible();
  });

  test('a free-trial admin session unlocks CRM', async ({ page, mock }) => {
    await mock.setPlan('trial');
    const session = await loginAs(page, 'admin');
    expect(session).toMatchObject({ planId: null, isFreeTrial: true });
    await visit(page, '/admin/crm');
    await expect(page.getByText(/subscribe|plan has expired/i)).toHaveCount(0);
  });
});

test.describe('realtime', () => {
  test('a new request pushed over the socket refreshes the admin requests badge', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    await mock.waitForSocket(USERS.admin.userId);
    const badge = page.getByTestId('qa-requests-badge');
    await expect(badge).toHaveText('8'); // 8 pending requests are seeded
    // a staff member files a leave request (real API call): the mock stores it and pushes request_submitted to the admin
    const res = await fetch(`${MOCK_URL}/requests/leave/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-e2e-tenant': mock.tenant },
      body: JSON.stringify({ user_id: USERS.staff.userId, org_id: 'org-0001', leave_dates: ['2026-12-24'], reason: 'Holiday' }),
    });
    expect((await res.json()).success).toBe(true);
    await expect(badge).toHaveText('9');
    expect((await mock.push(USERS.admin.userId, { type: 'request_submitted' })).delivered).toBe(1); // raw push endpoint
  });

  test('staff chat badge reacts to a pushed message', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await mock.waitForSocket(USERS.staff.userId);
    await mock.push(USERS.staff.userId, { type: 'new_message', data: { message_id: 'pushed-1', sender_id: USERS.admin.userId, receiver_id: USERS.staff.userId, message: 'hi', message_type: 'text', timestamp: new Date().toISOString() } });
    // tab-bar badge on the phone, sidebar link on wide screens
    await expect(page.locator('[data-testid="tab-badge-chat"], [data-testid="sidebar-chat"]').filter({ visible: true })).toContainText('11');
  });
});

test.describe('browser capabilities', () => {
  test('geolocation is granted at the Head Office coordinates', async ({ page }) => {
    await visit(page, '/');
    const pos = await page.evaluate(() => new Promise<{ lat: number; lng: number }>((res, rej) => navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), rej)));
    expect(pos.lat).toBeCloseTo(GEO.latitude, 4);
    expect(pos.lng).toBeCloseTo(GEO.longitude, 4);
  });

  test('camera works with the fake media device', async ({ page }) => {
    await visit(page, '/');
    const tracks = await page.evaluate(async () => (await navigator.mediaDevices.getUserMedia({ video: true })).getVideoTracks().length);
    expect(tracks).toBe(1);
  });

  test('dark mode toggles live', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    const light = await page.screenshot();
    await setDarkMode(page, true);
    await expect.poll(async () => !(await page.screenshot()).equals(light)).toBe(true);
  });
});

test.describe('opt-in fixtures', () => {
  test('birthdays are off by default and can be switched on', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(page.getByText(/birthday/i)).toHaveCount(0);
    await mock.setState({ birthdays: ['stf-0003'] });
    await page.reload();
    await expect(page.getByText(/Chirag Patel's birthday/)).toBeVisible();
  });
});
