'use strict';
/* Admin web console: the Video Hub tab strip (Videos | Views) shared by pages/videos.html and pages/video_views.html,
 * against e2e/console/operator-mock.js (the mock has no video routes: the generic fallback answers {} and the pages show their empty states). */
const { test, expect } = require('@playwright/test');

const API = 'http://127.0.0.1:' + (process.env.CONSOLE_API_PORT || 8891);

test.beforeEach(async ({ page, request }) => {
  const r = await request.post(API + '/__op/state', { data: { reset: true } });
  expect(r.ok()).toBeTruthy();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
});

async function login(page) {
  await page.goto('/pages/login.html');
  await page.locator('#email').fill('admin@clockyn.test');
  await page.locator('#loginBtn').click();
  await expect(page.locator('#otpGroup')).toBeVisible();
  await page.locator('.otp-box').first().click();
  await page.keyboard.type('123456');
  await page.locator('#loginBtn').click();
  await page.waitForURL(/dashboard\.html$/);
}

/* Signs in, opens a page and collects uncaught page errors. */
async function open(page, file) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await page.goto('/pages/' + file);
  await expect(page.locator('#vh-tabs')).toBeVisible();
  return errors;
}

const videosTab = (page) => page.locator('#vh-tab-videos');
const viewsTab = (page) => page.locator('#vh-tab-views');

test('Videos page: the strip has Videos (selected) and Views, under the Video Hub title and sidebar item', async ({ page }) => {
  const errors = await open(page, 'videos.html');
  await expect(page.locator('#vh-tabs')).toHaveAttribute('role', 'tablist');
  await expect(page.locator('#vh-tabs')).toHaveAttribute('aria-label', 'Video Hub');
  await expect(page.locator('#vh-tabs a.tab')).toHaveText(['Videos', 'Views']);
  await expect(videosTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(videosTab(page)).toHaveClass(/\bactive\b/);
  await expect(videosTab(page)).toHaveAttribute('aria-current', 'page');
  await expect(viewsTab(page)).toHaveAttribute('aria-selected', 'false');
  await expect(viewsTab(page)).not.toHaveClass(/\bactive\b/);
  await expect(page.locator('.topbar-title')).toHaveText('Video Hub');
  await expect(page.locator('#app-sidebar a.nav-item.active')).toContainText('Video Hub');
  await expect(page.locator('h1')).toHaveText('Video Hub');
  expect(errors).toEqual([]);
});

test('Views page: Views is selected, the title and sidebar item stay Video Hub, its own Activity / By Organization tabs still work', async ({ page }) => {
  const errors = await open(page, 'video_views.html');
  await expect(viewsTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(viewsTab(page)).toHaveClass(/\bactive\b/);
  await expect(videosTab(page)).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('.topbar-title')).toHaveText('Video Hub');
  await expect(page.locator('#app-sidebar a.nav-item.active')).toContainText('Video Hub');
  await expect(page.locator('h1')).toHaveText('Video Views');            // the page keeps its own heading
  await expect(page).toHaveTitle(/Video Hub/);
  // the page's inner view-mode tabs are separate from the strip and keep working
  await expect(page.locator('#tab-activity')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#tab-orgs').click();
  await expect(page.locator('#tab-orgs')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#orgs-wrap')).toBeVisible();
  await expect(viewsTab(page)).toHaveAttribute('aria-selected', 'true');   // and do not disturb the strip
  expect(errors).toEqual([]);
});

test('clicking a tab navigates to the other page and keeps the Video Hub context; both URLs also work as deep links', async ({ page }) => {
  await open(page, 'videos.html');
  await viewsTab(page).click();
  await page.waitForURL(/pages\/video_views\.html$/);
  await expect(page.locator('#vh-tabs')).toBeVisible();
  await expect(viewsTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#app-sidebar a.nav-item.active')).toContainText('Video Hub');
  await videosTab(page).click();
  await page.waitForURL(/pages\/videos\.html$/);
  await expect(videosTab(page)).toHaveAttribute('aria-selected', 'true');
  await page.goto('/pages/video_views.html');                               // a bookmarked / typed URL
  await expect(viewsTab(page)).toHaveAttribute('aria-selected', 'true');
});

test('keyboard: only the selected tab is in the tab order; Left / Right / Home / End move focus, Enter follows the link', async ({ page }) => {
  await open(page, 'videos.html');
  await expect(videosTab(page)).toHaveAttribute('tabindex', '0');
  await expect(viewsTab(page)).toHaveAttribute('tabindex', '-1');
  await videosTab(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(viewsTab(page)).toBeFocused();
  await page.keyboard.press('ArrowRight');                                   // wraps round
  await expect(videosTab(page)).toBeFocused();
  await page.keyboard.press('ArrowLeft');                                    // and back
  await expect(viewsTab(page)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(videosTab(page)).toBeFocused();
  await page.keyboard.press('End');
  await expect(viewsTab(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await page.waitForURL(/pages\/video_views\.html$/);
  await expect(viewsTab(page)).toHaveAttribute('aria-selected', 'true');
  // the same strip works from the Views page
  await viewsTab(page).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(videosTab(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await page.waitForURL(/pages\/videos\.html$/);
});

for (const file of ['videos.html', 'video_views.html']) {
  test(`phone width (390px): ${file} has no horizontal overflow and the strip fits the screen`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, file);
    const m = await page.evaluate(() => {
      const r = document.getElementById('vh-tabs').getBoundingClientRect();
      return { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, left: r.left, right: r.right };
    });
    expect(m.scroll).toBeLessThanOrEqual(m.client + 1);
    expect(m.left).toBeGreaterThanOrEqual(0);
    expect(m.right).toBeLessThanOrEqual(m.client);
    await expect(videosTab(page)).toBeVisible();
    await expect(viewsTab(page)).toBeVisible();
  });
}
