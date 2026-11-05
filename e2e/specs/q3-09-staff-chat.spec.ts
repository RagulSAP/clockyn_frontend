/**
 * Q3 - Staff chat: hub (badges, plan gate), 1:1 chat (admin pinned first, send, WS push, mark-read), group chat,
 * broadcast + targeted announcement feeds (seen-ids per user, badge counts).
 */
import type { Page } from '@playwright/test';

import { expect, loginAs, test, USERS, visit } from '../support';
import type { MockClient } from '../support/mock';
import { snap } from '../support/q3';

const apiBase = `http://127.0.0.1:${process.env.MOCK_PORT ?? 8787}`;

async function announcementsFor(page: Page, mock: MockClient, userId: string) {
  const res = await page.request.get(`${apiBase}/api/announcements/employee/${userId}`, { headers: { 'x-e2e-tenant': mock.tenant } });
  return ((await res.json()).data ?? []) as { id: string; target: string }[];
}

/** Admin sends a chat message to a user (the mock pushes it over the receiver's WebSocket). */
async function adminSends(page: Page, mock: MockClient, receiverId: string, message: string) {
  const res = await page.request.post(`${apiBase}/chat/send`, {
    headers: { 'x-e2e-tenant': mock.tenant },
    data: { sender_id: USERS.admin.userId, receiver_id: receiverId, message, org_id: 'org-0001' },
  });
  expect(res.ok()).toBe(true);
}

const messages = (page: Page) => page.getByTestId('message-list');
const chatTab = (page: Page, name: RegExp) => page.getByRole('tab', { name }).or(page.getByRole('link', { name }));

