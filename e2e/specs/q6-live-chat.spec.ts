/**
 * Q6 - Live Chat (org admin <-> Clockyn support), app side.
 *
 * The admin's Support tab -> Live Chat: empty state, optimistic send with ticks, a support reply that arrives live
 * (agent name, Support-tab badge while away, cleared on open), attachments, the closed-by-support banner, and the
 * admin-only gating (managers / staff have no Support tab and cannot open the route). The support side is simulated by
 * the mock's test hooks (`/__test/live-chat/support-reply|support-read`) - the real console is covered elsewhere.
 */
import type { Page } from '@playwright/test';

import { expect, loginAs, test, USERS, visit } from '../support';
import { mockApi } from '../support/q2';
import { snap } from '../support/q3';

const ORG_ID = 'org-0001';
const ADMIN = USERS.admin.userId;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/** The Support entry of the bottom bar (phone) or the sidebar (desktop). */
const supportNav = (page: Page) => page.locator('[data-testid="tab-support"], [data-testid="sidebar-support"]');
const list = (page: Page) => page.getByTestId('message-list');

const supportReply = (tenant: string, body: Record<string, unknown>) => mockApi(tenant, 'POST', '/__test/live-chat/support-reply', { org_id: ORG_ID, ...body });
const supportRead = (tenant: string) => mockApi(tenant, 'POST', '/__test/live-chat/support-read', { org_id: ORG_ID });

async function openLiveChat(page: Page): Promise<void> {
  await supportNav(page).click();
  await expect(page.getByTestId('support-hub-screen')).toBeVisible();
  await page.getByTestId('support-live-chat').click();
  await expect(page.getByTestId('live-chat-screen')).toBeVisible();
  await expect(page.getByTestId('chat-input')).toBeVisible();
}

async function send(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-input').fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
}

