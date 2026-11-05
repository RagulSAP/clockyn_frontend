/**
 * Helpers shared by the Q2 (admin operations) specs: themed screenshots, layout sanity checks, small UI utilities.
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

import { setDarkMode } from './theme';

const artifacts = process.env.E2E_ARTIFACTS ? path.resolve(__dirname, '..', '..', process.env.E2E_ARTIFACTS) : path.resolve(__dirname, '..', '.artifacts');

/** `screenshots/q2/<project>/<name>-<light|dark>.png` */
export async function shoot(page: Page, testInfo: TestInfo, name: string, scheme: 'light' | 'dark' = 'light'): Promise<string> {
  const dir = path.join(artifacts, 'screenshots', 'q2', testInfo.project.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${scheme}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

/** Screenshot the current screen in light and dark (restores light). */
export async function shootBoth(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await setDarkMode(page, false);
  await shoot(page, testInfo, name, 'light');
  await setDarkMode(page, true);
  await shoot(page, testInfo, name, 'dark');
  await setDarkMode(page, false);
}

/** The page must not scroll sideways (clipped / overflowing layout). */
export async function expectNoHorizontalOverflow(page: Page, tolerance = 2): Promise<void> {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, `horizontal overflow: scrollWidth ${scroll} > clientWidth ${client}`).toBeLessThanOrEqual(client + tolerance);
}

/** Every element of `locator` lies inside the viewport horizontally (not clipped off-screen). */
export async function expectInsideViewportX(page: Page, locator: Locator): Promise<void> {
  const vp = page.viewportSize();
  const box = await locator.boundingBox();
  expect(box, 'element has no box').not.toBeNull();
  if (box && vp) {
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  }
}

/** True for the phone project. */
export const isPhone = (testInfo: TestInfo): boolean => testInfo.project.name === 'phone';

/** Parse "₹1,23,456.50" / "₹ 12" style text to a number. */
export function rupees(textValue: string | null | undefined): number {
  const cleaned = String(textValue ?? '').replace(/[^0-9.\-]/g, '');
  return cleaned === '' ? NaN : Number(cleaned);
}

export const todayIst = (): string => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------------------------------------------------

export interface ExportProbe {
  blobs: { type: string; size: number }[];
  printCalls: number;
  printedHtml: string[];
  windowOpens: string[];
}

/**
 * Records every Blob handed to `URL.createObjectURL` (real mime + size of generated files), replaces `window.print` in the
 * page AND in every iframe (the web PDF path prints through a hidden iframe) with a recorder, and records `window.open` targets.
 * Must be called before the first navigation.
 */
export async function installExportProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const top = window.top as unknown as Record<string, unknown>;
    if (window === window.top) {
      w.__probe = { blobs: [], printCalls: 0, printedHtml: [], windowOpens: [] };
      const orig = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (obj: Blob | MediaSource) => {
        if (obj instanceof Blob) (w.__probe as ExportProbe).blobs.push({ type: obj.type, size: obj.size });
        return orig(obj);
      };
      const open = window.open.bind(window);
      window.open = (url?: string | URL, target?: string, features?: string) => {
        (w.__probe as ExportProbe).windowOpens.push(String(url));
        // keep the app flow (returns a window) without really navigating a popup
        void open;
        void target;
        void features;
        return {} as Window;
      };
    }
    window.print = () => {
      const probe = top.__probe as ExportProbe | undefined;
      if (!probe) return;
      probe.printCalls += 1;
      probe.printedHtml.push(document.documentElement.outerHTML);
    };
  });
}

export async function readProbe(page: Page): Promise<ExportProbe> {
  return page.evaluate(() => (window as unknown as { __probe: ExportProbe }).__probe);
}

/** Minimal CSV parser (RFC 4180: quotes, doubled quotes, CRLF / LF, quoted newlines). Strips a leading BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Create a staff member through the mock's real `/addstaff` endpoint (tenant = the worker origin). */
export async function addStaffViaApi(tenant: string, fields: { name: string; empId: string; mobile: string; email: string }): Promise<string> {
  const { MOCK_URL } = await import('./mock');
  const res = await fetch(`${MOCK_URL}/addstaff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-e2e-tenant': tenant },
    body: JSON.stringify({ user_id: 'adm-0001', name: fields.name, emp_id: fields.empId, mobile_number: fields.mobile, email: fields.email }),
  });
  const body = (await res.json()) as { user_id?: string; detail?: string };
  if (!res.ok || !body.user_id) throw new Error(`addstaff failed: ${res.status} ${JSON.stringify(body)}`);
  return body.user_id;
}

/** Call the mock backend's real API as a client would (tenant = the worker origin). Returns the parsed JSON body. */
export async function mockApi<T = Record<string, unknown>>(tenant: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const { MOCK_URL } = await import('./mock');
  const res = await fetch(`${MOCK_URL}${path}`, {
    method,
    headers: { 'x-e2e-tenant': tenant, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`mock ${method} ${path} -> ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** The IST calendar date `n` days from the mock's real-time today. */
export const istPlusDays = (n: number): string => new Date(Date.now() + 330 * 60_000 + n * 86_400_000).toISOString().slice(0, 10);
