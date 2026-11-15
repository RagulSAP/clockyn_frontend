'use strict';
/* Support starts a conversation: the Chat action in the Organizations list opens the support chat on that organization, and an
 * organization that never wrote to us opens an EMPTY conversation whose first message creates it.
 * Runs against e2e/console/server.js (ClockynConsole + operator mock); data from e2e/console/orgchat-mock.js (implements the
 * backend contract). Screenshots: set ORGCHAT_SHOTS_DIR to a folder. */
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const API = 'http://127.0.0.1:' + (process.env.CONSOLE_API_PORT || 8891);
const SHOTS = process.env.ORGCHAT_SHOTS_DIR || '';
const HINT = 'No messages yet. Your first message starts the conversation and the company admin is notified in the app.';

async function post(request, url, data) {
  const r = await request.post(API + url, { data });
  expect(r.ok()).toBeTruthy();
}
async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}

test.beforeEach(async ({ page, request }) => {
  await post(request, '/__op/state', { reset: true });
  await post(request, '/gen-dashboard/__orgchat/state', { reset: true });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
});

/* leave nothing behind for the other specs, even when a test fails */
test.afterEach(async ({ request }) => { await request.post(API + '/gen-dashboard/__orgchat/state', { data: { off: true } }); });

async function login(page, email = 'admin@clockyn.test') {
  await page.goto('/pages/login.html');
  await page.locator('#email').fill(email);
  await page.locator('#loginBtn').click();
  await expect(page.locator('#otpGroup')).toBeVisible();
  await page.locator('.otp-box').first().click();
  await page.keyboard.type('123456');
  await page.locator('#loginBtn').click();
  await page.waitForURL(/dashboard\.html$/);
}
async function openOrgs(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await page.goto('/pages/organizations.html');
  await expect(page.locator('#orgs-tbody tr.row-link')).toHaveCount(4);
  return errors;
}
const chatBtn = (page, name) => page.locator('button[data-chat-org][aria-label="Chat with ' + name + '"]');
const panelFrame = (page) => page.frameLocator('#ck-chat-panel iframe');

/* ───────────────────────────── the Chat action ───────────────────────────── */
test('every organization row has a Chat button with its name; deleted organizations have none', async ({ page }) => {
  const errors = await openOrgs(page);
  await expect(page.locator('button[data-chat-org]')).toHaveCount(3);
  for (const name of ['Acme Traders', 'Beta Foods', 'Gamma Noadmin']) {
    const b = chatBtn(page, name);
    await expect(b).toHaveCount(1);
    await expect(b).toHaveAttribute('title', 'Chat with ' + name);
    await expect(b).toBeEnabled();
  }
  const deletedRow = page.locator('#orgs-tbody tr', { hasText: 'Delta Deleted' });
  await expect(deletedRow.locator('button')).toHaveCount(0);
  await expect(page.locator('th', { hasText: 'Actions' })).toBeVisible();
  await shot(page, 'orgchat-list');
  expect(errors).toEqual([]);
});

test('Chat opens the support chat panel on that organization and does not open the organization page', async ({ page }) => {
  const errors = await openOrgs(page);
  await chatBtn(page, 'Beta Foods').click();
  await expect(page.locator('#ck-chat-panel')).toBeVisible();
  await expect(page).toHaveURL(/organizations\.html$/);                           /* the row click (org analytics) must not fire */
  await expect(page.locator('#ck-chat-panel iframe')).toHaveAttribute('src', /live_chat\.html\?embed=1&org_id=org-b/);
  await expect(panelFrame(page).locator('.lc-head-title')).toContainText('Beta Foods');
  expect(errors).toEqual([]);
});

test('a row click outside the actions still opens the organization page', async ({ page }) => {
  await openOrgs(page);
  await page.locator('#orgs-tbody tr', { hasText: 'Acme Traders' }).locator('.org-name-text').click();
  await expect(page).toHaveURL(/org_analytics\.html\?org_id=org-a/);
});

test('without the floating panel the Chat button falls back to the full page', async ({ page }) => {
  await openOrgs(page);
  await page.evaluate(() => { delete window.ClockynLiveChatPanel; });
  await chatBtn(page, 'Beta Foods').click();
  await expect(page).toHaveURL(/live_chat\.html\?org_id=org-b/);
  await expect(page.locator('#lc-new-hint')).toHaveText(HINT);
});

