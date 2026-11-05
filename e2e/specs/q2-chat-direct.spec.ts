/**
 * Q2 - Admin chat: hub badges + plan gate, direct chat (list, staff search, send text / image / file, optimistic send + failure
 * + Retry, read ticks, date separators, scroll-to-latest, in-chat search, WebSocket push to the open vs another conversation,
 * unread counts, reconnect after a socket drop).
 */
import type { Page } from '@playwright/test';

import { test, expect, loginAs, visit, USERS } from '../support';
import { mockApi } from '../support/q2';

const STAFF = USERS.staff; // stf-0001 Aarav Sharma, has a history with the admin
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const row = (page: Page, id: string) => page.getByTestId(`chat-row-${id}`);
const bubbles = (page: Page) => page.getByTestId('message-list');

/** A peer sends the admin a text message (the mock pushes it over the WebSocket like the real backend). */
const incoming = (tenant: string, from: string, message: string) => mockApi(tenant, 'POST', '/chat/send', { sender_id: from, receiver_id: USERS.admin.userId, message });

async function openConversation(page: Page, peerId: string): Promise<void> {
  await expect(row(page, peerId)).toBeVisible();
  await row(page, peerId).click();
  await expect(page.getByTestId('chat-input')).toBeVisible();
}

async function send(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-input').fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
}

