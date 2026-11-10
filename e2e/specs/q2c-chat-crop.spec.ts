/**
 * Q2c - Cropping a photo in the pre-send preview (direct chat; the same Composer serves group chat and Live Chat).
 *
 * Open the preview -> Crop -> drag a corner handle / move the rectangle -> aspect presets -> Done -> the preview shows the
 * smaller cropped photo and Send uploads that file (smaller than the original). Also: Reset to the original, Cancel / Escape
 * inside the crop step, no Crop button for documents and GIFs, and a TOUCH drag (CDP touch events) on the phone project.
 *
 * Set E2E_SHOT_DIR to also write screenshots of the crop step (never into the repo).
 */
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { test, expect, loginAs, visit, USERS } from '../support';
import { makePhotoPng } from '../support/photo';

const STAFF = USERS.staff;
const PHOTO = makePhotoPng(800, 600);
const photoFile = (name = 'site-photo.png') => ({ name, mimeType: 'image/png', buffer: PHOTO });

const shot = async (page: Page, name: string, testInfo: { project: { name: string } }) => {
  const dir = process.env.E2E_SHOT_DIR;
  if (dir) await page.screenshot({ path: path.join(dir, `${testInfo.project.name}-${name}.png`), animations: 'disabled' });
};

type TestFile = { name: string; mimeType: string; buffer: Buffer };

async function openConversation(page: Page): Promise<void> {
  await visit(page, '/admin/chat/direct');
  await page.getByTestId(`chat-row-${STAFF.userId}`).click();
  await expect(page.getByTestId('chat-input')).toBeVisible();
}

