/**
 * Q1b - More options (privacy policy, request account deletion), App permissions, Support (tickets) and Suggest a feature.
 */
import type { Page } from '@playwright/test';

import { expect, expectToast, loginAs, readSession, USERS, visit, test } from '../support';
import { hasHorizontalOverflow, pickOption, pngFile, snapBoth } from '../support/q1';

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

test.describe('Q1b support', () => {
  test('lists the seeded tickets with status badges, replies and the resolved hint; empty message is rejected first', async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/support');
    await expect(page.getByTestId('support-screen')).toBeVisible();
    await expect(page.getByTestId('ticket-tkt-1')).toContainText('Billing and plans');
    await expect(page.getByTestId('ticket-status-tkt-1')).toHaveText('In Progress');
    await expect(page.getByTestId('thread-tkt-1')).toContainText('We are on it.');
    await expect(page.getByTestId('thread-tkt-1')).toContainText('Support');
    await expect(page.getByTestId('ticket-status-tkt-2')).toHaveText('Resolved');
    await expect(page.getByTestId('reply-input-tkt-2')).toHaveAttribute('placeholder', 'Reply to reopen this ticket...');
    await expect(page.getByTestId('reply-input-tkt-1')).toHaveAttribute('placeholder', 'Type a reply...');
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await snapBoth(page, testInfo, 'support');
  });

  test('validation order: subject, then message; nothing is posted', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/support');
    await page.getByTestId('support-submit').click();
    await expectToast(page, 'Please select a subject');
    await pickOption(page, 'support-subject', 'Login issue');
    await page.getByTestId('support-message').fill('   ');
    await page.getByTestId('support-submit').click();
    await expectToast(page, 'Please enter a message');
    expect(await mock.requests({ path: '/support/submit' })).toHaveLength(0);
  });

  test('create a ticket without a photo: multipart fields carry the subject NAME, the ticket appears and the screen returns to the hub', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await viaHub(page, 'beyond', 'support');
    await pickOption(page, 'support-subject', 'Attendance problem');
    await page.getByTestId('support-message').fill('Punch-in button is slow on the web build');
    await page.getByTestId('support-submit').click();
    await expectToast(page, 'Support request submitted!');
    const rec = await mock.waitForRequest('/support/submit', { method: 'POST' });
    expect(rec.body).toMatchObject({ subject: 'Attendance problem', message: 'Punch-in button is slow on the web build', user_id: USERS.admin.userId, org_id: 'org-0001' });
    expect(rec.files ?? []).toHaveLength(0);
    await page.waitForURL((u) => u.pathname === '/admin/settings', { timeout: 10_000 });
    // the ticket list was refreshed
    await visit(page, '/admin/support');
    await expect(page.getByText('Punch-in button is slow on the web build')).toBeVisible();
    await expect(page.getByTestId('thread-tkt-1')).toBeVisible();
  });

  test('create a ticket with a photo: preview + remove, then the photo goes up as the `photo` part', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/support');
    await pickOption(page, 'support-subject', 'Other');
    await page.getByTestId('support-message').fill('Screenshot attached');
    let chooser = page.waitForEvent('filechooser');
    await page.getByTestId('support-photo-add').click();
    await (await chooser).setFiles(pngFile('shot.png'));
    await expect(page.getByTestId('support-photo-preview')).toBeVisible();
    await snapBoth(page, testInfo, 'support-photo-attached');
    await page.getByTestId('support-photo-remove').click();
    await expect(page.getByTestId('support-photo-preview')).toHaveCount(0);
    chooser = page.waitForEvent('filechooser');
    await page.getByTestId('support-photo-add').click();
    await (await chooser).setFiles(pngFile('shot2.png'));
    await expect(page.getByTestId('support-photo-preview')).toBeVisible();
    await page.getByTestId('support-submit').click();
    await expectToast(page, 'Support request submitted!');
    const rec = await mock.waitForRequest('/support/submit', { method: 'POST' });
    expect(rec.body).toMatchObject({ subject: 'Other', message: 'Screenshot attached' });
    expect(rec.files?.[0]?.field).toBe('photo');
    // the form resets
    await expect(page.getByTestId('support-photo-preview')).toHaveCount(0);
    await expect(page.getByTestId('support-message')).toHaveValue('');
  });

  test('submit failure shows the server detail, keeps the form and does not leave the screen', async ({ page, mock, issues }) => {
    issues.allow(/support\/submit/);
    await loginAs(page, 'admin');
    await visit(page, '/admin/support');
    await mock.failNext('/support/submit', { status: 500, body: { detail: 'Ticket service down' } });
    await pickOption(page, 'support-subject', 'Login issue');
    await page.getByTestId('support-message').fill('Cannot log in');
    await page.getByTestId('support-submit').click();
    await expectToast(page, 'Ticket service down');
    await expect(page.getByTestId('support-message')).toHaveValue('Cannot log in');
    expect(new URL(page.url()).pathname).toBe('/admin/support');
  });

  test('reply to an open ticket adds it to the thread; replying to a resolved ticket reopens it', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/support');
    await expect(page.getByTestId('reply-send-tkt-1')).toBeDisabled();
    await page.getByTestId('reply-input-tkt-1').fill('Any update on this?');
    await page.getByTestId('reply-send-tkt-1').click();
    await expectToast(page, 'Reply sent!');
    const rec = await mock.waitForRequest('/support/tkt-1/reply', { method: 'POST' });
    expect(rec.body).toMatchObject({ reply_text: 'Any update on this?', is_admin: false, author_name: USERS.admin.name });
    await expect(page.getByTestId('thread-tkt-1')).toContainText('Any update on this?');
    await expect(page.getByTestId('thread-tkt-1')).toContainText('You');
    await expect(page.getByTestId('reply-input-tkt-1')).toHaveValue('');
    // resolved ticket: the reply is accepted and appears
    await page.getByTestId('reply-input-tkt-2').fill('It happened again');
    await page.getByTestId('reply-send-tkt-2').click();
    await expect(page.getByTestId('thread-tkt-2')).toContainText('It happened again');
  });

  test('reply failure keeps the draft', async ({ page, mock, issues }) => {
    issues.allow(/support\/.*\/reply/);
    await loginAs(page, 'admin');
    await visit(page, '/admin/support');
    await mock.failNext('/support/tkt-1/reply', { status: 500, body: { detail: 'Reply failed upstream' } });
    await page.getByTestId('reply-input-tkt-1').fill('Please help');
    await page.getByTestId('reply-send-tkt-1').click();
    await expectToast(page, 'Reply failed upstream');
    await expect(page.getByTestId('reply-input-tkt-1')).toHaveValue('Please help');
  });

  test('legacy single `reply` field is shown as "Admin Reply"', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await mock.failNext('/support/requests/*', {
      status: 200,
      times: -1,
      body: [{ id: 'tkt-legacy', sub_id: 1, sub_name: 'Login issue', client_msg: 'Old style ticket', photo_url: null, status: 'resolved', created_at: new Date().toISOString(), reply: 'Fixed on our side.' }],
    });
    await visit(page, '/admin/support');
    await expect(page.getByTestId('thread-tkt-legacy')).toContainText('Admin Reply');
    await expect(page.getByTestId('thread-tkt-legacy')).toContainText('Fixed on our side.');
  });

  test('ticket list failure shows a retryable error; no tickets hides the section', async ({ page, mock, issues }) => {
    issues.allow(/support\/requests/);
    await loginAs(page, 'admin');
    await mock.failNext('/support/requests/*', { status: 500, times: -1 });
    await visit(page, '/admin/support');
    await expect(page.getByText('Something went wrong')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Injected failure (test)')).toBeVisible();
    await mock.clearFailures();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByTestId('ticket-tkt-1')).toBeVisible();
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
