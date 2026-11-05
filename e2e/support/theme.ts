/** Dark-mode helpers. The app follows the system scheme unless a manual preference is stored. */
import type { Page } from '@playwright/test';

import { STORAGE } from './auth';

/**
 * Switch the live colour scheme. With the default 'system' preference the app reacts immediately to the emulated
 * `prefers-color-scheme` (no reload). Also forces the stored preference when `forcePreference` is set (then reload).
 */
export async function setDarkMode(page: Page, dark: boolean, opts: { forcePreference?: boolean } = {}): Promise<void> {
  await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
  if (opts.forcePreference) {
    await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [STORAGE.themePreference, dark ? 'dark' : 'light']);
    await page.reload();
  }
}

/** Seed the manual theme preference ('light' | 'dark' | 'system') before the first navigation. */
export async function presetTheme(page: Page, preference: 'light' | 'dark' | 'system'): Promise<void> {
  await page.addInitScript(([key, value]: string[]) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }, [STORAGE.themePreference, preference]);
}

/** Current effective scheme as seen by the page. */
export async function currentColorScheme(page: Page): Promise<'dark' | 'light'> {
  return page.evaluate(() => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
}
