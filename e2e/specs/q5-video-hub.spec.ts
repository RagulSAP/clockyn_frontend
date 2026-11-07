/**
 * Q5 - Support tab / Video Hub on web: a guide video plays inside the screen with its controls reachable.
 *
 * Guide videos are usually PORTRAIT phone screen recordings, which a bare <video flex:1> grows to its intrinsic height
 * (off screen on a desktop browser). The mock backend has no Video Hub routes, so the three endpoints are stubbed here.
 */
import fs from 'node:fs';
import path from 'node:path';

import type { Browser, Page } from '@playwright/test';

import { expect, loginAs, visit, test } from '../support';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const API = 'http://127.0.0.1:8787';

/** Records a short PORTRAIT (360x640) clip with Playwright's recorder: stands in for a phone screen recording. */
async function makePortraitClip(browser: Browser, dir: string): Promise<Buffer> {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, recordVideo: { dir, size: { width: 360, height: 640 } } });
  const p = await ctx.newPage();
  await p.setContent(
    '<body style="margin:0;color:#fff;font:700 40px sans-serif"><div id="t" style="padding:40px">guide</div>' +
      '<script>let n=0;setInterval(()=>{document.body.style.background=["#1d4ed8","#16a34a","#dc2626"][n++%3];document.getElementById("t").textContent="step "+n},150)</script></body>',
  );
  await p.waitForTimeout(2500);
  const video = p.video();
  await ctx.close();
  return fs.readFileSync(await video!.path());
}

async function stubVideoHub(page: Page, body: Buffer, views: string[]): Promise<void> {
  const json = (data: unknown) => ({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(data) });
  await page.route('**/support/videos', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill(json([{ id: 1, name: 'Mark attendance', url: `${API}/guide/mark.webm?sig=1` }])),
  );
  await page.route('**/support/videos/*/view', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    views.push(route.request().postData() ?? '');
    return route.fulfill(json({ success: true }));
  });
  await page.route('**/guide/mark.webm*', (route) =>
    route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'video/webm', 'accept-ranges': 'none' }, body }),
  );
}

test.describe('Q5 Video Hub (web)', () => {
  test.use({ failOnPageIssues: false });

  test('a portrait guide video stays inside the screen, fills it, and records the view', async ({ page, browser }, testInfo) => {
    const clip = await makePortraitClip(browser, testInfo.outputPath('clip'));
    const views: string[] = [];
    await stubVideoHub(page, clip, views);
    await loginAs(page, 'admin');
    await visit(page, '/admin/help/videos');

    await page.getByTestId('video-1').click();
    await expect(page.getByTestId('video-player')).toBeVisible();
    const video = page.locator('video');
    await expect(video).toBeVisible();
    // it starts by itself, time advances, and the loading spinner is gone (not stuck on top of the picture)
    await expect.poll(() => video.evaluate((v) => !(v as HTMLVideoElement).paused && (v as HTMLVideoElement).currentTime > 0.1), { timeout: 15_000 }).toBe(true);
    await expect(page.getByTestId('video-loading')).toHaveCount(0);
    await page.waitForTimeout(700); // let the modal's fade-in finish before the screenshot

    const vp = page.viewportSize()!;
    const box = (await video.boundingBox())!;
    const shot = path.join(__dirname, '..', '.artifacts', 'screenshots', testInfo.project.name, 'video-hub-player.png');
    fs.mkdirSync(path.dirname(shot), { recursive: true });
    await page.screenshot({ path: shot });
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1); // controls (bottom of the element) are reachable
    expect(box.height).toBeGreaterThan(vp.height * 0.8); // it fills the modal instead of shrinking to a corner

    expect(JSON.parse(views[0])).toEqual({ user_id: 'adm-0001', org_id: 'org-0001' });
    expect(await video.evaluate((v) => (v as HTMLVideoElement).hasAttribute('playsinline'))).toBe(true);

    await page.getByTestId('video-player-close').click();
    await expect(page.getByTestId('video-player')).toHaveCount(0);
  });

  test('a file the browser cannot decode shows the error instead of a broken player', async ({ page }) => {
    await stubVideoHub(page, Buffer.from('this is not a video'), []);
    await loginAs(page, 'admin');
    await visit(page, '/admin/help/videos');
    await page.getByTestId('video-1').click();
    await expect(page.getByText('Could not play this video')).toBeVisible({ timeout: 15_000 });
  });
});
