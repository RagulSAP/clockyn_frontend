/**
 * Q3 - Overlays and badges of the staff home: request badge, birthday popup, permission onboarding (once per user),
 * rate-prompt counter (the prompt itself needs a store URL, which web builds never have).
 */
import { expect, loginAs, STORAGE, test, USERS, visit } from '../support';
import { snap } from '../support/q3';

test.describe('request badge', () => {
  test('the Requests quick action shows how many requests are still pending, and clears when there are none', async ({ page, mock }, testInfo) => {
    const fx = await mock.fixtures();
    const pending = fx.requests.filter((r) => r.userId === USERS.staff.userId && r.status === 'pending').length;
    expect(pending).toBeGreaterThan(0);
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(page.getByTestId('quick-requests-badge')).toHaveText(String(pending));
    await expect(page.getByTestId('quick-requests')).toHaveAccessibleName(new RegExp(`${pending} pending`));
    await snap(page, testInfo, 'staff-home-request-badge');
  });

  test('a user without pending requests sees no badge', async ({ page }) => {
    await loginAs(page, 'fieldStaff');
    await visit(page, '/staff/home');
    await expect(page.getByTestId('quick-requests')).toBeVisible();
    await expect(page.getByTestId('quick-requests-badge')).toHaveCount(0);
  });
});

test.describe('birthday popup', () => {
  test('lists colleagues with a birthday today, closes with Close and does not return on re-focus', async ({ page, mock }, testInfo) => {
    await mock.setState({ birthdays: ['stf-0003', 'stf-0006'] });
    const fx = await mock.fixtures();
    const names = fx.staff.filter((s) => ['stf-0003', 'stf-0006'].includes(s.user_id)).map((s) => s.name);
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    const lines = page.getByTestId('birthday-line');
    await expect(lines).toHaveCount(2);
    for (const n of names) await expect(page.getByText(`Today is ${n}'s birthday. Wish them a wonderful birthday!`)).toBeVisible();
    await snap(page, testInfo, 'staff-home-birthday');
    await page.getByTestId('birthday-close').click();
    await expect(lines).toHaveCount(0);
    // leaving and coming back inside the same app run does not re-open it
    await page.getByTestId('quick-attendance').click();
    await page.waitForURL('**/staff/attendance');
    await page.getByRole('button', { name: /back/i }).first().click();
    await page.waitForURL('**/staff/home');
    await expect(page.getByTestId('punch-button')).toBeVisible();
    await expect(page.getByTestId('birthday-line')).toHaveCount(0);
  });

  test('no birthdays, no popup', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(page.getByTestId('punch-button')).toBeVisible();
    await expect(page.getByTestId('birthday-line')).toHaveCount(0);
  });
});

test.describe('permission onboarding', () => {
  test('first launch walks through intro and four steps once; a returning user is not asked again', async ({ page }, testInfo) => {
    await loginAs(page, 'staff', { showOnboarding: true });
    await visit(page, '/staff/home');
    const modal = page.getByTestId('permission-onboarding');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await snap(page, testInfo, 'permission-onboarding-intro');
    await page.getByTestId('onboarding-primary').click(); // Continue
    await expect(page.getByText('Location Access')).toBeVisible();
    await expect(page.getByText('STEP 1 OF 4')).toBeVisible();
    await page.getByTestId('onboarding-primary').click();
    await expect(page.getByText('Camera Access')).toBeVisible();
    await page.getByTestId('onboarding-primary').click();
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible();
    await page.getByTestId('onboarding-not-now').click();
    await expect(page.getByText('Photo Library')).toBeVisible();
    await expect(page.getByTestId('onboarding-primary')).toHaveText('Finish');
    await page.getByTestId('onboarding-primary').click();
    await expect(modal).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), `${STORAGE.onboardingDone}:${USERS.staff.userId}`)).toBe('true');
    await page.clock.install();
    await page.reload();
    await expect(page.getByTestId('punch-button')).toBeVisible();
    await page.clock.fastForward(5_000); // the intro would have appeared after its 1.5 s delay
    await expect(modal).toHaveCount(0);
  });

  test('Skip marks it done; it cannot be dismissed with Escape', async ({ page }) => {
    await loginAs(page, 'staff', { showOnboarding: true });
    await visit(page, '/staff/home');
    const modal = page.getByTestId('permission-onboarding');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(modal).toBeVisible();
    await page.getByTestId('onboarding-skip-now').click();
    await expect(modal).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), `${STORAGE.onboardingDone}:${USERS.staff.userId}`)).toBe('true');
  });

  test('completion is per user: another account on the same device still sees the intro', async ({ page }) => {
    await loginAs(page, 'fieldStaff', { showOnboarding: true, storage: { [`${STORAGE.onboardingDone}:${USERS.staff.userId}`]: 'true' } });
    await visit(page, '/staff/home');
    await expect(page.getByTestId('permission-onboarding')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('rate prompt cadence', () => {
  test('each home mount counts one open; web has no store listing so the prompt itself never opens', async ({ page }) => {
    await loginAs(page, 'staff', { storage: { [STORAGE.rateAppDone]: 'false' } });
    await visit(page, '/staff/home');
    await expect(page.getByTestId('punch-button')).toBeVisible();
    const count = () => page.evaluate((k) => Number(localStorage.getItem(k) ?? 0), '@clockyn/rate-app-open-count');
    await expect.poll(count).toBe(1);
    await page.reload();
    await expect(page.getByTestId('punch-button')).toBeVisible();
    await expect.poll(count).toBe(2);
    // returning from a sub-screen is not a new open
    await page.getByTestId('quick-attendance').click();
    await page.waitForURL('**/staff/attendance');
    await page.getByRole('button', { name: /back/i }).first().click();
    await page.waitForURL('**/staff/home');
    expect(await count()).toBe(2);
    await page.reload();
    await expect(page.getByTestId('punch-button')).toBeVisible();
    await expect.poll(count).toBe(3); // 3rd open: due, but there is no store URL on web
    await expect(page.getByTestId('rate-app-modal')).toHaveCount(0);
  });
});
