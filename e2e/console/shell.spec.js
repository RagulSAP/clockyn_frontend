'use strict';
/* Admin web console shell (js/layout.js): the sidebar, the floating Live Chat button + chat panel, and the Notifications bell.
 * Runs against e2e/console/server.js (ClockynConsole + operator mock). Counts come from e2e/console/shell-mock.js.
 * Screenshots: set SHELL_SHOTS_DIR to a folder and the phone / panel / bell tests save PNGs there. */
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const API = 'http://127.0.0.1:' + (process.env.CONSOLE_API_PORT || 8891);
const SHOTS = process.env.SHELL_SHOTS_DIR || '';

async function mockState(request, body) {
  const r = await request.post(API + '/__op/state', { data: body });
  expect(r.ok()).toBeTruthy();
}
async function shellState(request, body) {
  const r = await request.post(API + '/gen-dashboard/__shell/state', { data: body });
  expect(r.ok()).toBeTruthy();
}
async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}

test.beforeEach(async ({ page, request }) => {
  await mockState(request, { reset: true });
  await shellState(request, { reset: true });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
});

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
async function openPage(page, file) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  if (!/dashboard\.html$/.test(page.url()) || file !== 'dashboard') await page.goto('/pages/' + file + '.html');
  await expect(page.locator('#app-sidebar .nav-item').first()).toBeVisible();
  return errors;
}
const bell = (page) => page.locator('.icon-btn[aria-label="Notifications"]').first();
const dotVisible = (page) => bell(page).locator('.dot').evaluate((el) => getComputedStyle(el).display !== 'none');