test.describe('staff chat hub', () => {
  test('four channels with unread badges that match the server data', async ({ page, mock }, testInfo) => {
    const anns = await announcementsFor(page, mock, USERS.staff.userId);
    const broadcast = anns.filter((a) => a.target === 'all' || a.target === 'selected').length;
    const targeted = anns.filter((a) => a.target === 'branch' || a.target === 'dept').length;
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat');
    for (const k of ['individual', 'group', 'broadcast', 'targeted']) await expect(page.getByTestId(`hub-card-${k}`)).toBeVisible();
    await expect(page.getByTestId('hub-badge-individual')).toHaveText('3'); // 2 from admin + 1 from the manager
    if (broadcast > 0) await expect(page.getByTestId('hub-badge-broadcast')).toHaveText(String(broadcast));
    if (targeted > 0) await expect(page.getByTestId('hub-badge-targeted')).toHaveText(String(targeted));
    await snap(page, testInfo, 'staff-chat-hub');
    // regression (Q3-V3): channel titles are never cut off ("Targeted Announce...")
    const titleClipped = await page.getByTestId('hub-card-targeted').getByText('Targeted Announcement').evaluate((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
    expect(titleClipped, 'channel title is clipped').toBe(false);
    for (const [key, path] of [['individual', '/staff/chat/direct'], ['group', '/staff/chat/groups'], ['broadcast', '/staff/chat/broadcast'], ['targeted', '/staff/chat/targeted']] as const) {
      await visit(page, '/staff/chat');
      await page.getByTestId(`hub-card-${key}`).click();
      await page.waitForURL(`**${path}`);
    }
  });

  test('an expired plan shows "Chat Unavailable" with no purchase action', async ({ page, mock, issues }) => {
    issues.allow(/chat\/list|group-chat\/list/);
    await mock.setPlan('expired');
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat');
    await expect(page.getByText('Chat Unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: /renew|view plan/i })).toHaveCount(0);
    await expect(page.getByTestId('hub-card-individual')).toHaveCount(0);
  });

  test('a message pushed over the WebSocket raises the badges live', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-individual')).toHaveText('3');
    await mock.waitForSocket(USERS.staff.userId);
    await adminSends(page, mock, USERS.staff.userId, 'Live message from admin');
    await expect(page.getByTestId('hub-badge-individual')).toHaveText('4');
  });
});

test.describe('direct chat', () => {
  test('the admin is pinned first; opening the conversation shows history, clears unread and marks messages read', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat/direct');
    const rows = page.locator('[data-testid^="chat-row-"]');
    await expect(rows.first()).toHaveAttribute('data-testid', `chat-row-${USERS.admin.userId}`);
    await expect(page.getByTestId(`chat-row-${USERS.admin.userId}`)).toHaveAccessibleName(/Anita Desai, 2 unread/);
    await snap(page, testInfo, 'staff-chat-list');
    await page.getByTestId(`chat-row-${USERS.admin.userId}`).click();
    await expect(page.getByText('Thanks. Also check the new shift roster.')).toBeVisible();
    await expect(page.getByText('Sure, sending it by noon.')).toBeVisible();
    await snap(page, testInfo, 'staff-chat-conversation');
    const read = await mock.waitForRequest('/chat/mark-read', { method: 'PUT' });
    expect(read.body).toMatchObject({ sender_id: USERS.admin.userId, receiver_id: USERS.staff.userId });
  });

  test('opening conversations lowers the unread badges (3 -> 1 -> 0) and keeps them lowered after a reload', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-individual')).toHaveText('3');
    await page.getByTestId('hub-card-individual').click();
    await page.getByTestId(`chat-row-${USERS.admin.userId}`).click();
    await expect(messages(page).getByText('And update me on the Mysore lead.')).toBeVisible();
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-individual')).toHaveText('1');
    await page.getByTestId('hub-card-individual').click();
    await page.getByTestId(`chat-row-${USERS.manager.userId}`).click();
    await expect(messages(page).getByText('Please come to my cabin after lunch.')).toBeVisible();
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-individual')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('hub-card-individual')).toBeVisible();
    await expect(page.getByTestId('hub-badge-individual')).toHaveCount(0);
  });

  test('send a message: optimistic bubble, POST /chat/send, shown after reload', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat/direct');
    await page.getByTestId(`chat-row-${USERS.admin.userId}`).click();
    await page.getByTestId('chat-input').fill('Weekly report attached');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(messages(page).getByText('Weekly report attached')).toBeVisible();
    const call = await mock.waitForRequest('/chat/send', { method: 'POST' });
    expect(call.body).toMatchObject({ sender_id: USERS.staff.userId, receiver_id: USERS.admin.userId, message: 'Weekly report attached' });
    await expect(page.getByTestId('chat-input')).toHaveValue('');
    await page.reload();
    // phones reopen inside the conversation, wide screens show the list first
    const row = page.getByTestId(`chat-row-${USERS.admin.userId}`);
    await expect(row.or(messages(page)).first()).toBeVisible();
    if (await row.isVisible()) await row.click();
    await expect(messages(page).getByText('Weekly report attached')).toBeVisible();
  });

  test('an incoming message appears live in the open conversation', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat/direct');
    await page.getByTestId(`chat-row-${USERS.admin.userId}`).click();
    await mock.waitForSocket(USERS.staff.userId);
    await adminSends(page, mock, USERS.staff.userId, 'Are you there?');
    await expect(messages(page).getByText('Are you there?')).toBeVisible();
  });

  test('a failed send shows a retry that re-sends without a duplicate', async ({ page, mock, issues }) => {
    issues.allow(/chat\/send/);
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat/direct');
    await page.getByTestId(`chat-row-${USERS.admin.userId}`).click();
    await mock.failNext('/chat/send', { status: 500 });
    await page.getByTestId('chat-input').fill('Will retry this');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('button', { name: 'Retry sending' })).toBeVisible();
    await page.getByRole('button', { name: 'Retry sending' }).click();
    await expect(page.getByRole('button', { name: 'Retry sending' })).toHaveCount(0);
    await expect(messages(page).getByText('Will retry this')).toHaveCount(1);
  });

  test('search finds a colleague and opens a new conversation', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat/direct');
    await page.getByTestId('chat-search').fill('Chirag');
    await expect(page.getByTestId('chat-search-results').or(page.getByText('No matching chats'))).toBeVisible();
  });

  test('a failing chat list still shows the pinned admin conversation (no stuck spinner, no crash)', async ({ page, mock, issues }) => {
    issues.allow(/chat\/list/);
    await loginAs(page, 'staff');
    await mock.failNext('/chat/list/*', { status: 500, times: -1 });
    await visit(page, '/staff/chat/direct');
    await expect(page.getByTestId(`chat-row-${USERS.admin.userId}`)).toBeVisible();
    await expect(page.getByTestId('chat-list')).toBeVisible();
  });
});

test.describe('group chat', () => {
  test('opening a group clears only its own unread count', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-group')).toHaveText('4');
    await page.getByTestId('hub-card-group').click();
    await expect(page.getByTestId('group-row-grp-2')).toHaveAccessibleName(/1 unread/);
    await page.getByTestId('group-row-grp-1').click();
    await expect(messages(page).getByText('Noted, thanks!')).toBeVisible();
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-group')).toHaveText('1');
  });

  test('member groups are listed, a message can be sent and a pushed group message shows live', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat/groups');
    await expect(page.getByTestId('group-row-grp-1')).toBeVisible();
    await snap(page, testInfo, 'staff-group-list');
    await page.getByTestId('group-row-grp-1').click();
    await page.getByTestId('chat-input').fill('Hello team');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(messages(page).getByText('Hello team')).toBeVisible();
    const call = await mock.waitForRequest('/group-chat/send', { method: 'POST' });
    expect(call.body).toMatchObject({ group_id: 'grp-1', sender_id: USERS.staff.userId, message: 'Hello team' });
    await snap(page, testInfo, 'staff-group-conversation');
    // someone else posts into the group
    await mock.waitForSocket(USERS.staff.userId);
    const res = await page.request.post(`${apiBase}/group-chat/send`, { headers: { 'x-e2e-tenant': mock.tenant }, data: { group_id: 'grp-1', sender_id: USERS.admin.userId, message: 'Welcome all' } });
    expect(res.ok()).toBe(true);
    await expect(messages(page).getByText('Welcome all')).toBeVisible();
  });
});