/** Picks `file` from the photo library (or the document picker) and waits for the preview. */
async function pick(page: Page, file: TestFile, via: 'Photo library' | 'Document' = 'Photo library'): Promise<void> {
  await page.getByRole('button', { name: 'Attach a file' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(via, { exact: true }).click();
  (await chooser).setFiles(file);
  await expect(page.getByTestId('attachment-preview')).toBeVisible();
}

async function openPreview(page: Page, file: TestFile = photoFile()): Promise<void> {
  await openConversation(page);
  await pick(page, file);
}

const naturalSize = (img: Locator) => img.evaluate((el) => ({ w: (el as HTMLImageElement).naturalWidth, h: (el as HTMLImageElement).naturalHeight }));

/** The picture element of the preview (expo-image renders an <img> on the web). */
const previewImg = (page: Page) => page.getByTestId('attachment-preview-image').locator('img').first();

async function box(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error('element has no box');
  return b;
}

const center = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

/** A real touch drag through the devtools protocol (touchstart / touchmove / touchend). */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= 8; i += 1) {
    const f = i / 8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

const sizeText = async (page: Page) => (await page.getByTestId('attachment-crop-size').innerText()).replace(/\s+/g, ' ').trim();
const parseSize = (text: string) => {
  const m = /(\d+)\s*\D\s*(\d+)\s*px/.exec(text);
  if (!m) throw new Error(`no size in "${text}"`);
  return { w: Number(m[1]), h: Number(m[2]) };
};

test.describe('crop in the attachment preview', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('drag a corner, apply, and Send uploads the smaller cropped file', async ({ page, mock }, testInfo) => {
    await openConversation(page);
    // baseline: the same photo sent as picked (the web picker may re-encode a PNG as JPEG, so measure what really goes out)
    await pick(page, photoFile());
    await page.getByTestId('attachment-preview-send').click();
    await expect(page.getByTestId('attachment-preview')).toBeHidden();
    const original = await mock.waitForRequest('/chat/send-file', { method: 'POST' });
    const originalSize = original.files?.[0].size ?? 0;
    expect(originalSize).toBeGreaterThan(10_000);

    await pick(page, photoFile());
    await expect(page.getByRole('img', { name: 'Photo to send' })).toBeVisible();
    await expect.poll(async () => (await naturalSize(previewImg(page))).w).toBe(800);

    await expect(page.getByTestId('attachment-preview-crop')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crop photo' })).toBeVisible();
    await shot(page, 'preview-with-crop-button', testInfo);
    await page.getByTestId('attachment-preview-crop').click();

    await expect(page.getByTestId('attachment-crop')).toBeVisible();
    for (const k of ['free', '1x1', '4x3', '16x9']) await expect(page.getByTestId(`attachment-crop-aspect-${k}`)).toBeVisible();
    const rect = page.getByTestId('attachment-crop-rect');
    await expect(rect).toBeVisible();
    await expect.poll(async () => parseSize(await sizeText(page))).toEqual({ w: 800, h: 600 });
    const full = await box(rect);
    await shot(page, 'crop-full-frame', testInfo);

    // drag the top-left handle towards the centre: the rectangle shrinks from that corner, the opposite corner stays
    const handle = page.getByTestId('attachment-crop-handle-tl');
    const hb = await box(handle);
    await mouseDrag(page, center(hb), { x: center(hb).x + full.width * 0.25, y: center(hb).y + full.height * 0.3 });
    await expect.poll(async () => (await box(rect)).width).toBeLessThan(full.width * 0.8);
    const shrunk = await box(rect);
    expect(shrunk.x + shrunk.width).toBeCloseTo(full.x + full.width, 0);
    expect(shrunk.y + shrunk.height).toBeCloseTo(full.y + full.height, 0);
    const dragged = parseSize(await sizeText(page));
    expect(dragged.w).toBeLessThan(700);
    expect(dragged.h).toBeLessThan(500);
    await shot(page, 'crop-after-drag', testInfo);

    // drag inside to move: size stays, position changes (it is flush with the bottom-right, so move up-left)
    await mouseDrag(page, center(shrunk), { x: center(shrunk).x - 30, y: center(shrunk).y - 30 });
    await expect.poll(async () => (await box(rect)).x).toBeLessThan(shrunk.x - 20);
    const moved = await box(rect);
    expect(moved.width).toBeCloseTo(shrunk.width, 0);
    expect(parseSize(await sizeText(page))).toEqual(dragged);

    await page.getByTestId('attachment-crop-done').click();
    await expect(page.getByTestId('attachment-crop')).toBeHidden();
    await expect(page.getByTestId('attachment-preview')).toBeVisible();
    // the preview now shows the cropped photo: the same file name, a smaller picture
    await expect(page.getByTestId('attachment-preview-name')).toHaveText(/^site-photo\.(png|jpg)$/);
    await expect.poll(async () => (await naturalSize(previewImg(page))).w).toBe(dragged.w);
    expect((await naturalSize(previewImg(page))).h).toBe(dragged.h);
    await shot(page, 'preview-after-crop', testInfo);

    await page.getByTestId('attachment-preview-send').click();
    await expect(page.getByTestId('attachment-preview')).toBeHidden();
    const call = await mock.waitForRequest('/chat/send-file', { method: 'POST', predicate: (r) => r.id !== original.id });
    expect(call.files?.[0]).toMatchObject({ field: 'file', mimetype: original.files?.[0].mimetype });
    expect(call.files?.[0].filename).toBe(original.files?.[0].filename); // same name, cropped content
    expect(call.files?.[0].size).toBeGreaterThan(0);
    expect(call.files?.[0].size).toBeLessThan(originalSize); // the cropped file, not the original
    await expect(page.getByLabel('Open photo').last()).toBeVisible();
  });

  test('aspect presets lock the shape; corner drags keep it; Reset and Cancel leave the original untouched', async ({ page, mock }) => {
    await openPreview(page);
    await page.getByTestId('attachment-preview-crop').click();
    const rect = page.getByTestId('attachment-crop-rect');
    await expect(rect).toBeVisible();
    await expect.poll(async () => parseSize(await sizeText(page))).toEqual({ w: 800, h: 600 });

    await page.getByTestId('attachment-crop-aspect-1x1').click();
    await expect.poll(async () => { const b = await box(rect); return Math.abs(b.width - b.height) < 1.5; }).toBe(true);
    expect(parseSize(await sizeText(page))).toEqual({ w: 600, h: 600 });

    await page.getByTestId('attachment-crop-aspect-16x9').click();
    await expect.poll(async () => { const b = await box(rect); return Math.abs(b.width / b.height - 16 / 9) < 0.03; }).toBe(true);
    expect(parseSize(await sizeText(page))).toEqual({ w: 800, h: 450 });

    // a corner drag keeps 16:9
    const hb = await box(page.getByTestId('attachment-crop-handle-br'));
    await mouseDrag(page, center(hb), { x: center(hb).x - 90, y: center(hb).y - 20 });
    await expect.poll(async () => (await box(rect)).width).toBeLessThan(300);
    const b = await box(rect);
    expect(b.width / b.height).toBeCloseTo(16 / 9, 1);

    // Reset: back to the whole photo, Free
    await page.getByTestId('attachment-crop-reset').click();
    await expect.poll(async () => parseSize(await sizeText(page))).toEqual({ w: 800, h: 600 });
    await expect(page.getByTestId('attachment-crop-aspect-free')).toHaveAttribute('aria-checked', 'true');

    // Cancel: nothing changed, nothing uploaded
    await page.getByTestId('attachment-crop-cancel').click();
    await expect(page.getByTestId('attachment-crop')).toBeHidden();
    await expect.poll(async () => (await naturalSize(previewImg(page))).w).toBe(800);
    expect(await mock.requests({ path: '/chat/send-file', method: 'POST' })).toHaveLength(0);
  });

  test('crop again, then Reset restores the original photo; Send uploads whichever is current', async ({ page, mock }) => {
    await openConversation(page);
    await pick(page, photoFile());
    for (const aspect of ['1x1', '4x3']) {
      await page.getByTestId('attachment-preview-crop').click();
      await expect(page.getByTestId('attachment-crop-rect')).toBeVisible();
      await page.getByTestId(`attachment-crop-aspect-${aspect}`).click();
      const text = await sizeText(page);
      await page.getByTestId('attachment-crop-done').click();
      await expect(page.getByTestId('attachment-crop')).toBeHidden();
      await expect.poll(async () => (await naturalSize(previewImg(page))).w).toBe(parseSize(text).w);
    }
    // second crop was made from the first one: 4:3 of a 600x600 square = 600x450
    expect(await naturalSize(previewImg(page))).toEqual({ w: 600, h: 450 });

    await page.getByTestId('attachment-preview-crop').click();
    await expect(page.getByTestId('attachment-crop-rect')).toBeVisible();
    await page.getByTestId('attachment-crop-reset').click();
    await expect(page.getByTestId('attachment-crop-rect')).toBeVisible();
    await expect.poll(async () => parseSize(await sizeText(page))).toEqual({ w: 800, h: 600 });
    await page.getByTestId('attachment-crop-cancel').click();
    await expect.poll(async () => (await naturalSize(previewImg(page))).w).toBe(800);

    await page.getByTestId('attachment-preview-send').click();
    const reset = await mock.waitForRequest('/chat/send-file', { method: 'POST' });
    // a plain send of the same pick, for comparison: byte for byte the same upload
    await pick(page, photoFile());
    await page.getByTestId('attachment-preview-send').click();
    const plain = await mock.waitForRequest('/chat/send-file', { method: 'POST', predicate: (r) => r.id !== reset.id });
    expect(reset.files?.[0].size).toBe(plain.files?.[0].size);
  });

  test('Escape inside the crop step closes only that step; a second Escape discards the pick', async ({ page, mock }) => {
    await openPreview(page);
    await page.getByTestId('attachment-preview-crop').click();
    await expect(page.getByTestId('attachment-crop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('attachment-crop')).toBeHidden();
    await expect(page.getByTestId('attachment-preview')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('attachment-preview')).toBeHidden();
    expect(await mock.requests({ path: '/chat/send-file', method: 'POST' })).toHaveLength(0);
  });

  test('documents and GIFs have no Crop button', async ({ page }) => {
    await openConversation(page);
    await pick(page, { name: 'report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') }, 'Document');
    await expect(page.getByTestId('attachment-preview-file')).toBeVisible();
    await expect(page.getByTestId('attachment-preview-crop')).toHaveCount(0);
    await page.getByTestId('attachment-preview-cancel').click();
    await expect(page.getByTestId('attachment-preview')).toBeHidden();

    await pick(page, { name: 'party.gif', mimeType: 'image/gif', buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') }, 'Document'); // the document picker keeps a GIF a GIF
    await expect(page.getByTestId('attachment-preview-image')).toBeVisible();
    await expect(page.getByTestId('attachment-preview-crop')).toHaveCount(0);
  });

  test('a touch drag on a handle resizes the crop (phone)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'touch emulation only exists on the phone project');
    await openPreview(page);
    await page.getByTestId('attachment-preview-crop').click();
    const rect = page.getByTestId('attachment-crop-rect');
    await expect(rect).toBeVisible();
    const full = await box(rect);
    const hb = await box(page.getByTestId('attachment-crop-handle-br'));
    await touchDrag(page, center(hb), { x: center(hb).x - full.width * 0.3, y: center(hb).y - full.height * 0.3 });
    await expect.poll(async () => (await box(rect)).width).toBeLessThan(full.width * 0.8);
    const after = await box(rect);
    expect(after.x).toBeCloseTo(full.x, 0); // the top-left corner stayed put
    await shot(page, 'crop-after-touch-drag', testInfo);
    await touchDrag(page, center(after), { x: center(after).x + 20, y: center(after).y + 40 });
    await expect.poll(async () => (await box(rect)).y).toBeGreaterThan(after.y + 15);
  });
});
