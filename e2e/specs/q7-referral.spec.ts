/**
 * Q7 - Refer & Earn (org admin) and the optional referral code on company sign-up, web export against the stateful mock backend.
 *
 * Seed (mock-server/routes/referral.js): org-0001 has code K7M2QX and three referred organisations - Sunrise Traders (paid, reward USED:
 * Prime, Rs 200 off), Blue Orchid Retail (paid, reward AVAILABLE) and Greenfield Logistics (signed up, reward PENDING). `ZED4PQ` is "Zed Corp".
 * Covers: Settings row right after "Your Plan & Validity" -> screen -> code, copy code / copy message, Share (navigator.share), WhatsApp
 * (wa.me), referred list with chips, error + retry, admin-only; sign-up: auto-uppercase / 6 chars / alphanumeric, "Referred by <org>",
 * server message for a bad code with the other fields kept, `referral_code` sent (and omitted when empty), and a referred org's own reward.
 * Screenshots (phone project) go to $E2E_REFERRAL_SHOTS (default <artifacts>/referral-shots).
 */
import path from 'node:path';
import fs from 'node:fs';

import type { Page, TestInfo } from '@playwright/test';

import { expect, expectToast, loginAs, OTP, readSession, test, visit } from '../support';

const SHARE_MESSAGE =
  'Join me on Clockyn, the staff attendance and workforce app. Use my referral code K7M2QX when you create your account and we both get 10% off our plan.';
const UNREGISTERED = '9222200007';

const shotsDir = process.env.E2E_REFERRAL_SHOTS || path.join(__dirname, '..', '.artifacts', 'referral-shots');

/** Phone project only: a tall viewport so the whole (inner-scrolling) screen is captured, then back to the phone size. */
async function snap(page: Page, testInfo: TestInfo, name: string, opts: { tall?: boolean; settle?: number } = {}): Promise<void> {
  if (testInfo.project.name !== 'phone') return;
  await page.waitForTimeout(opts.settle ?? 900); // reveal animation + toasts
  fs.mkdirSync(shotsDir, { recursive: true });
  const original = page.viewportSize();
  if (opts.tall && original) {
    await page.setViewportSize({ width: original.width, height: 1900 });
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(shotsDir, `${name}.png`), animations: 'disabled' });
  if (opts.tall && original) await page.setViewportSize(original);
}

async function openReferralFromSettings(page: Page): Promise<void> {
  await visit(page, '/admin/settings');
  await expect(page.getByTestId('settings-screen')).toBeVisible();
  await page.getByTestId('section-header-referral').click();
  await page.waitForURL('**/admin/referral');
  await expect(page.getByTestId('referral-code')).toBeVisible();
}

const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

