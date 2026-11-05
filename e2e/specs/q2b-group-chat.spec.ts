/**
 * Q2b - Admin chat hub (menu cards, unread badges, plan gate) and group chat: groups list + search + unread, create group
 * (validation, payload, failure), conversation (send text / image / file, optimistic send + failure + Retry / Discard, read ticks
 * rule `readCount >= totalMembers`, date separators, scroll-to-latest, members sheet, add staff with toasts, in-chat search),
 * WebSocket push into the open group vs another group, unread clearing, socket drop / reconnect + resync, org param of the list
 * request. Staff-side group chat at the end.
 */
import type { Page } from '@playwright/test';

import { test, expect, loginAs, visit, USERS, expectToast } from '../support';
import { mockApi } from '../support/q2';
import { istDay } from '../support/q2b';

const ADMIN = USERS.admin.userId;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const row = (page: Page, id: string) => page.getByTestId(`group-row-${id}`);
const list = (page: Page) => page.getByTestId('message-list');
const chatTab = (page: Page, name: RegExp) => page.getByRole('tab', { name }).or(page.getByRole('link', { name }));

/** Someone else posts into a group (the mock pushes it to every other member's sockets, like the real backend). */
const groupPost = (tenant: string, gid: string, from: string, message: string) => mockApi(tenant, 'POST', '/group-chat/send', { group_id: gid, sender_id: from, message });

const isPhoneProject = (name: string) => name === 'phone';

async function openGroup(page: Page, id: string): Promise<void> {
  await expect(row(page, id)).toBeVisible();
  await row(page, id).click();
  await expect(page.getByTestId('chat-input')).toBeVisible();
}

/** Phones show the list OR the conversation: go back to the list there; desktop shows both side by side. */
async function toList(page: Page, project: string): Promise<void> {
  if (isPhoneProject(project)) await page.getByRole('button', { name: 'Back to conversations' }).click();
  await expect(page.getByTestId('group-list')).toBeVisible();
}

async function send(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-input').fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
}

