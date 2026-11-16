/**
 * Q1b - More options (privacy policy, request account deletion), App permissions and Suggest a feature (the old support-ticket screen was removed: Live Chat replaced it).
 */
import type { Page } from '@playwright/test';

import { expect, expectToast, loginAs, readSession, USERS, visit, test } from '../support';
import { hasHorizontalOverflow, snapBoth } from '../support/q1';

/** Navigate to a screen through the hub so `router.back()` has a real history entry. */
async function viaHub(page: Page, section: string, item: string): Promise<void> {
  await visit(page, '/admin/settings');
  await page.getByTestId(`section-header-${section}`).click();
  await page.getByTestId(`item-${item}`).click();
}

test.describe('Q1b more options', () => {
  test('menu lists Privacy Policy; with no URL configured the page shows the "not configured" state and keeps the deletion button', async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/more');
    await expect(page.getByTestId('more-screen')).toBeVisible();
    await snapBoth(page, testInfo, 'more-menu');
    await page.getByTestId('open-privacy').click();
    await expect(page.getByTestId('privacy-screen')).toBeVisible();
    await expect(page.getByTestId('privacy-not-configured')).toContainText('Privacy policy unavailable');
    await expect(page.getByTestId('privacy-not-configured')).toContainText('has not been configured');
    await expect(page.getByTestId('privacy-webpage')).toHaveCount(0);
    await expect(page.getByTestId('request-deletion')).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await snapBoth(page, testInfo, 'more-privacy-unconfigured');
    // the in-screen back returns to the menu, not out of the route
    await page.getByTestId('privacy-back').click();
    await expect(page.getByTestId('more-screen')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/admin/more');
  });

  test('request account deletion: Cancel does nothing; Submit posts once, shows the server message and signs out after ~1.5 s', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/more');
    await page.getByTestId('open-privacy').click();
    await page.getByTestId('request-deletion').click();
    await expect(page.getByText('Your deletion request will be sent to the admin.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(await mock.requests({ path: '/company/request-deletion' })).toHaveLength(0);
    expect(await readSession(page)).not.toBeNull();

    await page.getByTestId('request-deletion').click();
    await page.getByRole('button', { name: 'Submit Request' }).click();
    await expectToast(page, 'Account deletion request submitted.');
    const calls = await mock.requests({ path: `/company/request-deletion/${USERS.admin.userId}`, method: 'POST' });
    expect(calls).toHaveLength(1);
    await expect(page.getByTestId('request-deletion')).toBeDisabled(); // no double submit
    await page.waitForURL((u) => u.pathname === '/', { timeout: 15_000 });
    expect(await readSession(page)).toBeNull();
    expect(await mock.requests({ path: '/company/request-deletion' })).toHaveLength(1);
  });

  test('request account deletion failure: error toast with the server detail, still signed in, can retry', async ({ page, mock, issues }) => {
    issues.allow(/request-deletion/);
    await loginAs(page, 'admin');
    await mock.failNext('/company/request-deletion/*', { status: 500, body: { detail: 'Deletion service unavailable' } });
    await visit(page, '/admin/more');
    await page.getByTestId('open-privacy').click();
    await page.getByTestId('request-deletion').click();
    await page.getByRole('button', { name: 'Submit Request' }).click();
    await expectToast(page, 'Deletion service unavailable');
    await expect(page.getByTestId('request-deletion')).toBeEnabled();
    expect(await readSession(page)).not.toBeNull();
    expect(new URL(page.url()).pathname).toBe('/admin/more');
    // retry succeeds
    await page.getByTestId('request-deletion').click();
    await page.getByRole('button', { name: 'Submit Request' }).click();
    await expectToast(page, 'Account deletion request submitted.');
    await page.waitForURL((u) => u.pathname === '/', { timeout: 15_000 });
  });
});

test.describe('Q1b app permissions (web)', () => {
  test('status rows: location, camera and photos are ON (granted by the harness), notifications OFF with an Allow button', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      // headless Chromium reports 'denied'; pin the undecided state so the Allow button is deterministic
      Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true });
    });
    await loginAs(page, 'admin');
    await visit(page, '/admin/permissions');
    await expect(page.getByTestId('permissions-screen')).toBeVisible();
    for (const k of ['location', 'camera', 'photos']) {
      await expect(page.getByTestId(`permission-state-${k}`)).toHaveText('ON');
      await expect(page.getByTestId(`permission-action-${k}`)).toHaveCount(0);
    }
    await expect(page.getByTestId('permission-state-notifications')).toHaveText('OFF');
    await expect(page.getByTestId('permission-action-notifications')).toHaveText('Allow');
    await expect(page.getByTestId('permissions-pill')).toHaveText('1 Pending');
    await expect(page.getByText('3 of 4 permissions granted')).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await snapBoth(page, testInfo, 'permissions-partial');
  });

  test('Allow on notifications asks the browser; once granted the card flips to ON and the pill to "All Active"', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      let perm: NotificationPermission = 'default';
      Object.defineProperty(Notification, 'permission', { get: () => perm, configurable: true });
      Notification.requestPermission = async () => {
        perm = 'granted';
        return perm;
      };
    });
    await loginAs(page, 'admin');
    await visit(page, '/admin/permissions');
    await page.getByTestId('permission-action-notifications').click();
    await expect(page.getByTestId('permission-state-notifications')).toHaveText('ON');
    await expect(page.getByTestId('permission-action-notifications')).toHaveCount(0);
    await expect(page.getByTestId('permissions-pill')).toHaveText('All Active');
    await expect(page.getByText('4 of 4 permissions granted')).toBeVisible();
    await snapBoth(page, testInfo, 'permissions-all');
  });

  test('a blocked permission explains how to change it in the browser (no OS settings on web)', async ({ page, context }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Notification, 'permission', { get: () => 'denied', configurable: true });
    });
    await loginAs(page, 'admin');
    await visit(page, '/admin/permissions');
    await expect(page.getByTestId('permission-action-notifications')).toHaveText('How to enable');
    await page.getByTestId('permission-action-notifications').click();
    await expectToast(page, "Allow notifications for this site in your browser's site settings, then reload the page.");
    // revoking location in the browser is picked up on the next visit
    await context.clearPermissions();
    await visit(page, '/admin/permissions');
    await expect(page.getByTestId('permission-state-camera')).toHaveText('OFF');
    await expect(page.getByTestId('permission-action-camera')).toBeVisible();
  });
});