/* ───────────────────────────── sidebar ───────────────────────────── */
test('the sidebar has no Live Chat, Activity Logs or Video Views item and one Video Hub item', async ({ page }) => {
  const errors = await openPage(page, 'dashboard');
  const labels = await page.locator('#app-sidebar .nav-label').allTextContents();
  expect(labels).not.toContain('Live Chat');
  expect(labels).not.toContain('Activity Logs');
  expect(labels).not.toContain('Video Views');
  expect(labels.filter((l) => l === 'Video Hub')).toHaveLength(1);
  expect(labels).toEqual(expect.arrayContaining(['Dashboard', 'Organizations', 'Users', 'Subscriptions', 'Referrals', 'Settings']));
  await expect(page.locator('#app-sidebar a[href="live_chat.html"]')).toHaveCount(0);
  await expect(page.locator('#app-sidebar a[href="#activity"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const file of ['videos', 'video_views']) {
  test('Video Hub is the highlighted sidebar item on ' + file + '.html', async ({ page }) => {
    await openPage(page, file);
    const item = page.locator('#app-sidebar .nav-item.active');
    await expect(item).toHaveCount(1);
    await expect(item).toHaveText(/Video Hub/);
    await expect(item).toHaveAttribute('href', 'videos.html');
  });
}

/* ───────────────────────────── floating chat button ───────────────────────────── */
test('the floating chat button is on every page with the sidebar and carries the unread badge', async ({ page, request }) => {
  await shellState(request, { unread: 3 });
  const errors = await openPage(page, 'dashboard');
  const fab = page.locator('#ck-chat-fab');
  await expect(fab).toBeVisible();
  await expect(fab).toHaveAttribute('aria-label', 'Open live chat');
  await expect(fab).toHaveAttribute('aria-expanded', 'false');
  await expect(fab.locator('.nav-livechat-badge')).toHaveText('3');
  await expect(page.locator('.nav-livechat-badge')).toHaveCount(1);          /* the old sidebar badge is gone */
  const box = await fab.boundingBox();
  const vp = page.viewportSize();
  expect(Math.round(box.width)).toBe(56);
  expect(vp.width - (box.x + box.width)).toBeGreaterThanOrEqual(15);          /* bottom right, with a margin */
  expect(vp.height - (box.y + box.height)).toBeGreaterThanOrEqual(15);
  for (const file of ['organizations', 'subscriptions', 'referrals', 'settings']) {
    await page.goto('/pages/' + file + '.html');
    await expect(page.locator('#ck-chat-fab')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('no unread chats: the badge is hidden', async ({ page }) => {
  await openPage(page, 'dashboard');
  await expect(page.locator('#ck-chat-fab')).toBeVisible();
  await expect(page.locator('#ck-chat-fab .nav-livechat-badge')).toBeHidden();
});

test('the chat page itself has no floating button (it is the full view)', async ({ page }) => {
  await openPage(page, 'live_chat');
  await expect(page.locator('#lc-root')).toBeVisible();
  await expect(page.locator('#ck-chat-fab')).toHaveCount(0);
  await expect(page.locator('#ck-chat-panel')).toHaveCount(0);
});

test('opening the panel creates ONE iframe of live_chat.html?embed=1; it is kept when closed; Escape closes it', async ({ page, request }) => {
  await shellState(request, { threads: true });
  const errors = await openPage(page, 'dashboard');
  const fab = page.locator('#ck-chat-fab');
  const panel = page.locator('#ck-chat-panel');
  await expect(panel).toBeHidden();
  await expect(page.locator('iframe')).toHaveCount(0);                         /* created lazily */
  await fab.click();
  await expect(panel).toBeVisible();
  await expect(fab).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('iframe.ck-chat-frame')).toHaveAttribute('src', /live_chat\.html\?embed=1/);
  await expect(panel.locator('.ck-chat-title')).toHaveText('Live Chat');
  await expect(panel.locator('a.ck-chat-full')).toHaveAttribute('href', /live_chat\.html$/);
  const frame = page.frameLocator('iframe.ck-chat-frame');
  await expect(frame.locator('.lc-row')).toHaveCount(2);
  await page.evaluate(() => { document.querySelector('iframe.ck-chat-frame').setAttribute('data-keep', '1'); });
  await shot(page, 'panel-open-desktop');
  /* Escape (focus is inside the iframe) closes it and returns the focus to the button */
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(fab).toHaveAttribute('aria-expanded', 'false');
  await expect(fab).toBeFocused();
  /* open again: the very same iframe, not a new one */
  await fab.click();
  await expect(panel).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('iframe.ck-chat-frame')).toHaveAttribute('data-keep', '1');
  /* the close button */
  await panel.locator('.ck-chat-close').click();
  await expect(panel).toBeHidden();
  await expect(fab).toBeFocused();
  /* Escape with the focus on the page (not in the iframe) */
  await fab.click();
  await expect(panel).toBeVisible();
  await panel.locator('.ck-chat-close').focus();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  expect(errors).toEqual([]);
});

test('the embedded chat works: list, conversation, back, reply, unread clears; the shell chrome is hidden', async ({ page, request }) => {
  await shellState(request, { threads: true });                                  /* Acme has 2 unread */
  const errors = await openPage(page, 'dashboard');
  const fab = page.locator('#ck-chat-fab');
  await expect(fab.locator('.nav-livechat-badge')).toHaveText('2');
  await fab.click();
  const frame = page.frameLocator('iframe.ck-chat-frame');
  /* embed mode: only the chat, no sidebar / top bar */
  await expect(frame.locator('#lc-root')).toBeVisible();
  await expect(frame.locator('.sidebar')).toBeHidden();
  await expect(frame.locator('.topbar')).toBeHidden();
  await expect(frame.locator('html.embed')).toHaveCount(1);
  /* list -> conversation */
  await expect(frame.locator('.lc-row').first()).toContainText('Acme Traders');
  await frame.locator('.lc-row[data-org="org-a"]').click();
  await expect(frame.locator('#lc-msgs')).toContainText('how do I add staff');
  await expect(frame.locator('#lc-root')).toHaveAttribute('data-view', 'conv');
  /* the unread count clears (the iframe uses the parent's notifier) */
  await expect(fab.locator('.nav-livechat-badge')).toBeHidden({ timeout: 10000 });
  /* reply */
  await frame.locator('#lc-input').fill('Open Settings > Payroll');
  await frame.locator('#lc-send').click();
  await expect(frame.locator('#lc-msgs')).toContainText('Open Settings > Payroll');
  /* the URL of the iframe keeps embed=1 after opening a conversation */
  expect(await page.locator('iframe.ck-chat-frame').evaluate((f) => f.contentWindow.location.search)).toContain('embed=1');
  /* back to the list */
  await frame.locator('#lc-back').click();
  await expect(frame.locator('#lc-root')).toHaveAttribute('data-view', 'list');
  await shot(page, 'panel-list-desktop');
  expect(errors).toEqual([]);
});

test('events of the parent notifier reach the embedded chat (a new message shows up) and the open chat is not counted unread', async ({ page, request }) => {
  await shellState(request, { threads: true });
  await openPage(page, 'dashboard');
  await page.locator('#ck-chat-fab').click();
  const frame = page.frameLocator('iframe.ck-chat-frame');
  await frame.locator('.lc-row[data-org="org-b"]').click();
  await expect(frame.locator('#lc-msgs')).toContainText('Invoice question');
  const frameOrg = await page.evaluate(() => window.__clockynLiveChatActiveOrg);
  expect(frameOrg).toBe('org-b');                                               /* the parent sees the conversation that is open in the panel */
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('clockyn-livechat', { detail: { type: 'live_chat_message', data: {
      org_id: 'org-b', org_name: 'Beta Foods', message_id: 'live-1', sender_type: 'org', message_type: 'text', message: 'Pushed through the socket',
      timestamp: new Date().toISOString(), thread_status: 'open' } } }));
  });
  await expect(frame.locator('#lc-msgs')).toContainText('Pushed through the socket');
  /* closed panel: the open conversation no longer counts as "being looked at" */
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__clockynLiveChatActiveOrg)).toBe('');
});