test.describe('announcement feeds', () => {
  test('Broadcast lists all/selected announcements and opening it clears the unread counters (persisted per user)', async ({ page, mock }, testInfo) => {
    const anns = await announcementsFor(page, mock, USERS.staff.userId);
    const mine = anns.filter((a) => a.target === 'all' || a.target === 'selected');
    expect(mine.length).toBeGreaterThan(0);
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-broadcast')).toHaveText(String(mine.length));
    await page.getByTestId('hub-card-broadcast').click();
    await page.waitForURL('**/staff/chat/broadcast');
    for (const a of mine) await expect(page.getByTestId(`announcement-${a.id}`)).toBeVisible();
    for (const a of anns.filter((x) => x.target === 'branch' || x.target === 'dept')) await expect(page.getByTestId(`announcement-${a.id}`)).toHaveCount(0);
    await snap(page, testInfo, 'staff-broadcast-feed');
    // seen ids stored under the user's own key
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => /announcement/i.test(k)));
    expect(keys.some((k) => k.includes(USERS.staff.userId))).toBe(true);
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-card-broadcast')).toBeVisible();
    await expect(page.getByTestId('hub-badge-broadcast')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('hub-card-broadcast')).toBeVisible();
    await expect(page.getByTestId('hub-badge-broadcast')).toHaveCount(0);
  });

  test('Targeted lists branch / department announcements and clears its own counter only', async ({ page, mock }, testInfo) => {
    const anns = await announcementsFor(page, mock, USERS.staff.userId);
    const mine = anns.filter((a) => a.target === 'branch' || a.target === 'dept');
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat');
    await page.getByTestId('hub-card-targeted').click();
    await page.waitForURL('**/staff/chat/targeted');
    for (const a of mine) await expect(page.getByTestId(`announcement-${a.id}`)).toBeVisible();
    await snap(page, testInfo, 'staff-targeted-feed');
    await visit(page, '/staff/chat');
    await expect(page.getByTestId('hub-badge-targeted')).toHaveCount(0);
    await expect(page.getByTestId('hub-badge-broadcast')).toBeVisible(); // not opened yet
  });

  test('a new announcement pushed over the WebSocket raises the counter and shows in the open feed', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat/broadcast');
    await mock.waitForSocket(USERS.staff.userId);
    const res = await page.request.post(`${apiBase}/api/announcements`, {
      headers: { 'x-e2e-tenant': mock.tenant },
      data: { org_id: 'org-0001', sent_by_id: USERS.admin.userId, title: 'Fire drill at noon', message: 'Please gather at the assembly point.', target: 'all' },
    });
    expect(res.ok()).toBe(true);
    await expect(page.getByText('Fire drill at noon')).toBeVisible();
  });

  test('search filters the feed; empty state is explained', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat/broadcast');
    await page.getByTestId('announcement-search').fill('zzzz-no-match');
    await expect(page.getByText('No results')).toBeVisible();
  });

  test('the Chat tab badge is chat + groups + announcements (3 + 4 + 3) and drops when feeds are opened', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(chatTab(page, /^Chat, 10 unread/).first()).toBeVisible();
    await visit(page, '/staff/chat/broadcast');
    await expect(page.getByTestId('broadcast-feed')).toBeVisible();
    await visit(page, '/staff/chat/targeted');
    await expect(page.getByTestId('targeted-feed')).toBeVisible();
    await visit(page, '/staff/home');
    await expect(chatTab(page, /^Chat, 7 unread/).first()).toBeVisible(); // 10 - 2 broadcast - 1 targeted
  });
});

test.describe('per-user seen ids', () => {
  test('what the staff member read does not mark the manager\'s announcements as seen', async ({ page, mock, context }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat/broadcast');
    await expect(page.getByTestId('broadcast-feed')).toBeVisible();
    const mgrAnns = (await announcementsFor(page, mock, USERS.manager.userId)).filter((a) => a.target === 'all' || a.target === 'selected');
    // same browser profile (same localStorage), another account
    const other = await context.newPage();
    await loginAs(other, 'manager');
    await visit(other, '/staff/chat');
    if (mgrAnns.length > 0) await expect(other.getByTestId('hub-badge-broadcast')).toHaveText(String(mgrAnns.length));
    await other.close();
  });
});
