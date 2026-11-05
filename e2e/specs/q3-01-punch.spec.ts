/**
 * Q3 - Staff punch journeys on /staff/home: face registration, punch-in (permissions -> GPS -> geofence -> camera),
 * second session, session limit, punch-out, forced retry, plan block, field-staff tracking, overlays.
 * Browser camera = Chromium fake device; geolocation = the Head Office coordinates (playwright.config).
 */
import { expect, loginAs, test, USERS, visit, BRANCHES } from '../support';
import { capturePunch, captureRegistration, snap } from '../support/q3';

const chip = (page: import('@playwright/test').Page) => page.getByTestId('home-status-chip');
const punchBtn = (page: import('@playwright/test').Page) => page.getByTestId('punch-button');

test.describe('staff home: first look', () => {
  test('shows company, greeting, shift, NOT IN state and the four quick actions', async ({ page }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(page.getByTestId('home-company')).toHaveText('Acme Traders');
    await expect(page.getByTestId('home-greeting')).toContainText(/Good (Morning|Afternoon|Evening|Night)/);
    await expect(page.getByTestId('home-username')).toHaveText('Aarav Sharma');
    await expect(chip(page)).toContainText('NOT IN');
    await expect(punchBtn(page)).toHaveAccessibleName('PUNCH IN');
    await expect(page.getByTestId('punch-state-label')).toHaveText('Not Punched In');
    await expect(page.getByTestId('shift-card')).toContainText('General');
    await expect(page.getByTestId('shift-card')).toContainText('09:00 AM – 06:00 PM');
    for (const k of ['profile', 'expenses', 'requests', 'attendance']) await expect(page.getByTestId(`quick-${k}`)).toBeVisible();
    await expect(page.getByTestId('time-value-in')).toHaveText('--:--');
    await snap(page, testInfo, 'staff-home-not-in');
    // regression (Q3-V2): the greeting wraps instead of cutting the name off next to the status chip
    const clipped = await page.getByTestId('home-greeting').evaluate((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
    expect(clipped, 'greeting text is clipped').toBe(false);
  });

  test('quick actions open personal details, expenses, requests and the attendance calendar', async ({ page }) => {
    await loginAs(page, 'staff');
    const targets: [string, string][] = [
      ['profile', '/staff/profile'],
      ['expenses', '/staff/expenses'],
      ['requests', '/staff/requests'],
      ['attendance', '/staff/attendance'],
    ];
    for (const [key, route] of targets) {
      await visit(page, '/staff/home');
      await page.getByTestId(`quick-${key}`).click();
      await page.waitForURL(`**${route}`);
    }
  });
});

test.describe('face registration (first-time user)', () => {
  test('SETUP FACE -> 4 guided photos -> preview -> register -> PUNCH IN becomes available', async ({ page, mock }, testInfo) => {
    await mock.setState({ userPatch: { [USERS.staff.userId]: { face_registered: false } } });
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(chip(page)).toContainText('SETUP');
    await expect(punchBtn(page)).toHaveAccessibleName('SETUP FACE');
    await expect(page.getByTestId('punch-state-label')).toHaveText('Setup Required');
    await snap(page, testInfo, 'staff-home-setup-face');

    await punchBtn(page).click();
    await expect(page.getByTestId('face-registration-modal')).toBeVisible();
    await expect(page.getByText('Position your face in the oval')).toBeVisible();
    await snap(page, testInfo, 'face-registration-guide');
    await captureRegistration(page);
    await expect(page.getByText('Does this look clear?')).toBeVisible();
    await snap(page, testInfo, 'face-registration-preview');
    // regression (Q3-V1): no empty round placeholder button in the top bar of the preview step
    const emptyCircles = await page.getByTestId('face-registration-modal').evaluate((root) =>
      Array.from(root.querySelectorAll<HTMLElement>('div')).filter((el) => {
        const r = el.getBoundingClientRect();
        const bg = getComputedStyle(el).backgroundColor;
        return Math.round(r.width) === 40 && Math.round(r.height) === 40 && bg !== 'rgba(0, 0, 0, 0)' && !el.textContent && !el.querySelector('svg') && !el.getAttribute('aria-label');
      }).length,
    );
    expect(emptyCircles, 'empty 40px circle in the camera top bar').toBe(0);
    await page.getByTestId('face-register').click();
    await expect(page.getByTestId('face-registered')).toBeVisible();
    await expect(page.getByText('Face Registered')).toBeVisible();
    await snap(page, testInfo, 'face-registration-success');

    const reg = await mock.waitForRequest('/face/register', { method: 'POST' });
    expect(reg.body).toMatchObject({ user_id: USERS.staff.userId });
    expect(reg.files?.filter((f) => f.field === 'faces')).toHaveLength(4);

    await page.getByTestId('face-get-started').click();
    await expect(page.getByTestId('face-registration-modal')).toHaveCount(0);
    await expect(chip(page)).toContainText('NOT IN');
    await expect(punchBtn(page)).toHaveAccessibleName('PUNCH IN');
    // persisted in the mock: a reload still shows a registered user
    await page.reload();
    await expect(punchBtn(page)).toHaveAccessibleName('PUNCH IN');
  });

  test('without camera permission SETUP FACE explains what to enable and never opens the camera', async ({ page, mock, context }) => {
    await mock.setState({ userPatch: { [USERS.staff.userId]: { face_registered: false } } });
    await context.clearPermissions();
    await context.grantPermissions(['geolocation']);
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await punchBtn(page).click();
    await expect(page.getByText(/Permissions Required|Camera permission is needed/).first()).toBeVisible();
    await expect(page.getByTestId('face-registration-modal')).toHaveCount(0);
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(punchBtn(page)).toBeEnabled();
  });

  test('closing the registration camera returns to SETUP FACE without posting', async ({ page, mock }) => {
    await mock.setState({ userPatch: { [USERS.staff.userId]: { face_registered: false } } });
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await punchBtn(page).click();
    await expect(page.getByTestId('face-registration-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /close/i }).first().click({ trial: true }).catch(() => undefined);
    await expect.poll(async () => (await mock.requests({ path: '/face/register' })).length).toBe(0);
  });

  test('a failed registration shows the server message and lets the user retry', async ({ page, mock }) => {
    await mock.setState({ userPatch: { [USERS.staff.userId]: { face_registered: false } } });
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await punchBtn(page).click();
    await captureRegistration(page);
    await mock.failNext('/face/register', { status: 200, body: { success: false, message: 'No face detected in photo 2' } });
    await page.getByTestId('face-register').click();
    await expect(page.getByText(/Registration Failed/)).toBeVisible();
    await expect(page.getByText(/Face not visible in some photos/)).toBeVisible();
    // retry succeeds
    await captureRegistration(page);
    await page.getByTestId('face-register').click();
    await expect(page.getByTestId('face-registered')).toBeVisible();
  });

  test('two failed registrations in a row show the tips sheet with the last message; Try again dismisses it', async ({ page, mock }) => {
    await mock.setState({ userPatch: { [USERS.staff.userId]: { face_registered: false } } });
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await punchBtn(page).click();
    await captureRegistration(page);
    await mock.failNext('/face/register', { status: 200, body: { success: false, message: 'No face detected in photo 2' } });
    await page.getByTestId('face-register').click();
    await expect(page.getByText(/Registration Failed/)).toBeVisible();
    await expect(page.getByTestId('face-tips')).toHaveCount(0);
    // second failure in a row
    await captureRegistration(page);
    await mock.failNext('/face/register', { status: 200, body: { success: false, message: 'No face detected in photo 2' } });
    await page.getByTestId('face-register').click();
    await expect(page.getByTestId('face-tips')).toBeVisible();
    await expect(page.getByText('Tips for a clear photo')).toBeVisible();
    await expect(page.getByTestId('face-tips').getByText(/Face not visible in some photos/)).toBeVisible();
    await page.getByTestId('face-tips-dismiss').click();
    await expect(page.getByTestId('face-tips')).toHaveCount(0);
    // the registration still works afterwards
    await captureRegistration(page);
    await page.getByTestId('face-register').click();
    await expect(page.getByTestId('face-registered')).toBeVisible();
  });
});

test.describe('punch in / out', () => {
  test('PUNCH IN: geofence passes, face captured, success, chip WORKING, button PUNCH OUT', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await punchBtn(page).click();
    await expect(page.getByTestId('face-recognition-modal')).toBeVisible();
    await expect(page.getByText('Look directly at the camera')).toBeVisible();
    await snap(page, testInfo, 'face-punch-camera');
    await capturePunch(page);
    await expect(page.getByTestId('face-result')).toContainText('Punched In!');
    await snap(page, testInfo, 'face-punch-success');

    const check = await mock.waitForRequest('/face/check-location', { method: 'POST' });
    expect(check.body).toMatchObject({ user_id: USERS.staff.userId });
    expect(Number(check.body?.latitude)).toBeCloseTo(BRANCHES.hq.latitude, 3);
    const punch = await mock.waitForRequest('/face/punch', { method: 'POST' });
    expect(punch.body).toMatchObject({ user_id: USERS.staff.userId, action: 'punch_in' });
    expect(punch.files?.some((f) => f.field === 'face' && f.size > 0)).toBe(true);
    expect(Number(punch.body?.latitude)).toBeCloseTo(BRANCHES.hq.latitude, 3);

    await page.getByTestId('face-done').click();
    await expect(page.getByTestId('face-recognition-modal')).toHaveCount(0);
    await expect(chip(page)).toContainText('WORKING');
    await expect(punchBtn(page)).toHaveAccessibleName('PUNCH OUT');
    await expect(page.getByTestId('punch-state-label')).toHaveText('Currently Working');
    await expect(page.getByTestId('time-value-in')).not.toHaveText('--:--');
    await expect(page.getByTestId('remain-title')).toHaveText(/REMAINING TIME|OVERTIME/);
    await snap(page, testInfo, 'staff-home-working');
  });

  test('outside the branch radius: "Outside Branch Area" alert, camera never opens, no punch is sent', async ({ page, mock, context }) => {
    await context.setGeolocation({ latitude: 13.05, longitude: 77.7 }); // ~15 km away
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await punchBtn(page).click();
    await expect(page.getByText('Outside Branch Area')).toBeVisible();
    await expect(page.getByText(/away from Head Office/)).toBeVisible();
    await expect(page.getByTestId('face-recognition-modal')).toHaveCount(0);
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(punchBtn(page)).toHaveAccessibleName('PUNCH IN');
    expect(await mock.requests({ path: '/face/punch' })).toHaveLength(0);
  });

  test('a failing geofence request is reported (toast) and the button is usable again', async ({ page, mock, issues }) => {
    issues.allow(/check-location/);
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await mock.failNext('/face/check-location', { status: 503, body: { detail: 'Location service down' } });
    await punchBtn(page).click();
    await expect(page.getByText('Location service down')).toBeVisible();
    await expect(page.getByTestId('face-recognition-modal')).toHaveCount(0);
    await expect(punchBtn(page)).toBeEnabled();
    await punchBtn(page).click();
    await expect(page.getByTestId('face-recognition-modal')).toBeVisible();
  });

  test('two sessions in a day, then LIMIT REACHED / COMPLETE', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    const doPunch = async (title: string) => {
      await expect(punchBtn(page)).toBeEnabled();
      await punchBtn(page).click();
      await capturePunch(page);
      await expect(page.getByTestId('face-result')).toContainText(title);
      await page.getByTestId('face-done').click();
      await expect(page.getByTestId('face-recognition-modal')).toHaveCount(0);
    };
    await doPunch('Punched In!');
    await expect(punchBtn(page)).toHaveAccessibleName('PUNCH OUT');
    await doPunch('Punched Out!');
    await expect(chip(page)).toContainText('COMPLETE');
    // one completed session: the button stays active for a second punch-in
    await expect(punchBtn(page)).toHaveAccessibleName('PUNCH IN');
    await expect(punchBtn(page)).toBeEnabled();
    await doPunch('Punched In!');
    await expect(chip(page)).toContainText('WORKING');
    await doPunch('Punched Out!');
    await expect(punchBtn(page)).toHaveAccessibleName('LIMIT REACHED');
    await expect(punchBtn(page)).toBeDisabled();
    await expect(chip(page)).toContainText('COMPLETE');
    await expect(page.getByTestId('punch-state-label')).toHaveText('Max Sessions Reached');
    await snap(page, testInfo, 'staff-home-limit-reached');
    const punches = await mock.requests({ path: '/face/punch', method: 'POST' });
    expect(punches.map((p) => p.body?.action)).toEqual(['punch_in', 'punch_out', 'punch_in', 'punch_out']);
  });

  test('face mismatch: v1 forced retry marks the punch "Sent for admin review"', async ({ page, mock }, testInfo) => {
    await mock.setState({ faceMismatch: true });
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await punchBtn(page).click();
    await capturePunch(page);
    await expect(page.getByTestId('face-result')).toContainText('Punched In!');
    await expect(page.getByText('Sent for admin review')).toBeVisible();
    await snap(page, testInfo, 'face-punch-admin-review');
    const punches = await mock.requests({ path: '/face/punch', method: 'POST' });
    expect(punches).toHaveLength(2);
    expect(punches[0].body?.force_accept).toBeUndefined();
    expect(String(punches[1].body?.force_accept)).toBe('true');
    await page.getByTestId('face-done').click();
    await expect(chip(page)).toContainText('WORKING');
  });

  test('a punch rejected by the server (and not recorded) shows the message and keeps the camera open for a retry', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await punchBtn(page).click();
    await expect(page.getByTestId('face-recognition-modal')).toBeVisible();
    await mock.failNext('/face/punch', { status: 200, body: { success: false, message: 'Face not recognized. Please try again.' }, times: 2 });
    await capturePunch(page);
    await expect(page.getByText(/Face not recognized/)).toBeVisible();
    await expect(page.getByTestId('face-result')).toHaveCount(0);
    await expect(page.getByTestId('face-capture')).toBeVisible();
    // retry works
    await capturePunch(page);
    await expect(page.getByTestId('face-result')).toContainText('Punched In!');
  });

  test('"no face detected" asks the user to centre themselves and does not force-accept', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await punchBtn(page).click();
    await mock.failNext('/face/punch', { status: 200, body: { success: false, message: 'No face detected in the image' } });
    await capturePunch(page);
    await expect(page.getByText(/We couldn’t see your face — fill the oval/)).toBeVisible();
    const punches = await mock.requests({ path: '/face/punch', method: 'POST' });
    expect(punches).toHaveLength(1);
  });

  test('a structured failure code shows specific guidance and does not force-accept', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await punchBtn(page).click();
    await mock.failNext('/face/punch', { status: 200, body: { success: false, code: 'no_face', reason: 'too_dark', message: 'No face detected in the image' } });
    await capturePunch(page);
    await expect(page.getByText(/too dark — move to a brighter place/)).toBeVisible();
    const punches = await mock.requests({ path: '/face/punch', method: 'POST' });
    expect(punches).toHaveLength(1);
  });

  test('tips sheet appears after two failed attempts in a row', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await punchBtn(page).click();
    await mock.failNext('/face/punch', { status: 200, body: { success: false, code: 'no_face', reason: 'no_face', message: 'No face detected' }, times: 2 });
    await capturePunch(page);
    await expect(page.getByTestId('face-tips')).toHaveCount(0);
    await capturePunch(page);
    await expect(page.getByTestId('face-tips')).toBeVisible();
    await page.getByTestId('face-tips-dismiss').click();
    await expect(page.getByTestId('face-tips')).toHaveCount(0);
  });

  test('a holiday shows "No Attendance Needed"', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await mock.failNext('/face/punch', { status: 200, body: { success: false, is_holiday: true, message: 'Today is a holiday (Founders Day). Attendance is not required.' } });
    await punchBtn(page).click();
    await capturePunch(page);
    await expect(page.getByText('No Attendance Needed')).toBeVisible();
    await expect(page.getByText(/Founders Day/)).toBeVisible();
    await page.getByTestId('face-done').click();
    await expect(chip(page)).toContainText('NOT IN');
  });

  test('an expired plan blocks punching with "Feature Unavailable"', async ({ page, mock, issues }) => {
    issues.allow(/\/(group-)?chat\/list\/.* -> 500/); // plan-gated chat badge polls answer 500 "403: ..." like the real backend
    await mock.setPlan('expired');
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await punchBtn(page).click();
    await expect(page.getByText('Feature Unavailable')).toBeVisible();
    await expect(page.getByTestId('face-recognition-modal')).toHaveCount(0);
    expect(await mock.requests({ path: '/face/check-location' })).toHaveLength(0);
  });

  test('without location permission the user is told Location is required', async ({ page, context }) => {
    await context.clearPermissions();
    await context.grantPermissions(['camera', 'microphone']); // geolocation left in the denied/prompt state
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await punchBtn(page).click();
    await expect(page.getByText(/Location Required|Location Error/)).toBeVisible();
    await expect(page.getByTestId('face-recognition-modal')).toHaveCount(0);
  });

  test('admin edits of today are reflected within the 10 s poll (no action needed)', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(chip(page)).toContainText('NOT IN');
    // another device punches the user in
    await mock.setState({});
    const res = await page.request.post(`http://127.0.0.1:${process.env.MOCK_PORT ?? 8787}/face/punch`, {
      headers: { 'x-e2e-tenant': mock.tenant },
      multipart: { user_id: USERS.staff.userId, org_id: 'org-0001', action: 'punch_in', face: { name: 'f.png', mimeType: 'image/png', buffer: Buffer.from('x') } },
    });
    expect(res.ok()).toBe(true);
    await expect(chip(page)).toContainText('WORKING', { timeout: 20_000 });
  });
});