/* ───────────────────────────── bell ───────────────────────────── */
test('the bell lists what needs attention, with counts, links and a dot', async ({ page, request }) => {
  await shellState(request, { unread: 3, deletions: 2, suggestions: 5 });
  const errors = await openPage(page, 'dashboard');
  await expect(page.locator('#app-sidebar .nav-suggestion-badge')).toHaveText('5');
  await expect.poll(() => dotVisible(page)).toBe(true);
  await expect(bell(page)).toHaveAttribute('aria-haspopup', 'true');
  await expect(bell(page)).toHaveAttribute('aria-expanded', 'false');
  await bell(page).click();
  const menu = page.locator('#ck-bell-menu');
  await expect(menu).toBeVisible();
  await expect(bell(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.locator('.ck-bell-title')).toHaveText('Needs your attention');
  const rows = menu.locator('a.ck-bell-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Live chat');
  await expect(rows.nth(0)).toContainText('3 unread');
  await expect(rows.nth(1)).toContainText('Account deletion requests');
  await expect(rows.nth(1)).toContainText('2 waiting');
  await expect(rows.nth(1)).toHaveAttribute('href', 'delete_account.html');
  await expect(rows.nth(2)).toContainText('Feature suggestions');
  await expect(rows.nth(2)).toContainText('5 new');
  await expect(rows.nth(2)).toHaveAttribute('href', 'suggestions.html');
  await shot(page, 'bell-open');
  /* Escape closes it and the focus returns to the bell */
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(bell(page)).toBeFocused();
  /* an outside click closes it too */
  await bell(page).click();
  await expect(menu).toBeVisible();
  await page.locator('.topbar-title').first().click({ position: { x: 4, y: 4 } });
  await expect(menu).toBeHidden();
  /* the suggestions row goes to the page */
  await bell(page).click();
  await menu.locator('a[data-key="suggestions"]').click();
  await page.waitForURL(/suggestions\.html$/);
  expect(errors).toEqual([]);
});

test('the live chat row of the bell opens the chat panel', async ({ page, request }) => {
  await shellState(request, { threads: true });
  await openPage(page, 'dashboard');
  await expect(page.locator('#ck-chat-fab .nav-livechat-badge')).toHaveText('2');
  await bell(page).click();
  await page.locator('#ck-bell-menu a[data-key="chat"]').click();
  await expect(page.locator('#ck-bell-menu')).toBeHidden();
  await expect(page.locator('#ck-chat-panel')).toBeVisible();
  await expect(page.locator('iframe.ck-chat-frame')).toHaveAttribute('src', /embed=1/);
  expect(page.url()).toMatch(/dashboard\.html$/);
});

test('nothing waiting: no dot, and the list says you are all caught up', async ({ page }) => {
  await openPage(page, 'dashboard');
  await expect.poll(() => dotVisible(page)).toBe(false);
  await bell(page).click();
  const menu = page.locator('#ck-bell-menu');
  await expect(menu).toContainText("You're all caught up");
  await expect(menu.locator('a.ck-bell-row')).toHaveCount(0);
  await expect(menu.locator('.ck-bell-empty svg')).toHaveCount(1);
  await shot(page, 'bell-empty');
});

test('the dot and the rows follow the live counts, and 99+ is shown as 99+', async ({ page, request }) => {
  await openPage(page, 'dashboard');
  await expect.poll(() => dotVisible(page)).toBe(false);
  await shellState(request, { suggestions: 120 });
  await page.evaluate((base) => fetch(base + '/company/suggest-feature').then((r) => r.json()).then((d) => {   /* what js/auth.js does on load */
    document.querySelectorAll('.nav-suggestion-badge').forEach((el) => { el.textContent = d.length > 99 ? '99+' : d.length; el.style.display = 'inline'; });
  }), API);
  await expect.poll(() => dotVisible(page)).toBe(true);
  await bell(page).click();
  await expect(page.locator('#ck-bell-menu a[data-key="suggestions"]')).toContainText('99+ new');
  await expect(bell(page)).toHaveAttribute('title', 'Notifications (99+)');
  /* an unread chat arrives while the list is open: the row appears */
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('clockyn-livechat-state', { detail: {} })));
  await shellState(request, { unread: 4 });
  await page.evaluate(() => window.ClockynLiveChat.refreshUnread());
  await expect(page.locator('#ck-bell-menu a[data-key="chat"]')).toContainText('4 unread');
});