/* ───────────────────────────── an organization with no conversation yet ───────────────────────────── */
test('an organization without a conversation opens an empty one: header, hint, enabled composer and attachments', async ({ page }) => {
  await openOrgs(page);
  await chatBtn(page, 'Beta Foods').click();
  const f = panelFrame(page);
  await expect(f.locator('.lc-head-title')).toContainText('Beta Foods');
  await expect(f.locator('#lc-head')).toContainText('bala@beta.test');
  await expect(f.locator('#lc-head')).toContainText('9000000002');
  await expect(f.locator('#lc-status-chip')).toHaveText('New conversation');
  await expect(f.locator('#lc-status-btn')).toBeHidden();                         /* nothing to close yet */
  await expect(f.locator('#lc-new-hint')).toHaveText(HINT);
  await expect(f.locator('#lc-composer')).toBeVisible();
  await expect(f.locator('#lc-input')).toBeEnabled();
  await expect(f.locator('#lc-input')).toHaveAttribute('placeholder', /first message/);
  await expect(f.locator('#lc-composer button[aria-label*="ttach"], #lc-composer .lc-iconbtn').first()).toBeEnabled();
  await expect(f.locator('.lc-row')).toHaveCount(1);                              /* only Acme: no empty thread in the list */
  await expect(f.locator('.lc-row', { hasText: 'Beta Foods' })).toHaveCount(0);
  await shot(page, 'orgchat-empty-conversation');
});

test('the first message creates the conversation: it appears once, in the list, and the thread behaves like any other', async ({ page, request }) => {
  await openOrgs(page);
  await chatBtn(page, 'Beta Foods').click();
  const f = panelFrame(page);
  await f.locator('#lc-input').fill('Hello Beta, this is Clockyn support.');
  await f.locator('#lc-input').press('Enter');
  await expect(f.locator('.lc-msg.mine .lc-bubble', { hasText: 'Hello Beta, this is Clockyn support.' })).toHaveCount(1);
  await expect(f.locator('#lc-new-hint')).toHaveCount(0);
  await expect(f.locator('#lc-status-chip')).toHaveText('Open');
  await expect(f.locator('#lc-status-btn')).toBeVisible();
  await expect(f.locator('.lc-row')).toHaveCount(2);
  await expect(f.locator('.lc-row', { hasText: 'Beta Foods' })).toHaveCount(1);
  await expect(f.locator('.lc-row.active', { hasText: 'Beta Foods' })).toHaveCount(1);
  await expect(f.locator('.lc-msg.failed')).toHaveCount(0);
  const log = await (await request.get(API + '/gen-dashboard/__orgchat/log')).json();
  expect(log).toEqual([{ org_id: 'org-b', message: 'Hello Beta, this is Clockyn support.' }]);   /* exactly one request */
  /* a second message goes to the same conversation */
  await f.locator('#lc-input').fill('Anything we can help with?');
  await f.locator('#lc-input').press('Enter');
  await expect(f.locator('.lc-msg.mine .lc-bubble')).toHaveCount(2);
  /* and it can be closed like any other */
  await f.locator('#lc-status-btn').click();
  await expect(f.locator('#lc-confirm')).toHaveClass(/open/);
});

test('an organization with no active admin: the server message is shown and the typed text is kept', async ({ page, request }) => {
  await openOrgs(page);
  await chatBtn(page, 'Gamma Noadmin').click();
  const f = panelFrame(page);
  await expect(f.locator('#lc-new-hint')).toBeVisible();
  await f.locator('#lc-input').fill('Hello?');
  await f.locator('#lc-input').press('Enter');
  await expect(f.locator('#toast')).toContainText('This organization has no active admin to chat with');
  await expect(f.locator('#lc-input')).toHaveValue('Hello?');                     /* text restored, nothing sent */
  await expect(f.locator('.lc-msg')).toHaveCount(0);                              /* no failed bubble left behind */
  await expect(f.locator('#lc-new-hint')).toBeVisible();
  await expect(f.locator('.lc-row')).toHaveCount(1);                              /* no thread was created */
  const log = await (await request.get(API + '/gen-dashboard/__orgchat/log')).json();
  expect(log).toHaveLength(1);
});

