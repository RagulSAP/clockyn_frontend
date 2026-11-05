/**
 * Selector helpers. Preference order: role/name -> visible text -> testID (the UI kit forwards `testID` as
 * `data-testid`, configured as Playwright's testIdAttribute).
 */
import { expect, type Locator, type Page } from '@playwright/test';

export const byTestId = (page: Page, id: string): Locator => page.getByTestId(id);

export const button = (page: Page, name: string | RegExp, opts: { exact?: boolean } = {}): Locator => page.getByRole('button', { name, exact: opts.exact });

export const link = (page: Page, name: string | RegExp): Locator => page.getByRole('link', { name });

export const heading = (page: Page, name: string | RegExp): Locator => page.getByRole('heading', { name });

/** Any element showing this text (substring unless `exact`). */
export const text = (page: Page, value: string | RegExp, opts: { exact?: boolean } = {}): Locator => page.getByText(value, { exact: opts.exact });

/** Field by its placeholder (the kit's `TextField` sets one per field). */
export const field = (page: Page, placeholder: string | RegExp): Locator => page.getByPlaceholder(placeholder);

/** Fill a testID'd TextField: the testID may sit on the wrapper or on the input itself. */
export async function fillTestId(page: Page, id: string, value: string): Promise<void> {
  const el = page.getByTestId(id);
  const input = el.locator('input, textarea');
  if ((await input.count()) > 0) await input.first().fill(value);
  else await el.fill(value);
}

/** Wait for a toast / inline message containing `message`. */
export async function expectToast(page: Page, message: string | RegExp, timeout = 8_000): Promise<void> {
  await expect(page.getByText(message).first()).toBeVisible({ timeout });
}

/** Resolve once the (possibly several) matching requests to the mock backend settled. */
export async function waitForApi(page: Page, pathPart: string, method?: string, timeout = 10_000) {
  return page.waitForResponse((r) => r.url().includes(pathPart) && (!method || r.request().method() === method), { timeout });
}

/** Confirm dialog buttons of the kit's `useConfirm()` (title/message vary per screen). */
export async function confirmDialog(page: Page, confirmText: string | RegExp = /confirm|yes|delete|ok/i): Promise<void> {
  await page.getByRole('button', { name: confirmText }).last().click();
}
