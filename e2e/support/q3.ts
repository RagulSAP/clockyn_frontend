/**
 * Helpers shared by the q3-* specs (staff / manager app + app-wide behaviour).
 * Kept out of support/index.ts so parallel QA leads do not edit the same barrel file.
 */
import path from 'node:path';

import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

import { USERS, type Role } from './fixtures';

const artifactsRoot = process.env.E2E_ARTIFACTS ? path.resolve(__dirname, '..', '..', process.env.E2E_ARTIFACTS) : path.resolve(__dirname, '..', '.artifacts');

/** Save a visual-QA screenshot to `<artifacts>/screenshots-q3/<project>/<name>.png` (reviewed by eye, never asserted). */
export async function snap(page: Page, testInfo: TestInfo, name: string, opts: { fullPage?: boolean } = {}): Promise<void> {
  const file = path.join(artifactsRoot, 'screenshots-q3', testInfo.project.name, `${name}.png`);
  await page.screenshot({ path: file, fullPage: opts.fullPage ?? false, animations: 'disabled' });
}

/** Resolves once no horizontal overflow exists (document wider than the viewport) - a cheap layout-regression probe. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const over = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scroll: doc.scrollWidth, client: doc.clientWidth };
  });
  expect(over.scroll, `page scrolls horizontally (${over.scroll}px > ${over.client}px)`).toBeLessThanOrEqual(over.client + 1);
}

/** Session overrides that turn the seeded staff login into another staff row (the mock accepts every seeded token). */
export function asStaffRow(userId: string, name: string, deviceToken?: string) {
  return { userId, name, ...(deviceToken ? { deviceToken } : {}) };
}

export const userOf = (role: Role) => USERS[role];

/** Capture the fake-camera selfie of the face punch modal and wait for the outcome panel. */
export async function capturePunch(page: Page): Promise<void> {
  const modal = page.getByTestId('face-recognition-modal');
  await expect(modal).toBeVisible();
  const shutter = page.getByTestId('face-capture');
  await expect(shutter).toBeEnabled({ timeout: 15_000 });
  await shutter.click();
}

/** Run the 4-photo registration capture up to the preview panel. */
export async function captureRegistration(page: Page): Promise<void> {
  const shutter = page.getByTestId('face-start-capture');
  await expect(shutter).toBeEnabled({ timeout: 15_000 });
  await shutter.click();
  await expect(page.getByText('Does this look clear?')).toBeVisible({ timeout: 20_000 });
}

/** IST "HH:mm" -> ISO instant today (+05:30) on the mock/browser calendar day. */
export function istToday(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00+05:30`;
}

export async function textOf(locator: Locator): Promise<string> {
  return ((await locator.textContent()) ?? '').trim();
}

// ─── date independence ──────────────────────────────────────────────────────────────────────────────────────────────

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** The machine's current IST instant with the day of the month replaced (default the 15th), as `...+05:30` ISO. */
export function midMonthInstant(day = 15, now: Date = new Date()): string {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return `${ist.getUTCFullYear()}-${pad2(ist.getUTCMonth() + 1)}-${pad2(day)}T${pad2(ist.getUTCHours())}:${pad2(ist.getUTCMinutes())}:${pad2(ist.getUTCSeconds())}+05:30`;
}

/**
 * Specs that need EARLIER days in the current calendar month (month grids, "this month" reports, date ranges) cannot pass
 * on the first days of a month: the mock seeds 45 days of history relative to "today", but a month only has `today - 1`
 * earlier days. Call this in `beforeEach` of such a spec: in the first 9 IST days of a month (or always with
 * `E2E_PIN_CLOCK=1`) it re-seeds the mock as if today were the 15th and moves the browser clock to the same instant (time
 * keeps running). On every other day it does nothing, so the spec runs on the real date.
 */
export async function pinMidMonthIfNeeded(page: Page, mock: { reset(patch?: { clock: string | null }): Promise<void> }): Promise<string | null> {
  const forced = process.env.E2E_PIN_CLOCK === '1';
  const istDay = new Date(Date.now() + 330 * 60_000).getUTCDate();
  if (!forced && istDay >= 10) return null;
  const iso = midMonthInstant(15);
  await mock.reset({ clock: iso });
  await page.clock.install({ time: new Date(iso) });
  return iso;
}
