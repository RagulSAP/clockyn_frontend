/**
 * Helpers for the q2b-* specs (admin group chat, announcements, CRM). Kept out of support/index.ts so parallel QA leads
 * do not edit the same barrel file.
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

import { setDarkMode } from './theme';

const artifactsRoot = process.env.E2E_ARTIFACTS ? path.resolve(__dirname, '..', '..', process.env.E2E_ARTIFACTS) : path.resolve(__dirname, '..', '.artifacts');

/** Visual-QA screenshot: `<artifacts>/screenshots-q2b/<project>/<name>-<light|dark>.png` (reviewed by eye, never asserted). */
export async function shot(page: Page, testInfo: TestInfo, name: string, scheme: 'light' | 'dark' = 'light'): Promise<string> {
  const dir = path.join(artifactsRoot, 'screenshots-q2b', testInfo.project.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${scheme}.png`);
  // let sheet / modal / theme transitions finish (visual capture only; assertions never rely on this)
  await page.evaluate(() => new Promise<void>((r) => setTimeout(r, 450)));
  await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
  return file;
}

/** Screenshot the current screen in light and dark (restores light). */
export async function shotBoth(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await setDarkMode(page, false);
  await shot(page, testInfo, name, 'light');
  await setDarkMode(page, true);
  await shot(page, testInfo, name, 'dark');
  await setDarkMode(page, false);
}

/** The document must not scroll sideways. */
export async function noHScroll(page: Page): Promise<void> {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, `horizontal overflow: scrollWidth ${scroll} > clientWidth ${client}`).toBeLessThanOrEqual(client + 1);
}

/** The locator's box lies inside the viewport horizontally. */
export async function insideX(page: Page, locator: Locator): Promise<void> {
  const vp = page.viewportSize();
  const box = await locator.boundingBox();
  expect(box, 'element has no box').not.toBeNull();
  if (box && vp) {
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  }
}

export const isPhone = (testInfo: TestInfo): boolean => testInfo.project.name === 'phone';

/** IST calendar date `n` days from today (real clock; the mock clock is real unless a spec moves it). */
export const istDay = (n = 0): string => new Date(Date.now() + 330 * 60_000 + n * 86_400_000).toISOString().slice(0, 10);

/** Contrast ratio (WCAG) of two `rgb()/rgba()` computed colours. */
export function contrast(a: string, b: string): number {
  const parse = (c: string): [number, number, number] => {
    const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
    return [m[0], m[1], m[2]];
  };
  const lum = ([r, g, bl]: [number, number, number]): number => {
    const f = (v: number): number => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const la = lum(parse(a));
  const lb = lum(parse(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** `2026-03-05` -> `05 Mar 2026` (the CRM display format). */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

/** `2026-03-05` -> `5 March 2026` (accessible name of a calendar day cell). */
export function calendarDayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

/** `2026-03-05` -> `05/03` (custom-date chip label). */
export const chipDate = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export interface WireLead {
  leads_id: string;
  client_name: string;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  work_status: string | null;
  created_date: string | null;
  created_at: string;
  lead_status: string;
  category_name: string;
  mobile_number: string;
  remarks: string;
  client_address: string;
}

/** Calendar day a lead is listed under (required date, else creation day) - same rule as the app. */
export const effectiveDay = (l: Pick<WireLead, 'created_date' | 'created_at'>): string => (l.created_date ?? l.created_at).slice(0, 10);

/** Overview buckets of a day's leads, computed from the mock's own data (independent of the app's logic). */
export function tally(leads: WireLead[]): Record<'total' | 'unassigned' | 'pending' | 'working' | 'completed' | 'carry_forward', number> {
  const out = { total: leads.length, unassigned: 0, pending: 0, working: 0, completed: 0, carry_forward: 0 };
  for (const l of leads) {
    if (l.work_status === 'carry_forward') out.carry_forward += 1;
    else if (!l.assigned_user_id) out.unassigned += 1;
    else if (l.work_status === 'working') out.working += 1;
    else if (l.work_status === 'completed') out.completed += 1;
    else out.pending += 1;
  }
  return out;
}
