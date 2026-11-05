/**
 * Navigation helpers: wait until the Expo web app is booted, visit a route (with params), assert real content.
 */
import { expect, type Page } from '@playwright/test';

export type RouteParams = Record<string, string | number | boolean | undefined>;

/** `/admin/staff/detail?staffId=stf-0003` */
export function withParams(path: string, params: RouteParams = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const qs = q.toString();
  return qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path;
}

/** Wait until the in-app splash and the guard spinner are gone and the network is quiet. */
export async function waitForAppReady(page: Page, opts: { idle?: boolean; timeout?: number } = {}): Promise<void> {
  const timeout = opts.timeout ?? 20_000;
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('brand-splash')).toHaveCount(0, { timeout });
  await expect(page.getByTestId('guard-loading')).toHaveCount(0, { timeout });
  if (opts.idle !== false) {
    try {
      await page.waitForLoadState('networkidle', { timeout: Math.min(timeout, 10_000) });
    } catch {
      /* polling screens (10 s intervals, sockets) may never go fully idle: content assertions follow */
    }
  }
}

/** Navigate to an in-app path, then wait for the app to be ready. Returns the final pathname (after redirects). */
export async function visit(page: Page, path: string, params: RouteParams = {}, opts: { idle?: boolean; timeout?: number } = {}): Promise<string> {
  await page.goto(withParams(path, params));
  await waitForAppReady(page, opts);
  return new URL(page.url()).pathname;
}

/** Visible text of the app root (empty string when blank). */
export async function pageText(page: Page): Promise<string> {
  return (await page.locator('body').innerText()).trim();
}

/** The page shows real content: not blank, not the not-found screen, not stuck on the splash. */
export async function expectRendered(page: Page, opts: { minTextLength?: number } = {}): Promise<void> {
  await expect(page.getByText('Page not found', { exact: true })).toHaveCount(0);
  await expect
    .poll(async () => (await pageText(page)).length, { message: 'page rendered no visible text (blank screen?)', timeout: 10_000 })
    .toBeGreaterThanOrEqual(opts.minTextLength ?? 8);
}

/** Current pathname (+ search). */
export function currentPath(page: Page): string {
  const u = new URL(page.url());
  return `${u.pathname}${u.search}`;
}