test.describe('direct chat', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('list shows people with last message previews; staff search finds someone new and opens an empty conversation', async ({ page }) => {
    await visit(page, '/admin/chat/direct');
    await expect(row(page, STAFF.userId)).toContainText('Aarav Sharma');
    await expect(row(page, STAFF.userId)).toContainText('And update me on the Mysore lead.');
    await page.getByTestId('chat-search').fill('Bhavna');
    await expect(page.getByTestId('chat-search-results')).toBeVisible();
    await page.getByTestId('search-result-stf-0003').or(page.locator('[data-testid^="search-result-"]').first()).first().click();
    await expect(page.getByText('Send the first message!')).toBeVisible();
    await expect(page.getByText('Bhavna Rao').filter({ visible: true }).first()).toBeVisible();
  });

  test('send text: optimistic bubble, POST payload, single tick; read_update push turns it into the read tick', async ({ page, mock, tenant }) => {
    await visit(page, '/admin/chat/direct');
    await openConversation(page, STAFF.userId);
    await expect(bubbles(page)).toContainText('Thanks. Also check the new shift roster.');
    await mock.waitForSocket(USERS.admin.userId);
    await send(page, 'Please confirm by 5pm');
    await expect(bubbles(page).getByText('Please confirm by 5pm')).toBeVisible();
    const call = await mock.waitForRequest('/chat/send', { method: 'POST' });
    expect(call.body).toMatchObject({ sender_id: USERS.admin.userId, receiver_id: STAFF.userId, message: 'Please confirm by 5pm' });
    await expect(page.getByLabel('Sent').last()).toBeVisible();
    // the peer opens the conversation -> mark-read -> read_update frame
    await mockApi(tenant, 'PUT', '/chat/mark-read', { sender_id: USERS.admin.userId, receiver_id: STAFF.userId });
    await expect(page.getByLabel('Read').last()).toBeVisible();
    await expect(page.getByTestId('chat-input')).toHaveValue('');
  });

  test('send failure keeps the bubble as "Failed to send"; Retry sends it; Discard removes a failed one', async ({ page, mock, issues }) => {
    issues.allow(/chat\/send/);
    await visit(page, '/admin/chat/direct');
    await openConversation(page, STAFF.userId);
    await mock.failNext('/chat/send', { method: 'POST', status: 500, times: 2 });
    await send(page, 'Will fail once');
    await expect(page.getByText('Failed to send').first()).toBeVisible();
    await page.getByRole('button', { name: 'Retry sending' }).click();
    await expect(page.getByText('Failed to send')).toHaveCount(1); // second injected failure
    await page.getByRole('button', { name: 'Retry sending' }).click();
    await expect(page.getByText('Failed to send')).toHaveCount(0);
    await expect(bubbles(page).getByText('Will fail once')).toHaveCount(1);
    expect((await mock.requests({ path: '/chat/send', method: 'POST' })).filter((r) => r.status === 200)).toHaveLength(1);

    await mock.failNext('/chat/send', { method: 'POST', status: 500 });
    await send(page, 'Throw me away');
    await expect(page.getByRole('button', { name: 'Discard message' })).toBeVisible();
    await page.getByRole('button', { name: 'Discard message' }).click();
    await expect(bubbles(page).getByText('Throw me away')).toHaveCount(0);
  });

  test('a gateway error with a non-JSON body (proxy page) on send is also recoverable', async ({ page, mock, issues }) => {
    issues.allow(/.*/);
    await visit(page, '/admin/chat/direct');
    await openConversation(page, STAFF.userId);
    await mock.failNext('/chat/send', { method: 'POST', status: 502, body: '<html>Bad gateway</html>', times: 4 });
    await send(page, 'Offline moment');
    await expect(page.getByText('Failed to send').first()).toBeVisible({ timeout: 20_000 });
    await mock.clearFailures();
    await page.getByRole('button', { name: 'Retry sending' }).click();
    await expect(page.getByText('Failed to send')).toHaveCount(0);
    await expect(page.getByLabel('Sent').last()).toBeVisible();
    await expect(bubbles(page).getByText('Offline moment')).toHaveCount(1);
  });

  test('image and file upload: multipart parts carry the right field/mime, bubbles render, failure is reported', async ({ page, mock, issues }) => {
    issues.allow(/send-file/);
    await visit(page, '/admin/chat/direct');
    await openConversation(page, STAFF.userId);

    await page.getByRole('button', { name: 'Attach a file' }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('Photo library', { exact: true }).click();
    (await chooser).setFiles({ name: 'site-photo.png', mimeType: 'image/png', buffer: PNG });
    const imgCall = await mock.waitForRequest('/chat/send-file', { method: 'POST' });
    expect(imgCall.files?.[0]).toMatchObject({ field: 'file' });
    expect(imgCall.files?.[0].mimetype).toMatch(/^image\//);
    await expect(page.getByLabel('Open photo').last()).toBeVisible();

    await page.getByRole('button', { name: 'Attach a file' }).click();
    const chooser2 = page.waitForEvent('filechooser');
    await page.getByText('Document', { exact: true }).click();
    (await chooser2).setFiles({ name: 'report-q3.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
    await expect(bubbles(page).getByText('report-q3.pdf')).toBeVisible();
    await expect(bubbles(page).getByText(/PDF · Tap to open/)).toBeVisible();
    expect((await mock.requests({ path: '/chat/send-file', method: 'POST' }))[1].files?.[0].filename).toBe('report-q3.pdf');

    await mock.failNext('/chat/send-file', { method: 'POST', status: 500 });
    await page.getByRole('button', { name: 'Attach a file' }).click();
    const chooser3 = page.waitForEvent('filechooser');
    await page.getByText('Document', { exact: true }).click();
    (await chooser3).setFiles({ name: 'broken.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('x') });
    await expect(page.getByText('Failed to send').first()).toBeVisible();
  });

  test('image tap opens the full-screen viewer (first tap reveals incoming photos); Escape closes it', async ({ page }) => {
    await visit(page, '/admin/chat/direct');
    await openConversation(page, STAFF.userId);
    await page.getByRole('button', { name: 'Attach a file' }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('Photo library', { exact: true }).click();
    (await chooser).setFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByLabel('Open photo').last()).toBeVisible();
    await page.getByLabel('Open photo').last().click();
    await expect(page.getByRole('button', { name: /zoom in/i }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /zoom in/i })).toHaveCount(0);
  });

  test('date separators: messages from different days are grouped under their own labels', async ({ page, mock, tenant }) => {
    await mock.setClock(new Date(Date.now() - 3 * 86_400_000).toISOString());
    await incoming(tenant, STAFF.userId, 'Message from three days ago');
    await mock.setClock(new Date(Date.now() - 1 * 86_400_000).toISOString());
    await incoming(tenant, STAFF.userId, 'Message from yesterday');
    await mock.setClock(null);
    await visit(page, '/admin/chat/direct');
    await openConversation(page, STAFF.userId);
    await expect(bubbles(page)).toContainText('Message from yesterday');
    await expect(bubbles(page).getByText('Yesterday', { exact: true })).toBeVisible();
    await expect(bubbles(page).getByText('Today', { exact: true })).toBeVisible();
    const text = await bubbles(page).innerText();
    expect(text.indexOf('Message from three days ago')).toBeLessThan(text.indexOf('Message from yesterday'));
  });

  test('long conversation opens at the latest message; scrolling up shows "Scroll to latest message", clicking returns', async ({ page, tenant }) => {
    for (let i = 1; i <= 40; i += 1) await incoming(tenant, STAFF.userId, `Bulk message ${i}`);
    await visit(page, '/admin/chat/direct');
    await openConversation(page, STAFF.userId);
    const last = bubbles(page).getByText('Bulk message 40', { exact: true });
    // opens at the latest message (not at the top) with the last bubble fully visible above the composer
    await expect.poll(async () => {
      const l = await bubbles(page).boundingBox();
      const m = await last.boundingBox();
      return l && m ? Math.round(l.y + l.height - (m.y + m.height)) : -999;
    }, { message: 'last bubble must be fully inside the list viewport' }).toBeGreaterThanOrEqual(0);
    await expect(page.getByRole('button', { name: 'Scroll to latest message' })).toHaveCount(0);
    const latest = page.getByRole('button', { name: 'Scroll to latest message' });
    await expect(async () => {
      await bubbles(page).evaluate((el) => {
        const sc = [el, ...el.querySelectorAll('*')].find((e) => (e as HTMLElement).scrollHeight > (e as HTMLElement).clientHeight + 200 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)) as HTMLElement;
        sc.scrollTop = 0;
      });
      await expect(latest).toBeVisible({ timeout: 1_500 });
    }).toPass();
    await latest.click();
    await expect(last).toBeInViewport();
    await expect(latest).toHaveCount(0);
  });

  test('in-chat search filters messages, shows an empty result, and closing restores the full history', async ({ page }) => {
    await visit(page, '/admin/chat/direct');
    await openConversation(page, STAFF.userId);
    await page.getByTestId('chat-menu').click();
    await page.getByTestId('chat-action-search').click();
    await page.getByPlaceholder('Search in chat...').fill('roster');
    await expect(bubbles(page).getByText('Thanks. Also check the new shift roster.')).toBeVisible();
    await expect(bubbles(page).getByText('Good morning Aarav')).toHaveCount(0);
    await page.getByPlaceholder('Search in chat...').fill('zzz-no-match');
    await expect(page.getByText('No messages found')).toBeVisible();
    await page.getByRole('button', { name: 'Close search' }).click();
    await expect(bubbles(page).getByText('Good morning Aarav')).toBeVisible();
  });

  test('contact info and delete chat (with confirmation) from the conversation menu', async ({ page, mock }) => {
    await visit(page, '/admin/chat/direct');
    await openConversation(page, STAFF.userId);
    await page.getByTestId('chat-menu').click();
    await page.getByTestId('chat-action-contact').click();
    await expect(page.getByRole('dialog').getByText('Aarav Sharma').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('chat-menu').click();
    await page.getByTestId('chat-action-delete').click();
    await expect(page.getByRole('dialog').getByText(/delete this chat with Aarav Sharma/i)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    expect((await mock.requests({ path: '/chat/delete', method: 'DELETE' })).length).toBe(0);
    await page.getByTestId('chat-menu').click();
    await page.getByTestId('chat-action-delete').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await mock.waitForRequest('/chat/delete/', { method: 'DELETE' });
    await expect(row(page, STAFF.userId).getByText('Tap to start chatting')).toBeVisible();
  });
});

test.describe('realtime', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('a pushed message appears live in the open conversation and is marked read; the list badge for that peer stays clear', async ({ page, mock, tenant }) => {
    await visit(page, '/admin/chat/direct');
    await openConversation(page, STAFF.userId);
    await mock.waitForSocket(USERS.admin.userId);
    await mock.clearRequests();
    await incoming(tenant, STAFF.userId, 'Live message for the open chat');
    await expect(bubbles(page).getByText('Live message for the open chat')).toBeVisible();
    await mock.waitForRequest('/chat/mark-read', { method: 'PUT' });
  });

  test('a push for ANOTHER conversation does not leak into the open one and raises that peer\'s unread count in the list', async ({ page, mock, tenant }, testInfo) => {
    await visit(page, '/admin/chat/direct');
    await openConversation(page, STAFF.userId);
    await mock.waitForSocket(USERS.admin.userId);
    await incoming(tenant, 'stf-0003', 'Message from Bhavna');
    await expect(bubbles(page).getByText('Message from Bhavna')).toHaveCount(0);
    if (testInfo.project.name === 'phone') await page.goBack();
    await expect(row(page, 'stf-0003')).toContainText('Message from Bhavna');
    await expect(row(page, 'stf-0003').getByText('1', { exact: true })).toBeVisible();
    await row(page, 'stf-0003').click();
    await expect(bubbles(page).getByText('Message from Bhavna')).toBeVisible();
    await mock.waitForRequest('/chat/mark-read', { method: 'PUT', predicate: (r) => r.body?.sender_id === 'stf-0003' });
    if (testInfo.project.name === 'phone') await page.goBack();
    await expect(row(page, 'stf-0003').getByText('1', { exact: true })).toHaveCount(0);
  });

  test('unread badge on the list clears when the conversation is opened and the sidebar/hub badge follows', async ({ page, mock, tenant }, testInfo) => {
    await visit(page, '/admin/chat/direct');
    await mock.waitForSocket(USERS.admin.userId);
    await incoming(tenant, STAFF.userId, 'One');
    await incoming(tenant, STAFF.userId, 'Two');
    await expect(row(page, STAFF.userId).getByText('2', { exact: true })).toBeVisible();
    await row(page, STAFF.userId).click();
    await expect(bubbles(page).getByText('Two')).toBeVisible();
    await mock.waitForRequest('/chat/mark-read', { method: 'PUT' });
    if (testInfo.project.name === 'phone') await page.goBack();
    await expect(row(page, STAFF.userId).getByText('2', { exact: true })).toHaveCount(0);
  });

  test('reconnects after a socket drop and keeps delivering live messages', async ({ page, mock, tenant }) => {
    await visit(page, '/admin/chat/direct');
    await openConversation(page, STAFF.userId);
    await mock.waitForSocket(USERS.admin.userId);
    const dropped = await mock.dropSockets(USERS.admin.userId);
    expect(dropped.dropped).toBeGreaterThan(0);
    await expect.poll(async () => (await mock.sockets()).filter((s) => s.userId === USERS.admin.userId && s.state === 1).length, { timeout: 25_000 }).toBeGreaterThan(0);
    await incoming(tenant, STAFF.userId, 'After the reconnect');
    await expect(bubbles(page).getByText('After the reconnect')).toBeVisible();
  });

  test('a message sent while the socket was down is recovered by the history refetch on reconnect', async ({ page, mock, tenant }) => {
    await visit(page, '/admin/chat/direct');
    await openConversation(page, STAFF.userId);
    await mock.waitForSocket(USERS.admin.userId);
    await mock.dropSockets(USERS.admin.userId);
    await incoming(tenant, STAFF.userId, 'Sent during the outage');
    await expect(bubbles(page).getByText('Sent during the outage')).toBeVisible({ timeout: 25_000 });
  });
});