test.describe('Refer & Earn (admin)', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await loginAs(page, 'admin');
  });

  test('Settings has a Refer & Earn row right after "Your Plan & Validity"', async ({ page }, testInfo) => {
    await visit(page, '/admin/settings');
    const ids = await page.locator('[data-testid^="section-header-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(ids.slice(0, 2)).toEqual(['section-header-plan', 'section-header-referral']);
    await expect(page.getByTestId('section-header-referral')).toContainText('Refer & Earn');
    await snap(page, testInfo, 'settings-row');
  });

  test('Settings -> Refer & Earn: code visible, copy code, copy message, list of referred organisations', async ({ page }, testInfo) => {
    await openReferralFromSettings(page);

    // hero
    await expect(page.getByTestId('referral-code')).toHaveText('K7M2QX');
    await expect(page.getByText('10% off for you and your friend')).toBeVisible();
    await expect(page.getByTestId('referral-offer-copy')).toContainText('Prime and Elite plans only');
    await snap(page, testInfo, 'referral-top');

    // copy the code: confirmation + clipboard
    await page.getByTestId('referral-copy-code').click();
    await expectToast(page, 'Referral code copied');
    await expect(page.getByTestId('referral-copy-code')).toContainText('Copied');
    expect(await clipboard(page)).toBe('K7M2QX');

    // copy the whole message
    await page.getByTestId('referral-copy-message').click();
    await expectToast(page, 'Share message copied');
    expect(await clipboard(page)).toBe(SHARE_MESSAGE);

    // how it works + rewards + redeem hint
    await expect(page.getByText('How it works')).toBeVisible();
    await expect(page.getByTestId('referral-step-3')).toBeVisible();
    await expect(page.getByTestId('rewards-available-count')).toHaveText('1');
    await expect(page.getByTestId('rewards-pending-count')).toHaveText('1');
    await expect(page.getByTestId('rewards-used-count')).toHaveText('1');
    await expect(page.getByTestId('referral-redeem-hint')).toContainText('Open Your plan & validity > Renew or choose a plan and tap Apply next to the coupon box.');

    // the referred organisations (newest first) with status + reward chips
    await expect(page.getByTestId('referral-list')).toBeVisible();
    await expect(page.getByTestId('referral-row-0-name')).toHaveText('Greenfield Logistics');
    await expect(page.getByTestId('referral-row-0-status')).toContainText('Signed up');
    await expect(page.getByTestId('referral-row-0-reward')).toContainText('Pending');
    await expect(page.getByTestId('referral-row-0-reward-caption')).toHaveText('Unlocks when they pay');
    await expect(page.getByTestId('referral-row-1-name')).toHaveText('Blue Orchid Retail');
    await expect(page.getByTestId('referral-row-1-status')).toContainText('Paid');
    await expect(page.getByTestId('referral-row-1-reward')).toContainText('Available');
    await expect(page.getByTestId('referral-row-2-name')).toHaveText('Sunrise Traders');
    await expect(page.getByTestId('referral-row-2-reward')).toContainText('Used');
    await expect(page.getByTestId('referral-row-2-reward-caption')).toContainText('Prime - ₹200 off');
    await expect(page.getByTestId('referral-my-reward')).toHaveCount(0); // this org was not referred
    await snap(page, testInfo, 'referral-full', { tall: true });
  });

  test('Share uses the system share sheet (navigator.share) with the server message', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __shared: unknown[] }).__shared = [];
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: unknown) => {
          (window as unknown as { __shared: unknown[] }).__shared.push(data);
        },
      });
    });
    await openReferralFromSettings(page);
    await page.getByTestId('referral-share').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length)).toBe(1);
    const shared = (await page.evaluate(() => (window as unknown as { __shared: { text: string }[] }).__shared))[0];
    expect(shared.text).toBe(SHARE_MESSAGE);
  });

  test('Share degrades to copying the message when the browser has no Web Share', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }));
    await openReferralFromSettings(page);
    await page.getByTestId('referral-share').click();
    await expectToast(page, /Message copied/);
    expect(await clipboard(page)).toContain('K7M2QX');
  });

  test('WhatsApp opens wa.me with the encoded message', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __opened: string[] }).__opened = [];
      window.open = ((url?: string | URL) => {
        (window as unknown as { __opened: string[] }).__opened.push(String(url));
        return null;
      }) as typeof window.open;
    });
    await openReferralFromSettings(page);
    await page.getByTestId('referral-whatsapp').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened.length)).toBe(1);
    const [url] = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
    expect(url).toBe(`https://wa.me/?text=${encodeURIComponent(SHARE_MESSAGE)}`);
  });

  test('a failing load shows the error state and Try again recovers', async ({ page, mock, issues }) => {
    issues.allow(/referral/);
    await mock.failNext('/referral/org-0001', { status: 500, body: { detail: 'Referral service is down' }, times: 1 });
    await visit(page, '/admin/referral');
    await expect(page.getByTestId('referral-error')).toBeVisible();
    await expect(page.getByText('Referral service is down')).toBeVisible();
    await page.getByText('Try again').click();
    await expect(page.getByTestId('referral-code')).toHaveText('K7M2QX');
  });
});

test.describe('Refer & Earn (manager)', () => {
  test('a manager opening the route sees the admins-only message', async ({ page }) => {
    await loginAs(page, 'manager');
    await visit(page, '/admin/referral');
    await expect(page.getByTestId('referral-admin-only')).toBeVisible();
    await expect(page.getByTestId('referral-code')).toHaveCount(0);
  });
});