/* ───────────────────────────── an organization that already has a conversation ───────────────────────────── */
test('Chat for an organization with a conversation shows its history', async ({ page }) => {
  await openOrgs(page);
  await chatBtn(page, 'Acme Traders').click();
  const f = panelFrame(page);
  await expect(f.locator('.lc-msg .lc-bubble', { hasText: 'Hello, how do I add staff?' })).toBeVisible();
  await expect(f.locator('.lc-msg .lc-bubble', { hasText: 'Open Staff, then Add.' })).toBeVisible();
  await expect(f.locator('#lc-status-chip')).toHaveText('Open');
  await expect(f.locator('#lc-status-btn')).toBeVisible();
  await expect(f.locator('#lc-new-hint')).toHaveCount(0);
});

test('switching the open panel from one organization to another works', async ({ page }) => {
  await openOrgs(page);
  await chatBtn(page, 'Acme Traders').click();
  await expect(panelFrame(page).locator('.lc-head-title')).toContainText('Acme Traders');
  await page.keyboard.press('Escape');
  await expect(page.locator('#ck-chat-panel')).toBeHidden();
  await chatBtn(page, 'Beta Foods').click();
  await expect(panelFrame(page).locator('.lc-head-title')).toContainText('Beta Foods');
  await expect(panelFrame(page).locator('#lc-new-hint')).toBeVisible();
});

/* ───────────────────────────── the full page ───────────────────────────── */
test('live_chat.html?org_id= on an organization without a conversation: empty conversation, first message creates it', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await page.goto('/pages/live_chat.html?org_id=org-b');
  await expect(page.locator('.lc-head-title')).toContainText('Beta Foods');
  await expect(page.locator('#lc-new-hint')).toHaveText(HINT);
  await expect(page.locator('.lc-row')).toHaveCount(1);
  await page.locator('#lc-input').fill('Welcome to Clockyn');
  await page.locator('#lc-input').press('Enter');
  await expect(page.locator('.lc-msg.mine .lc-bubble', { hasText: 'Welcome to Clockyn' })).toHaveCount(1);
  await expect(page.locator('.lc-row', { hasText: 'Beta Foods' })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('an unknown or deleted organization shows "Organization not found"', async ({ page }) => {
  await login(page);
  await page.goto('/pages/live_chat.html?org_id=org-d');
  await expect(page.locator('#lc-msgs')).toContainText('Organization not found');
  await expect(page.locator('#lc-new-hint')).toHaveCount(0);
  await page.goto('/pages/live_chat.html?org_id=does-not-exist');
  await expect(page.locator('#lc-msgs')).toContainText('Organization not found');
});

test('the unread badge and the chat list are not affected by a conversation support started', async ({ page, request }) => {
  await openOrgs(page);
  await chatBtn(page, 'Beta Foods').click();
  const f = panelFrame(page);
  await f.locator('#lc-input').fill('Hi');
  await f.locator('#lc-input').press('Enter');
  await expect(f.locator('.lc-msg.mine')).toHaveCount(1);
  const unread = await (await request.get(API + '/gen-dashboard/live-chat/unread-count')).json();
  expect(unread.unread_messages).toBe(0);
  await expect(page.locator('#ck-chat-fab .nav-livechat-badge')).toBeHidden();
  await expect(f.locator('.lc-row.unread')).toHaveCount(0);
});

/* ───────────────────────────── phone ───────────────────────────── */
test.describe('phone (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the organizations card shows a labelled Chat button, nothing overflows, and the chat sheet is full screen', async ({ page }) => {
    await openOrgs(page);
    const b = chatBtn(page, 'Beta Foods');
    await expect(b).toBeVisible();
    await expect(b.locator('.act-label')).toBeVisible();
    await expect(b.locator('.act-label')).toHaveText('Chat');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await shot(page, 'orgchat-list-phone');
    await b.click();
    const panel = page.locator('#ck-chat-panel');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(388);
    await expect(panelFrame(page).locator('#lc-new-hint')).toBeVisible();
    await expect(panelFrame(page).locator('#lc-input')).toBeEnabled();
    await shot(page, 'orgchat-empty-conversation-phone');
  });
});
