/**
 * Q1 helpers: visual-QA screenshots (light + dark) and a few shared interaction utilities.
 * Imported directly by `q1-*.spec.ts` (not re-exported from index.ts, to keep other leads' edits conflict-free).
 */
import path from 'node:path';

import type { Page, TestInfo } from '@playwright/test';

const root = path.resolve(__dirname, '..', '..');
const artifacts = process.env.E2E_ARTIFACTS ? path.resolve(root, process.env.E2E_ARTIFACTS) : path.join(root, 'e2e', '.artifacts');

const frames = async (page: Page): Promise<void> => {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
};

/** Wait until fonts are loaded and two frames were painted (skeleton shimmer is not awaited: callers wait for content first). */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await frames(page);
}

/**
 * Take a light and a dark screenshot of the current screen: `<artifacts>/q1-shots/<project>/<name>-light.png|-dark.png`.
 * The colour scheme is switched by emulating `prefers-color-scheme` (the app follows the system by default) and restored.
 */
export async function snapBoth(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const dir = path.join(artifacts, 'q1-shots', testInfo.project.name);
  await page.emulateMedia({ colorScheme: 'light' });
  await settle(page);
  await page.screenshot({ path: path.join(dir, `${name}-light.png`) });
  await page.emulateMedia({ colorScheme: 'dark' });
  await settle(page);
  await page.screenshot({ path: path.join(dir, `${name}-dark.png`) });
  await page.emulateMedia({ colorScheme: 'light' });
  await settle(page);
}

/** True when the page has horizontal overflow (content wider than the viewport). */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}

/** 1x1 PNG used for upload tests. */
export const PNG_BYTES = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export const pngFile = (name = 'photo.png') => ({ name, mimeType: 'image/png', buffer: PNG_BYTES });

/** GET a mock endpoint directly (tenant-scoped) — used to compare UI numbers with the data the mock holds. */
export async function mockGet<T = unknown>(tenant: string, pathAndQuery: string): Promise<T> {
  const { MOCK_URL } = require('./mock') as { MOCK_URL: string };
  const res = await fetch(`${MOCK_URL}${pathAndQuery}`, { headers: { 'x-e2e-tenant': tenant } });
  if (!res.ok) throw new Error(`mock GET ${pathAndQuery} -> ${res.status}`);
  return (await res.json()) as T;
}

/** Open a kit `Select` (testID on its trigger) and choose an option by its visible name. */
export async function pickOption(page: Page, triggerTestId: string, optionName: string | RegExp): Promise<void> {
  await page.getByTestId(triggerTestId).click();
  await page.getByRole('radio', { name: optionName }).first().click();
}

/** Number shown in a `data-testid` element. */
export async function numberIn(page: Page, testId: string): Promise<number> {
  return Number((await page.getByTestId(testId).innerText()).replace(/[^\d.-]/g, ''));
}

/** Close the topmost dialog / sheet through its "Close dialog" (X) button (Escape only works while focus is inside the overlay). */
export async function closeOverlay(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Close dialog' }).last().click();
}

/** True when the element's text is clipped (single-line ellipsis or line-clamp). */
export async function isTruncated(locator: import('@playwright/test').Locator): Promise<boolean> {
  return locator.evaluate((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
}