async function groupMenu(page: Page, action: 'members' | 'add' | 'search' | 'theme'): Promise<void> {
  await page.getByTestId('chat-menu').click();
  await page.getByTestId(`chat-action-${action}`).click();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('chat hub', () => {
  test('menu cards, group unread badge on card + tab, live direct badge, badge follows the groups that are read', async ({ page, mock, tenant }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/chat');
    await expect(page.getByText('Team Communication')).toBeVisible();
    for (const k of ['individual', 'group', 'announce', 'targeted']) await expect(page.getByTestId(`hub-card-${k}`)).toBeVisible();
    await expect(page.getByTestId('hub-badge-group')).toHaveText('4'); // grp-1: 2 unread, grp-2: 2 unread
    await expect(page.getByTestId('hub-badge-individual')).toHaveCount(0);
    if (testInfo.project.name === 'phone') await expect(chatTab(page, /^Chat, 4 unread/).first()).toBeVisible();
    // the other two cards carry no counter for admins
    await expect(page.getByTestId('hub-badge-announce')).toHaveCount(0);
    await expect(page.getByTestId('hub-badge-targeted')).toHaveCount(0);

    await mock.waitForSocket(ADMIN);
    await mockApi(tenant, 'POST', '/chat/send', { sender_id: USERS.staff.userId, receiver_id: ADMIN, message: 'Ping' });
    await expect(page.getByTestId('hub-badge-individual')).toHaveText('1');

    // open the Sales Team group (2 unread) and come back: the group badge drops to 2
    await page.getByTestId('hub-card-group').click();
    await page.waitForURL('**/admin/chat/groups');
    await openGroup(page, 'grp-2');
    await mock.waitForRequest('/group-chat/mark-read', { method: 'PUT' });
    await visit(page, '/admin/chat');
    await expect(page.getByTestId('hub-badge-group')).toHaveText('2');
    await page.getByTestId('hub-card-announce').click();
    await page.waitForURL('**/admin/chat/announcements');
  });

  test('plan gate: a blocked organisation sees only the block message with a renew action and no chat list is requested', async ({ page, mock, issues }) => {
    issues.allow(/.*/);
    await mock.setPlan('expired');
    await loginAs(page, 'admin');
    await visit(page, '/admin/chat');
    await expect(page.getByTestId('chat-gate-panel')).toBeVisible();
    await expect(page.getByTestId('chat-gate-message')).toContainText(/plan has expired|free trial has ended|subscribe/i);
    for (const k of ['individual', 'group', 'announce', 'targeted']) await expect(page.getByTestId(`hub-card-${k}`)).toHaveCount(0);
    await expect(page.getByTestId('chat-gate-cta')).toBeVisible();
    // gated list / unread endpoints are never requested (no wasted 500s, no console noise)
    const gated = [...(await mock.requests({ path: '/chat/' })), ...(await mock.requests({ path: '/group-chat/' }))].filter((r) => r.method !== 'WS');
    expect(gated.map((r) => `${r.method} ${r.path}`)).toEqual([]);
  });

  test('plan gate: a deep link into the group list of a blocked organisation shows the server message with Retry (wrapped 500 unwrapped)', async ({ page, mock, issues }) => {
    issues.allow(/.*/);
    await mock.setPlan('expired');
    await loginAs(page, 'admin');
    await visit(page, '/admin/chat/groups');
    await expect(page.getByText(/Your plan has expired/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /retry|try again/i }).first()).toBeVisible();
    await expect(page.getByTestId('group-row-grp-1')).toHaveCount(0);
  });

  test('an elite plan sees the menu, not the gate', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/chat');
    await expect(page.getByTestId('hub-card-group')).toBeVisible();
    await expect(page.getByTestId('chat-gate-panel')).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('group list', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('rows show name, sender-prefixed preview, member count and unread; list request carries org_id (not organization_id)', async ({ page, mock }) => {
    await visit(page, '/admin/chat/groups');
    await expect(row(page, 'grp-1')).toContainText('All Hands');
    await expect(row(page, 'grp-1')).toContainText('Chirag Patel: Noted, thanks!');
    await expect(row(page, 'grp-1')).toContainText('23 members');
    await expect(row(page, 'grp-1')).toHaveAccessibleName('All Hands, 2 unread');
    await expect(row(page, 'grp-2')).toContainText('Sales Team');
    await expect(row(page, 'grp-2')).toContainText('Aarav Sharma: Will review them tonight.');
    await expect(row(page, 'grp-2')).toContainText('5 members');
    await expect(row(page, 'grp-2')).toHaveAccessibleName('Sales Team, 2 unread');
    // newest activity first
    const ids = await page.locator('[data-testid^="group-row-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(ids).toEqual(['group-row-grp-2', 'group-row-grp-1']);
    const call = await mock.waitForRequest('/group-chat/list/', { method: 'GET' });
    expect(call.path).toBe(`/group-chat/list/${ADMIN}`);
    expect(call.query).toMatchObject({ org_id: 'org-0001' });
    expect(call.query.organization_id).toBeUndefined();
  });

  test('search filters by group name (case-insensitive) and shows the empty state with a Create Group action', async ({ page }) => {
    await visit(page, '/admin/chat/groups');
    await page.getByTestId('group-search').fill('sales');
    await expect(row(page, 'grp-2')).toBeVisible();
    await expect(row(page, 'grp-1')).toHaveCount(0);
    await page.getByTestId('group-search').fill('zzz');
    await expect(page.getByText('No groups yet')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Group/ }).first()).toBeVisible();
    await page.getByTestId('group-search').fill('');
    await expect(row(page, 'grp-1')).toBeVisible();
  });

  test('a failing list shows an error with Retry; Retry recovers', async ({ page, mock, issues }) => {
    issues.allow(/group-chat\/list/);
    await mock.failNext('/group-chat/list/*', { status: 503, times: 3 });
    await visit(page, '/admin/chat/groups');
    await expect(page.getByRole('button', { name: /retry|try again/i }).first()).toBeVisible();
    await mock.clearFailures();
    await page.getByRole('button', { name: /retry|try again/i }).first().click();
    await expect(row(page, 'grp-1')).toBeVisible();
  });

  test('a group created by someone else appears live (group_created push)', async ({ page, mock, tenant }) => {
    await visit(page, '/admin/chat/groups');
    await expect(row(page, 'grp-1')).toBeVisible();
    await mock.waitForSocket(ADMIN);
    await mockApi(tenant, 'POST', '/group-chat/create', { group_name: 'Ops Night Crew', created_by: 'mgr-0001', member_ids: ['mgr-0001', ADMIN, USERS.staff.userId], org_id: 'org-0001' });
    await expect(page.locator('[data-testid^="group-row-"]').filter({ hasText: 'Ops Night Crew' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('create group', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/chat/groups');
    await page.getByTestId('create-group').click();
    await expect(page.getByTestId('create-group-submit')).toBeVisible();
  });

  test('Create stays disabled until a name AND a member exist; name limit 50; members are removable chips; staff search narrows the list', async ({ page }) => {
    const submit = page.getByTestId('create-group-submit');
    await expect(submit).toBeDisabled();
    await page.getByLabel('Group name').fill('   ');
    await page.getByTestId(`staff-pick-${USERS.staff.userId}`).click();
    await expect(submit).toBeDisabled(); // blank name
    await page.getByLabel('Group name').fill('x'.repeat(60));
    await expect(page.getByLabel('Group name')).toHaveValue('x'.repeat(50));
    await expect(page.getByText('50/50')).toBeVisible();
    await page.getByLabel('Group name').fill('Field Team');
    await expect(submit).toBeEnabled();
    await expect(page.getByText('1 member selected')).toBeVisible();
    await page.getByRole('button', { name: 'Remove Aarav Sharma' }).click();
    await expect(submit).toBeDisabled();
    await expect(page.getByText(/member.* selected/)).toHaveCount(0);
    // search narrows the picker; the admin is not offered as a member
    await page.getByPlaceholder('Search staff to add…').fill('bhavna');
    await expect(page.getByTestId('staff-pick-stf-0002')).toBeVisible();
    await expect(page.getByTestId('staff-pick-stf-0003')).toHaveCount(0);
    await expect(page.getByTestId(`staff-pick-${USERS.staff.userId}`)).toHaveCount(0);
    await page.getByPlaceholder('Search staff to add…').fill('zzzz');
    await expect(page.getByText('No staff found')).toBeVisible();
    await page.getByPlaceholder('Search staff to add…').fill('');
    await expect(page.locator(`[data-testid="staff-pick-${ADMIN}"]`)).toHaveCount(0);
    // inactive staff (stf-0005) are not offered
    await expect(page.getByTestId('staff-pick-stf-0005')).toHaveCount(0);
  });

  test('create: payload (name trimmed, creator + members, org_id), success toast, list refreshed and the new group opens', async ({ page, mock }) => {
    await page.getByLabel('Group name').fill('  Field Team  ');
    await page.getByTestId(`staff-pick-${USERS.staff.userId}`).click();
    await page.getByTestId('staff-pick-stf-0003').click();
    await page.getByTestId('create-group-submit').click();
    const call = await mock.waitForRequest('/group-chat/create', { method: 'POST' });
    expect(call.body).toMatchObject({ group_name: 'Field Team', created_by: ADMIN, org_id: 'org-0001' });
    expect([...(call.body?.member_ids as string[])].sort()).toEqual([ADMIN, USERS.staff.userId, 'stf-0003'].sort());
    await expectToast(page, 'Group created!');
    await expect(page.getByTestId('chat-input')).toBeVisible(); // the new group's conversation opened
    await expect(page.getByRole('button', { name: 'Field Team details' })).toBeVisible();
    expect((await mock.requests({ path: '/group-chat/list/' })).length).toBeGreaterThan(1); // refreshed
  });

  test('a failing create keeps the sheet open with the entered data and shows an error toast; a retry then succeeds', async ({ page, mock, issues }) => {
    issues.allow(/group-chat\/create/);
    await page.getByLabel('Group name').fill('Retry me');
    await page.getByTestId(`staff-pick-${USERS.staff.userId}`).click();
    await mock.failNext('/group-chat/create', { method: 'POST', status: 500, body: { detail: 'Group service down' } });
    await page.getByTestId('create-group-submit').click();
    await expectToast(page, /Group service down|Failed to create group/);
    await expect(page.getByLabel('Group name')).toHaveValue('Retry me');
    await expect(page.getByTestId('create-group-submit')).toBeEnabled();
    await page.getByTestId('create-group-submit').click();
    await expectToast(page, 'Group created!');
  });

  test('closing the sheet discards the draft', async ({ page }) => {
    await page.getByLabel('Group name').fill('Draft');
    await page.getByTestId(`staff-pick-${USERS.staff.userId}`).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('create-group-submit')).toHaveCount(0);
    await page.getByTestId('create-group').click();
    await expect(page.getByLabel('Group name')).toHaveValue('');
    await expect(page.getByTestId('create-group-submit')).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('group conversation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/chat/groups');
  });

  test('history renders with sender names on incoming bubbles, header count and own message single tick', async ({ page }) => {
    await openGroup(page, 'grp-1');
    await expect(page.getByRole('button', { name: 'All Hands details' })).toContainText('23 members');
    await expect(list(page)).toContainText('Welcome to the All Hands group.');
    await expect(list(page).getByText('Meera Iyer')).toBeVisible();
    await expect(list(page).getByText('Reminder: quarterly review on Friday.')).toBeVisible();
    await expect(list(page).getByText('Chirag Patel')).toBeVisible();
    await expect(page.getByLabel('Sent', { exact: true }).first()).toBeVisible(); // own message: not read by everyone
    await expect(list(page).getByText('Today', { exact: true })).toBeVisible();
  });

  test('send text: optimistic bubble, POST payload, single tick, composer cleared, list preview + order updated', async ({ page, mock }, testInfo) => {
    await openGroup(page, 'grp-1');
    await mock.waitForSocket(ADMIN);
    await send(page, 'Quarterly review moved to 4pm');
    await expect(list(page).getByText('Quarterly review moved to 4pm')).toBeVisible();
    const call = await mock.waitForRequest('/group-chat/send', { method: 'POST' });
    expect(call.body).toMatchObject({ group_id: 'grp-1', sender_id: ADMIN, message: 'Quarterly review moved to 4pm' });
    await expect(page.getByLabel('Sent', { exact: true }).last()).toBeVisible();
    await expect(page.getByTestId('chat-input')).toHaveValue('');
    await expect(list(page).getByText('Quarterly review moved to 4pm')).toHaveCount(1); // REST response + socket echo never duplicate
    await toList(page, testInfo.project.name);
    await expect(row(page, 'grp-1')).toContainText('Quarterly review moved to 4pm');
    const ids = await page.locator('[data-testid^="group-row-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(ids[0]).toBe('group-row-grp-1');
  });

  test('Enter sends, Shift+Enter inserts a line, whitespace-only is not sent', async ({ page, mock }) => {
    await openGroup(page, 'grp-2');
    const input = page.getByTestId('chat-input');
    await input.fill('   ');
    await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
    await input.fill('line one');
    await input.press('Shift+Enter');
    await input.pressSequentially('line two');
    await expect(input).toHaveValue('line one\nline two');
    await input.press('Enter');
    const call = await mock.waitForRequest('/group-chat/send', { method: 'POST' });
    expect(call.body?.message).toBe('line one\nline two');
  });

  test('send failure keeps the bubble as "Failed to send" with an error toast; Retry sends it once; Discard removes a failed one', async ({ page, mock, issues }) => {
    issues.allow(/group-chat\/send/);
    await openGroup(page, 'grp-2');
    await mock.failNext('/group-chat/send', { method: 'POST', status: 500, times: 2, body: { detail: 'Group is read-only right now' } });
    await send(page, 'Will fail twice');
    await expect(page.getByText('Failed to send').first()).toBeVisible();
    await expectToast(page, /Group is read-only right now/); // visible inside the conversation
    await page.getByRole('button', { name: 'Retry sending' }).click();
    await expect(page.getByText('Failed to send')).toHaveCount(1); // second injected failure
    await page.getByRole('button', { name: 'Retry sending' }).click();
    await expect(page.getByText('Failed to send')).toHaveCount(0);
    await expect(list(page).getByText('Will fail twice')).toHaveCount(1);
    expect((await mock.requests({ path: '/group-chat/send', method: 'POST' })).filter((r) => r.status === 200)).toHaveLength(1);

    await mock.failNext('/group-chat/send', { method: 'POST', status: 500 });
    await send(page, 'Throw me away');
    await expect(page.getByRole('button', { name: 'Discard message' })).toBeVisible();
    await page.getByRole('button', { name: 'Discard message' }).click();
    await expect(list(page).getByText('Throw me away')).toHaveCount(0);
    expect((await mock.requests({ path: '/group-chat/send', method: 'POST' })).filter((r) => r.status === 200)).toHaveLength(1);
  });

  test('image and file upload: multipart parts carry field/mime, bubbles render, an upload failure is reported', async ({ page, mock, issues }) => {
    issues.allow(/send-file/);
    await openGroup(page, 'grp-1');
    await page.getByRole('button', { name: 'Attach a file' }).click();
    const c1 = page.waitForEvent('filechooser');
    await page.getByText('Photo library', { exact: true }).click();
    (await c1).setFiles({ name: 'site-photo.png', mimeType: 'image/png', buffer: PNG });
    const img = await mock.waitForRequest('/group-chat/send-file', { method: 'POST' });
    expect(img.files?.[0]).toMatchObject({ field: 'file' });
    expect(img.files?.[0].mimetype).toMatch(/^image\//);
    expect(img.body).toMatchObject({ group_id: 'grp-1', sender_id: ADMIN });
    await expect(page.getByLabel('Open photo').last()).toBeVisible();

    await page.getByRole('button', { name: 'Attach a file' }).click();
    const c2 = page.waitForEvent('filechooser');
    await page.getByText('Document', { exact: true }).click();
    (await c2).setFiles({ name: 'roster.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
    await expect(list(page).getByText('roster.pdf')).toBeVisible();
    const doc = await mock.waitForRequest('/group-chat/send-file', { method: 'POST', predicate: (r) => r.files?.[0]?.filename === 'roster.pdf' });
    expect(doc.files?.[0].mimetype).toBe('application/pdf');

    await mock.failNext('/group-chat/send-file', { method: 'POST', status: 500 });
    await page.getByRole('button', { name: 'Attach a file' }).click();
    const c3 = page.waitForEvent('filechooser');
    await page.getByText('Document', { exact: true }).click();
    (await c3).setFiles({ name: 'broken.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('x') });
    await expect(page.getByText('Failed to send').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry sending' })).toBeVisible();
  });

  test('read ticks: double tick only when readCount reaches the other members (total_members excludes the sender)', async ({ page, mock, tenant }) => {
    await openGroup(page, 'grp-2'); // admin + Meera(mgr-0001) + Aarav + Bhavna + stf-0007 -> 4 others
    await mock.waitForSocket(ADMIN);
    await send(page, 'Please acknowledge');
    await expect(page.getByLabel('Sent', { exact: true }).last()).toBeVisible();
    const others = ['mgr-0001', USERS.staff.userId, 'stf-0003', 'stf-0007'];
    const historyCalls = async () => (await mock.requests({ path: '/group-chat/messages/grp-2' })).length;
    for (const [i, uid] of others.entries()) {
      const before = await historyCalls();
      await mockApi(tenant, 'PUT', '/group-chat/mark-read', { group_id: 'grp-2', user_id: uid });
      if (i < others.length - 1) {
        await expect.poll(historyCalls).toBeGreaterThan(before); // the receipt refreshed the history ...
        await expect(page.getByLabel('Sent', { exact: true }).last()).toBeVisible(); // ... and 1..3 of 4 readers are still "Sent"
        await expect(page.getByLabel('Read', { exact: true })).toHaveCount(0);
      }
    }
    await expect(page.getByLabel('Read', { exact: true }).last()).toBeVisible();
  });

  test('read receipts: counts in the frame are applied; receipts of ANOTHER group or shaped like a 1:1 receipt are ignored', async ({ page, mock, tenant }) => {
    await openGroup(page, 'grp-2');
    await mock.waitForSocket(ADMIN);
    await send(page, 'Count the readers');
    await expect(page.getByLabel('Sent', { exact: true }).last()).toBeVisible();
    const all = await mockApi<{ message_id: string; message: string }[]>(tenant, 'GET', `/group-chat/messages/grp-2?user_id=${ADMIN}`);
    const id = all.find((m) => m.message === 'Count the readers')!.message_id;
    const frame = (data: Record<string, unknown>) => mock.push(ADMIN, { type: 'read_update', data });
    await frame({ group_id: 'grp-1', reader_id: 'mgr-0001', message_id: id, read_count: 4, total_members: 4 }); // other group
    await frame({ reader_id: USERS.staff.userId, sender_id: ADMIN }); // 1:1-shaped
    await frame({ group_id: 'grp-2', reader_id: 'mgr-0001', message_id: id, read_count: 3, total_members: 4 }); // not everyone yet
    await expect(page.getByLabel('Read', { exact: true })).toHaveCount(0);
    await frame({ group_id: 'grp-2', reader_id: 'stf-0007', message_id: id, read_count: 4, total_members: 4 });
    await expect(page.getByLabel('Read', { exact: true }).last()).toBeVisible();
  });

  test('date separators group messages of different days (IST) in order', async ({ page, mock, tenant }) => {
    await mock.setClock(new Date(Date.now() - 3 * 86_400_000).toISOString());
    await groupPost(tenant, 'grp-2', 'mgr-0001', 'Three days ago message');
    await mock.setClock(new Date(Date.now() - 86_400_000).toISOString());
    await groupPost(tenant, 'grp-2', 'mgr-0001', 'Yesterday message');
    await mock.setClock(null);
    await openGroup(page, 'grp-2');
    await expect(list(page)).toContainText('Yesterday message');
    await expect(list(page).getByText('Yesterday', { exact: true })).toBeVisible();
    await expect(list(page).getByText('Today', { exact: true })).toBeVisible();
    const d = new Date(`${istDay(-3)}T00:00:00Z`);
    const label = `${d.getUTCDate()} ${d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
    await expect(list(page).getByText(label, { exact: true })).toBeVisible();
    const text = await list(page).innerText();
    expect(text.indexOf('Three days ago message')).toBeLessThan(text.indexOf('Yesterday message'));
    expect(text.indexOf('Yesterday message')).toBeLessThan(text.indexOf('Targets for this week'));
  });

  test('a long group opens at the latest message; scrolling up shows "Scroll to latest message", clicking returns', async ({ page, tenant }) => {
    for (let i = 1; i <= 40; i += 1) await groupPost(tenant, 'grp-2', 'mgr-0001', `Bulk message ${i}`);
    await openGroup(page, 'grp-2');
    await expect(list(page).getByText('Bulk message 40', { exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Scroll to latest message' })).toHaveCount(0);
    await list(page).evaluate((el) => {
      const sc = [el, ...el.querySelectorAll('*')].find((e) => (e as HTMLElement).scrollHeight > (e as HTMLElement).clientHeight + 200 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)) as HTMLElement;
      sc.scrollTop = 0;
    });
    const latest = page.getByRole('button', { name: 'Scroll to latest message' });
    await expect(latest).toBeVisible();
    await latest.click();
    await expect(list(page).getByText('Bulk message 40', { exact: true })).toBeInViewport();
    await expect(latest).toHaveCount(0);
  });

  test('members sheet: count, "You", Admin tag for the creator, department / branch / role; add staff updates the count and shows a success toast inside the conversation', async ({ page, mock }) => {
    await openGroup(page, 'grp-2'); // created by the manager (Meera Iyer), 5 members
    await groupMenu(page, 'members');
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText('5 members')).toBeVisible();
    await expect(sheet.getByText('You', { exact: true })).toBeVisible();
    await expect(sheet.getByText('Meera Iyer')).toBeVisible();
    await expect(sheet.getByText('Aarav Sharma')).toBeVisible();
    await expect(sheet.getByText('Manager')).toHaveCount(1);
    await expect(sheet.getByText('Head Office').first()).toBeVisible();
    await page.keyboard.press('Escape');

    await groupMenu(page, 'add');
    await expect(page.getByTestId('staff-pick-stf-0003')).toHaveCount(0); // already a member
    await expect(page.getByTestId(`staff-pick-${USERS.staff.userId}`)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Add \d+ Staff$/ })).toHaveCount(0); // footer only with a selection
    await page.getByTestId('staff-pick-stf-0004').click();
    await page.getByTestId('staff-pick-stf-0006').click();
    await page.getByRole('button', { name: 'Add 2 Staff' }).click();
    const call = await mock.waitForRequest('/group-chat/add-members', { method: 'POST' });
    expect(call.body).toMatchObject({ group_id: 'grp-2' });
    expect([...(call.body?.member_ids as string[])].sort()).toEqual(['stf-0004', 'stf-0006']);
    await expectToast(page, '2 staff added!');
    await expect(page.getByRole('button', { name: 'Sales Team details' })).toContainText('7 members');
  });

  test('add staff failure: error toast with the server text, the sheet stays open with the selection', async ({ page, mock, issues }) => {
    issues.allow(/add-members/);
    await openGroup(page, 'grp-2');
    await groupMenu(page, 'add');
    await page.getByTestId('staff-pick-stf-0004').click();
    await mock.failNext('/group-chat/add-members', { method: 'POST', status: 500, body: { detail: 'Cannot add members now' } });
    await page.getByRole('button', { name: 'Add 1 Staff' }).click();
    await expectToast(page, /Cannot add members now/);
    await expect(page.getByRole('button', { name: 'Add 1 Staff' })).toBeVisible();
    await page.getByRole('button', { name: 'Add 1 Staff' }).click();
    await expectToast(page, '1 staff added!');
  });

  test('in-chat search filters messages, shows an empty result, and closing restores the history', async ({ page }) => {
    await openGroup(page, 'grp-1');
    await groupMenu(page, 'search');
    await page.getByPlaceholder('Search messages...').fill('quarterly');
    await expect(list(page).getByText('Reminder: quarterly review on Friday.')).toBeVisible();
    await expect(list(page).getByText('Noted, thanks!')).toHaveCount(0);
    await page.getByPlaceholder('Search messages...').fill('zzz-no-match');
    await expect(page.getByText('No messages found')).toBeVisible();
    await page.getByRole('button', { name: 'Close search' }).click();
    await expect(list(page).getByText('Noted, thanks!')).toBeVisible();
  });

  test('a conversation of a group the admin is not in / unknown group id shows an error with Retry instead of a blank screen', async ({ page, issues }) => {
    issues.allow(/.*/);
    await visit(page, '/admin/chat/groups', { groupId: 'grp-does-not-exist' });
    await expect(page.getByRole('button', { name: /retry|try again/i }).first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('realtime', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/chat/groups');
  });

  test('a push for the OPEN group appends once and is marked read; a push for ANOTHER group does not leak in but updates that row', async ({ page, mock, tenant }, testInfo) => {
    await openGroup(page, 'grp-2');
    await mock.waitForSocket(ADMIN);
    await mock.clearRequests();
    await groupPost(tenant, 'grp-2', USERS.staff.userId, 'Live in Sales Team');
    await expect(list(page).getByText('Live in Sales Team')).toHaveCount(1);
    await mock.waitForRequest('/group-chat/mark-read', { method: 'PUT', predicate: (r) => r.body?.group_id === 'grp-2' });

    await groupPost(tenant, 'grp-1', 'mgr-0001', 'Only for All Hands');
    await expect(list(page).getByText('Only for All Hands')).toHaveCount(0);
    await toList(page, testInfo.project.name);
    await expect(row(page, 'grp-1')).toContainText('Only for All Hands');
    await expect(row(page, 'grp-1')).toHaveAccessibleName('All Hands, 3 unread'); // 2 seeded + 1 live
    await expect(row(page, 'grp-2')).toContainText('Live in Sales Team');
    await expect(row(page, 'grp-2')).toHaveAccessibleName('Sales Team'); // the open group never counts its own messages
    // the pushed message is in All Hands now
    await openGroup(page, 'grp-1');
    await expect(list(page).getByText('Only for All Hands')).toBeVisible();
    await expect(list(page).getByText('Live in Sales Team')).toHaveCount(0);
  });

  test('unread clears when the group is opened (list row, server mark-read) and stays cleared after leaving', async ({ page, mock }, testInfo) => {
    await expect(row(page, 'grp-2')).toHaveAccessibleName('Sales Team, 2 unread');
    await openGroup(page, 'grp-2');
    const read = await mock.waitForRequest('/group-chat/mark-read', { method: 'PUT' });
    expect(read.body).toMatchObject({ group_id: 'grp-2', user_id: ADMIN });
    await toList(page, testInfo.project.name);
    await expect(row(page, 'grp-2')).toHaveAccessibleName('Sales Team');
    await expect(row(page, 'grp-1')).toHaveAccessibleName('All Hands, 2 unread');
    await page.reload();
    if (isPhoneProject(testInfo.project.name)) await expect(page.getByTestId('chat-input').or(page.getByTestId('group-list'))).toBeVisible();
    // server agrees: reload shows the persisted state
    await visit(page, '/admin/chat/groups');
    await expect(row(page, 'grp-2')).toHaveAccessibleName('Sales Team');
  });

  test('reconnects after a socket drop and keeps delivering to the open group', async ({ page, mock, tenant }) => {
    await openGroup(page, 'grp-2');
    await mock.waitForSocket(ADMIN);
    expect((await mock.dropSockets(ADMIN)).dropped).toBeGreaterThan(0);
    await expect.poll(async () => (await mock.sockets()).filter((s) => s.userId === ADMIN && s.state === 1).length, { timeout: 25_000 }).toBeGreaterThan(0);
    await groupPost(tenant, 'grp-2', 'mgr-0001', 'After the reconnect');
    await expect(list(page).getByText('After the reconnect')).toBeVisible();
  });

  test('a message posted while the socket was down is recovered by the resync on reconnect', async ({ page, mock, tenant }) => {
    await openGroup(page, 'grp-2');
    await mock.waitForSocket(ADMIN);
    await mock.dropSockets(ADMIN);
    await groupPost(tenant, 'grp-2', 'mgr-0001', 'Sent during the outage');
    await expect(list(page).getByText('Sent during the outage')).toBeVisible({ timeout: 25_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
test.describe('staff side', () => {
  test('a staff member sees the groups they belong to (no create button), sends a message and gets live ones; menu has no admin-only entries', async ({ page, mock, tenant }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/chat/groups');
    await expect(row(page, 'grp-1')).toBeVisible();
    await expect(row(page, 'grp-2')).toBeVisible();
    await expect(page.getByTestId('create-group')).toHaveCount(0);
    await row(page, 'grp-2').click();
    await expect(page.getByRole('button', { name: 'Sales Team details' })).toContainText('Tap to view');
    await send(page, 'Staff here');
    const call = await mock.waitForRequest('/group-chat/send', { method: 'POST' });
    expect(call.body).toMatchObject({ group_id: 'grp-2', sender_id: USERS.staff.userId, message: 'Staff here' });
    await mock.waitForSocket(USERS.staff.userId);
    await groupPost(tenant, 'grp-2', 'mgr-0001', 'Welcome staff');
    await expect(list(page).getByText('Welcome staff')).toBeVisible();
    await page.getByTestId('chat-menu').click();
    await expect(page.getByTestId('chat-action-members')).toBeVisible();
    await expect(page.getByTestId('chat-action-add')).toBeVisible();
    await expect(page.getByTestId('chat-action-search')).toHaveCount(0);
    await expect(page.getByTestId('chat-action-theme')).toHaveCount(0);
    expect((await mock.lastRequest('/group-chat/list/'))?.query).toMatchObject({ org_id: 'org-0001' });
  });
});