test.describe('Q1b suggest a feature', () => {
  test('validation (subject first), counters / limits, success payload and return to the hub', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await viaHub(page, 'beyond', 'suggest');
    await expect(page.getByTestId('suggest-screen')).toBeVisible();
    await snapBoth(page, testInfo, 'suggest');
    await page.getByTestId('suggest-submit').click();
    await expectToast(page, 'Please enter a subject');
    await page.getByTestId('suggest-subject').fill('Dark mode for reports');
    await page.getByTestId('suggest-submit').click();
    await expectToast(page, 'Please enter your message');
    expect(await mock.requests({ path: '/company/suggest-feature' })).toHaveLength(0);
    // limits: 120 / 1000
    await page.getByTestId('suggest-subject').fill('x'.repeat(150));
    await expect(page.getByTestId('suggest-subject')).toHaveValue('x'.repeat(120));
    await page.getByTestId('suggest-message').fill('y'.repeat(1100));
    await expect(page.getByTestId('suggest-message')).toHaveValue('y'.repeat(1000));
    await expect(page.getByText('1000/1000')).toBeVisible();
    await page.getByTestId('suggest-subject').fill('  Dark mode for reports  ');
    await page.getByTestId('suggest-message').fill('Please add a dark theme to exports.');
    await page.getByTestId('suggest-submit').click();
    await expectToast(page, 'Thank you! Your suggestion has been sent.');
    const rec = await mock.waitForRequest('/company/suggest-feature', { method: 'POST' });
    expect(rec.body).toMatchObject({ subject: 'Dark mode for reports', content: 'Please add a dark theme to exports.', org_id: 'org-0001', company_name: 'Acme Traders', user_email: USERS.admin.email });
    await page.waitForURL((u) => u.pathname === '/admin/settings', { timeout: 10_000 });
  });

  test('server error text surfaces and the form is kept', async ({ page, mock, issues }) => {
    issues.allow(/suggest-feature/);
    await loginAs(page, 'admin');
    await mock.failNext('/company/suggest-feature', { status: 500, body: { detail: 'Mailbox unavailable' } });
    await visit(page, '/admin/suggest-feature');
    await page.getByTestId('suggest-subject').fill('Idea');
    await page.getByTestId('suggest-message').fill('Body');
    await page.getByTestId('suggest-submit').click();
    await expectToast(page, 'Mailbox unavailable');
    await expect(page.getByTestId('suggest-message')).toHaveValue('Body');
    expect(new URL(page.url()).pathname).toBe('/admin/suggest-feature');
  });
});