test.describe('Live Chat (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('Support -> Live Chat shows the empty state before anything was written', async ({ page }, testInfo) => {
    await visit(page, '/admin/home');
    await openLiveChat(page);
    await expect(page.getByText('Start a conversation')).toBeVisible();
    await expect(page.getByText('Our support team will reply here.')).toBeVisible();
    await expect(page.getByTestId('live-chat-closed-banner')).toHaveCount(0);
    await snap(page, testInfo, 'live-chat-empty');
  });

  test('a sent message appears at once, is stored with the sender and shows a tick; support reading turns it to Read', async ({ page, mock }, testInfo) => {
    await visit(page, '/admin/help/live-chat');
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await send(page, 'Our payroll export is empty');
    await expect(list(page).getByText('Our payroll export is empty')).toBeVisible();
    const call = await mock.waitForRequest('/live-chat/send', { method: 'POST' });
    expect(call.body).toMatchObject({ org_id: ORG_ID, user_id: ADMIN, message: 'Our payroll export is empty' });
    await expect(page.getByLabel('Sending')).toHaveCount(0);
    await expect(list(page).getByLabel('Sent')).toHaveCount(1);
    await expect(list(page).getByText('Our payroll export is empty')).toHaveCount(1);

    await mock.waitForSocket(ADMIN);
    await supportRead(mock.tenant);
    await expect(list(page).getByLabel('Read')).toBeVisible();
    await snap(page, testInfo, 'live-chat-sent');
  });

  test('a support reply arrives live with the agent name and is marked read while the chat is open', async ({ page, mock }, testInfo) => {
    await visit(page, '/admin/help');
    await page.getByTestId('support-live-chat').click();
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await mock.waitForSocket(ADMIN);
    await supportReply(mock.tenant, { message: 'Hi, this is Priya. Let me check.', agent_name: 'Priya (Clockyn Support)' });
    await expect(list(page).getByText('Hi, this is Priya. Let me check.')).toBeVisible();
    await expect(list(page).getByText('Priya (Clockyn Support)')).toBeVisible();
    await mock.waitForRequest('/live-chat/mark-read', { method: 'PUT' });
    await snap(page, testInfo, 'live-chat-reply');
    // it was read while open, so nothing is left unread on the Support hub (the phone hides the tab bar on this screen)
    await page.goBack();
    await expect(page.getByTestId('support-hub-screen')).toBeVisible();
    await expect(page.getByTestId('support-live-chat-badge')).toHaveCount(0);
  });

  test('a reply while the admin is elsewhere raises the Support badge; opening Live Chat clears it', async ({ page, mock }, testInfo) => {
    await visit(page, '/admin/home');
    await mock.waitForSocket(ADMIN);
    await expect(supportNav(page)).toHaveAttribute('aria-label', 'Support');
    await supportReply(mock.tenant, { message: 'Are you still there?' });
    await supportReply(mock.tenant, { message: 'We found the issue.' });
    await expect(supportNav(page)).toHaveAttribute('aria-label', 'Support, 2 unread');
    await snap(page, testInfo, 'live-chat-badge');

    await supportNav(page).click();
    await expect(page.getByTestId('support-live-chat-badge')).toBeVisible();
    await page.getByTestId('support-live-chat').click();
    await expect(list(page).getByText('We found the issue.')).toBeVisible();
    await mock.waitForRequest('/live-chat/mark-read', { method: 'PUT' });
    await page.goBack();
    await expect(supportNav(page)).toHaveAttribute('aria-label', 'Support');
    await expect(page.getByTestId('support-live-chat-badge')).toHaveCount(0);
  });

  test('an unread reply from before the app was opened is on the Support badge right after sign-in', async ({ page, mock }) => {
    await supportReply(mock.tenant, { message: 'Sorry for the delay on your ticket.' });
    await visit(page, '/admin/home');
    await expect(supportNav(page)).toHaveAttribute('aria-label', 'Support, 1 unread');
  });

  test('image and document attachments are uploaded as multipart parts and shown as bubbles', async ({ page, mock }, testInfo) => {
    await visit(page, '/admin/help/live-chat');
    await expect(page.getByTestId('chat-input')).toBeVisible();

    await page.getByRole('button', { name: 'Attach a file' }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('Photo library', { exact: true }).click();
    (await chooser).setFiles({ name: 'screen.png', mimeType: 'image/png', buffer: PNG });
    const imgCall = await mock.waitForRequest('/live-chat/send-file', { method: 'POST' });
    expect(imgCall.files?.[0]).toMatchObject({ field: 'file' });
    expect(imgCall.files?.[0].mimetype).toMatch(/^image\//);
    await expect(page.getByLabel('Open photo').last()).toBeVisible();

    await page.getByRole('button', { name: 'Attach a file' }).click();
    const chooser2 = page.waitForEvent('filechooser');
    await page.getByText('Document', { exact: true }).click();
    (await chooser2).setFiles({ name: 'invoice-oct.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
    await expect(list(page).getByText('invoice-oct.pdf')).toBeVisible();
    // the bubble is optimistic, so wait for the upload itself
    const docCall = await mock.waitForRequest('/live-chat/send-file', { method: 'POST', predicate: (r) => r.files?.[0]?.filename === 'invoice-oct.pdf' });
    expect(docCall.files?.[0]).toMatchObject({ field: 'file' });
    await snap(page, testInfo, 'live-chat-attachments');
  });

  test('a failed send shows Retry and the retry reaches the server', async ({ page, mock, issues }) => {
    issues.allow(/live-chat\/send/);
    await visit(page, '/admin/help/live-chat');
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await mock.failNext('/live-chat/send', { method: 'POST', status: 500 });
    await send(page, 'Please call me');
    await expect(page.getByText('Failed to send').first()).toBeVisible();
    await page.getByText('Retry', { exact: true }).click();
    await expect(page.getByText('Failed to send')).toHaveCount(0);
    await expect(list(page).getByText('Please call me')).toHaveCount(1);
    expect((await mock.requests({ path: '/live-chat/send', method: 'POST' })).length).toBe(2);
  });

  test('a conversation closed by support shows the banner; writing again reopens it', async ({ page, mock }, testInfo) => {
    await supportReply(mock.tenant, { message: 'All sorted - closing this chat.', status: 'closed' });
    await visit(page, '/admin/help/live-chat');
    await expect(page.getByTestId('live-chat-closed-banner')).toBeVisible();
    await expect(page.getByText('This conversation was closed by support. Send a message to reopen it.')).toBeVisible();
    await snap(page, testInfo, 'live-chat-closed');
    await send(page, 'One more question');
    await expect(page.getByTestId('live-chat-closed-banner')).toHaveCount(0);
    await expect(list(page).getByText('One more question')).toBeVisible();
  });

  test('the history survives a reload', async ({ page, mock }) => {
    await supportReply(mock.tenant, { message: 'Welcome to Clockyn support.', agent_name: 'Arjun' });
    await visit(page, '/admin/help/live-chat');
    await expect(list(page).getByText('Welcome to Clockyn support.')).toBeVisible();
    await send(page, 'Thanks Arjun');
    await expect(list(page).getByLabel('Sent')).toHaveCount(1);
    await page.reload();
    await expect(list(page).getByText('Welcome to Clockyn support.')).toBeVisible();
    await expect(list(page).getByText('Thanks Arjun')).toHaveCount(1);
  });
});

test.describe('Live Chat is for the admin only', () => {
  for (const role of ['manager', 'staff'] as const) {
    test(`${role}: no Support tab and /admin/help/live-chat is not reachable`, async ({ page }) => {
      await loginAs(page, role);
      await visit(page, '/staff/home');
      await expect(supportNav(page)).toHaveCount(0);
      await expect(page.getByText('Support', { exact: true })).toHaveCount(0);

      await visit(page, '/admin/help/live-chat');
      await page.waitForURL('**/staff/home');
      await expect(page.getByTestId('chat-input')).toHaveCount(0);
      await expect(page.getByTestId('live-chat-screen')).toHaveCount(0);

      await visit(page, '/admin/help');
      await page.waitForURL('**/staff/home');
      await expect(page.getByTestId('support-hub-screen')).toHaveCount(0);

      await visit(page, '/staff/help');
      await expect(page.getByTestId('support-hub-screen')).toHaveCount(0);
    });
  }

  test('the admin sees the Support entry', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    await expect(supportNav(page)).toBeVisible();
  });
});