test.describe('Referral code on sign-up', () => {
  async function toRegister(page: Page): Promise<void> {
    await visit(page, '/admin-login');
    await page.getByTestId('mobile-input').fill(UNREGISTERED);
    await page.getByTestId('login-action').click();
    await page.getByTestId('otp-input').fill(OTP);
    await page.getByTestId('login-action').click();
    await page.waitForURL('**/register**');
    await expect(page.getByTestId('reg-mobile-verified')).toBeVisible();
  }

  async function fillCompany(page: Page): Promise<void> {
    await page.getByTestId('reg-org-name').fill('Zenith Retail');
    await page.getByTestId('reg-address').fill('12 Park Street');
    await page.getByTestId('reg-state').fill('Karnataka');
    await page.getByTestId('reg-district').fill('Bengaluru');
    await page.getByTestId('reg-pincode').fill('560001');
    await page.getByTestId('reg-email-input').fill('owner@zenith.example');
    await page.getByTestId('reg-email-get-otp').click();
    await page.getByTestId('reg-email-otp-input').fill(OTP);
    await page.getByTestId('reg-email-verify').click();
    await expect(page.getByTestId('reg-email-verified')).toBeVisible();
    await page.getByTestId('reg-branches-0').fill('HQ');
  }

  test('the field is optional, upper-cases, keeps 6 alphanumerics and shows "Referred by <org>"', async ({ page }, testInfo) => {
    await toRegister(page);
    const code = page.getByTestId('reg-referral-code');
    await code.scrollIntoViewIfNeeded();
    await expect(page.getByText('Referral code (optional)')).toBeVisible();
    await code.pressSequentially('k7m-2qx9!');
    await expect(code).toHaveValue('K7M2QX');
    await code.blur();
    await expect(page.getByTestId('reg-referral-valid')).toContainText('Referred by Acme Traders');
    await code.scrollIntoViewIfNeeded();
    await snap(page, testInfo, 'signup-referral-valid', { settle: 5000 });
  });

  test('a bad code shows the server message, blocks Register and keeps what was typed; clearing it unblocks', async ({ page }, testInfo) => {
    await toRegister(page);
    await fillCompany(page);
    await expect(page.getByTestId('register-submit')).toBeEnabled();

    const code = page.getByTestId('reg-referral-code');
    await code.fill('ZZZ999');
    await code.blur();
    await expect(page.getByText('This referral code is not valid')).toBeVisible();
    await expect(page.getByTestId('register-submit')).toBeDisabled();
    // nothing else was lost
    await expect(page.getByTestId('reg-org-name')).toHaveValue('Zenith Retail');
    await expect(page.getByTestId('reg-address')).toHaveValue('12 Park Street');
    await expect(page.getByTestId('reg-email-verified')).toBeVisible();
    await expect(page.getByTestId('reg-branches-0')).toHaveValue('HQ');
    await page.getByText('This referral code is not valid').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelectorAll('[data-testid="reg-referral-code"]').forEach((e) => e.scrollIntoView({ block: 'center' })));
    await snap(page, testInfo, 'signup-referral-invalid', { settle: 5000 });

    await code.fill('');
    await expect(page.getByText('This referral code is not valid')).toHaveCount(0);
    await expect(page.getByTestId('register-submit')).toBeEnabled();
  });

  test('a valid code is sent as referral_code and the new org starts with its own reward', async ({ page, mock }) => {
    await toRegister(page);
    await fillCompany(page);
    await page.getByTestId('reg-referral-code').fill('k7m2qx');
    await expect(page.getByTestId('reg-referral-valid')).toContainText('Referred by Acme Traders');
    await page.getByTestId('register-submit').click();
    await page.waitForURL('**/admin/home');
    const reg = await mock.lastRequest('/auth/register', 'POST');
    expect(reg?.body).toMatchObject({ org_name: 'Zenith Retail', referral_code: 'K7M2QX' });
    expect((await readSession(page))?.orgName).toBe('Zenith Retail');

    // the new org: no referrals yet (encouraging empty state) and a reward from the referrer
    await visit(page, '/admin/referral');
    await expect(page.getByTestId('referral-empty')).toBeVisible();
    await expect(page.getByTestId('referral-my-reward-title')).toHaveText('Referral reward from Acme Traders: 10% off your first plan');
    await expect(page.getByTestId('referral-my-reward-status')).toContainText('Available');
    await expect(page.getByTestId('rewards-available-count')).toHaveText('1');
  });

  test('without a code the request carries no referral_code', async ({ page, mock }) => {
    await toRegister(page);
    await fillCompany(page);
    await page.getByTestId('register-submit').click();
    await page.waitForURL('**/admin/home');
    const reg = await mock.lastRequest('/auth/register', 'POST');
    expect(reg?.body).toMatchObject({ org_name: 'Zenith Retail' });
    expect(reg?.body).not.toHaveProperty('referral_code');
  });
});