test.describe('field staff tracking', () => {
  test('punched-in field staff upload their location; punching out stops the uploads', async ({ page, mock }) => {
    await loginAs(page, 'fieldStaff');
    await visit(page, '/staff/home');
    const first = await mock.waitForRequest('/staff-location/log', { method: 'POST', timeout: 20_000 });
    expect(first.body).toMatchObject({ user_id: USERS.fieldStaff.userId });
    expect(Number(first.body?.latitude)).toBeCloseTo(BRANCHES.hq.latitude, 3);
    expect(first.status).toBe(200);

    await expect(punchBtn(page)).toHaveAccessibleName('PUNCH OUT');
    // the punch-out happens elsewhere (admin edit / other device); the 10 s poll picks it up and tracking stops
    const out = await page.request.post(`http://127.0.0.1:${process.env.MOCK_PORT ?? 8787}/face/punch`, {
      headers: { 'x-e2e-tenant': mock.tenant },
      multipart: { user_id: USERS.fieldStaff.userId, org_id: 'org-0001', action: 'punch_out', face: { name: 'f.png', mimeType: 'image/png', buffer: Buffer.from('x') } },
    });
    expect(out.ok()).toBe(true);
    await expect(chip(page)).toContainText('COMPLETE', { timeout: 20_000 });
    const stopped = (await mock.requests({ path: '/staff-location/log' })).length;
    // moving does not produce further uploads once tracking stopped
    await page.context().setGeolocation({ latitude: 12.972, longitude: 77.595 });
    await expect.poll(async () => (await mock.requests({ path: '/staff-location/log' })).length, { timeout: 4_000 }).toBe(stopped);
  });

  test('office staff never upload location', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await page.context().setGeolocation({ latitude: 12.972, longitude: 77.595 });
    await expect(chip(page)).toContainText('NOT IN');
    expect(await mock.requests({ path: '/staff-location/log' })).toHaveLength(0);
  });
});