test('pages whose bell had no dot or a permanently visible one behave the same', async ({ page, request }) => {
  await shellState(request, { deletions: 1 });
  await openPage(page, 'organizations');                                       /* no static dot in the markup */
  await expect.poll(() => dotVisible(page)).toBe(true);
  await shellState(request, { deletions: 0 });
  await page.goto('/pages/settings.html');                                     /* a static dot in the markup */
  await expect(bell(page)).toBeVisible();
  await expect.poll(() => dotVisible(page)).toBe(false);
});

/* ───────────────────────────── phone ───────────────────────────── */
test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the chat sheet is full screen and the button does not cover page controls', async ({ page, request }) => {
    await shellState(request, { threads: true });
    const errors = await openPage(page, 'dashboard');
    const fab = page.locator('#ck-chat-fab');
    await expect(fab).toBeVisible();
    await shot(page, 'phone-dashboard');
    const fb = await fab.boundingBox();
    expect(fb.x + fb.width).toBeLessThanOrEqual(390 - 15);
    expect(fb.y + fb.height).toBeLessThanOrEqual(844 - 15);
    /* it does not sit on the top bar controls (menu, bell) */
    for (const sel of ['.hamburger-btn', '.icon-btn[aria-label="Notifications"]']) {
      const b = await page.locator(sel).first().boundingBox();
      expect(b.y + b.height).toBeLessThan(fb.y);
    }
    /* scrolled to the very end, the last piece of page content ends above the button */
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const lastBottom = await page.evaluate(() => {
      const kids = Array.from(document.querySelectorAll('.content > *')).filter((e) => e.getBoundingClientRect().height > 0);
      return kids.length ? kids[kids.length - 1].getBoundingClientRect().bottom : 0;
    });
    const fb2 = await fab.boundingBox();
    expect(lastBottom).toBeLessThanOrEqual(fb2.y);
    await shot(page, 'phone-dashboard-bottom');
    /* the sheet */
    await fab.tap();
    const panel = page.locator('#ck-chat-panel');
    await expect(panel).toBeVisible();
    const pb = await panel.boundingBox();
    expect([Math.round(pb.x), Math.round(pb.y), Math.round(pb.width), Math.round(pb.height)]).toEqual([0, 0, 390, 844]);
    await expect(page.frameLocator('iframe.ck-chat-frame').locator('.lc-row')).toHaveCount(2);
    await shot(page, 'phone-chat-sheet');
    await panel.locator('.ck-chat-close').tap();
    await expect(panel).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('the bell list fits the phone screen', async ({ page, request }) => {
    await shellState(request, { unread: 1, deletions: 1, suggestions: 1 });
    await openPage(page, 'dashboard');
    await bell(page).tap();
    const menu = page.locator('#ck-bell-menu');
    await expect(menu).toBeVisible();
    const b = await menu.boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390);
    await shot(page, 'phone-bell');
  });
});
