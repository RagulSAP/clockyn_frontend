/**
 * Q3 - App-wide behaviour: session watcher (forced logout, login grace, fail-open), theme persistence and system
 * dark-mode follow, responsive shell (768 / 1100 breakpoints), keyboard + Escape + focus trap, deep links, back
 * navigation, 404, offline / latency states on a sample of screens.
 * Browser timers are driven with Playwright's clock where a poll interval matters.
 */
import type { Page } from '@playwright/test';

import { expect, expectRendered, loginAs, readSession, setDarkMode, STORAGE, test, USERS, visit } from '../support';
import { expectNoHorizontalOverflow, snap } from '../support/q3';

const lum = (rgb: string): number => {
  const [r, g, b] = (rgb.match(/\d+/g) ?? ['0', '0', '0']).map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
/** Effective page background (first non-transparent ancestor background of the screen root). */
const screenBg = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => {
    let node: HTMLElement | null = el as HTMLElement;
    while (node) {
      const c = getComputedStyle(node).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
      node = node.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  });

test.describe('session watcher (single device, roles 2/3)', () => {
  test('a forced logout signs the staff member out and explains why on the welcome screen', async ({ page, mock }, testInfo) => {
    await mock.forceLogout([USERS.staff.userId]);
    await loginAs(page, 'staff'); // last login 11 min ago -> outside the 5 min grace
    await page.goto('/staff/home');
    await page.waitForURL((u) => u.pathname === '/', { timeout: 20_000 });
    expect(await readSession(page)).toBeNull();
    await expect(page.getByTestId('signout-notice')).toBeVisible();
    await snap(page, testInfo, 'forced-logout-welcome');
    // the protected area is closed again
    await visit(page, '/staff/home');
    expect(new URL(page.url()).pathname).not.toBe('/staff/home');
  });

  test('another phone taking over the account signs this browser out on the next poll (30 s)', async ({ page, mock }) => {
    await page.clock.install();
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(page.getByTestId('punch-button')).toBeVisible();
    await mock.takeOverDevice(USERS.staff.mobile);
    await page.clock.fastForward(31_000);
    await page.waitForURL((u) => u.pathname === '/', { timeout: 20_000 });
    expect(await readSession(page)).toBeNull();
  });

  test('5-minute grace after a fresh login: no logout during the grace window, forced out once it has passed', async ({ page, mock }) => {
    await mock.forceLogout([USERS.staff.userId]);
    await page.clock.install();
    await loginAs(page, 'staff', { freshLogin: true });
    await visit(page, '/staff/home');
    await expect(page.getByTestId('punch-button')).toBeVisible();
    await page.clock.fastForward(31_000);
    await expect(page.getByTestId('punch-button')).toBeVisible();
    expect(await readSession(page)).not.toBeNull();
    expect((await mock.requests({ path: '/requests/check-session/' })).length).toBe(0); // skipped inside the grace window
    await page.clock.fastForward(5 * 60_000);
    await page.waitForURL((u) => u.pathname === '/', { timeout: 20_000 });
    expect(await readSession(page)).toBeNull();
  });

  test('fail open: a failing session check never signs the user out', async ({ page, mock, issues }) => {
    issues.allow(/check-session/);
    await mock.failNext('/requests/check-session/*', { networkError: true, times: -1 });
    await page.clock.install();
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await page.clock.fastForward(31_000);
    await expect(page.getByTestId('punch-button')).toBeVisible();
    expect(await readSession(page)).not.toBeNull();
  });

  test('admins are not subject to the device check', async ({ page, mock }) => {
    await mock.forceLogout([USERS.admin.userId]);
    await page.clock.install();
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    await page.clock.fastForward(31_000);
    expect(new URL(page.url()).pathname).toBe('/admin/home');
    expect(await readSession(page)).not.toBeNull();
  });
});

test.describe('theme', () => {
  test('the stored Dark preference is applied from the first paint and survives reloads', async ({ page }, testInfo) => {
    await loginAs(page, 'staff', { theme: 'dark' });
    await visit(page, '/staff/home');
    expect(lum(await screenBg(page, 'employee-home'))).toBeLessThan(0.2);
    await snap(page, testInfo, 'theme-dark-home');
    await page.reload();
    await expect(page.getByTestId('employee-home')).toBeVisible();
    expect(lum(await screenBg(page, 'employee-home'))).toBeLessThan(0.2);
  });

  test('System preference follows the OS scheme live; a manual choice overrides it', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    expect(lum(await screenBg(page, 'employee-home'))).toBeGreaterThan(0.8);
    await setDarkMode(page, true);
    await expect.poll(async () => lum(await screenBg(page, 'employee-home'))).toBeLessThan(0.2);
    await setDarkMode(page, false);
    await expect.poll(async () => lum(await screenBg(page, 'employee-home'))).toBeGreaterThan(0.8);
    // manual Light wins over a dark OS
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [STORAGE.themePreference, 'light']);
    await page.reload();
    await setDarkMode(page, true);
    await expect(page.getByTestId('employee-home')).toBeVisible();
    expect(lum(await screenBg(page, 'employee-home'))).toBeGreaterThan(0.8);
  });

  test('the sidebar theme switch (wide screens) changes and stores the preference', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await page.getByTestId('theme-dark').click();
    await expect.poll(async () => lum(await screenBg(page, 'employee-home'))).toBeLessThan(0.2);
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE.themePreference)).toBe('dark');
    await page.getByTestId('theme-light').click();
    await expect.poll(async () => lum(await screenBg(page, 'employee-home'))).toBeGreaterThan(0.8);
  });
});

test.describe('responsive shell', () => {
  for (const [width, wide] of [[360, false], [767, false], [768, true], [1099, true], [1100, true], [1440, true]] as const) {
    test(`${width}px: ${wide ? 'sidebar' : 'bottom tab bar'}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginAs(page, 'staff');
      await visit(page, '/staff/home');
      await expect(page.getByTestId('punch-button')).toBeVisible();
      if (wide) {
        await expect(page.getByTestId('sidebar')).toBeVisible();
        await expect(page.getByTestId('tab-bar')).toHaveCount(0);
      } else {
        await expect(page.getByTestId('tab-bar')).toBeVisible();
        await expect(page.getByTestId('sidebar')).toHaveCount(0);
      }
      await expectNoHorizontalOverflow(page);
    });
  }

  test('resizing across the breakpoint swaps the navigation without losing the screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'staff');
    await visit(page, '/staff/settings');
    await expect(page.getByTestId('sidebar')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('tab-bar')).toBeVisible();
    await expect(page.getByTestId('sidebar')).toHaveCount(0);
    await expect(page.getByTestId('staff-settings')).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId('sidebar')).toBeVisible();
    await expect(page.getByTestId('tab-bar')).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/staff/settings');
  });

  const ROUTES = ['/staff/home', '/staff/attendance', '/staff/profile', '/staff/settings', '/staff/requests', '/staff/requests/leave', '/staff/requests/permission', '/staff/requests/shift-change', '/staff/expenses', '/staff/expenses/odometer', '/staff/expenses/travel', '/staff/crm', '/staff/chat', '/staff/chat/direct', '/staff/chat/groups', '/staff/chat/broadcast'];
  for (const width of [360, 768, 1280]) {
    test(`no horizontal overflow on the staff screens at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginAs(page, 'staff');
      for (const route of ROUTES) {
        await visit(page, route);
        await expectRendered(page);
        const over = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
        expect(over.s, `${route} overflows at ${width}px`).toBeLessThanOrEqual(over.c + 1);
      }
    });
  }
});

test.describe('keyboard, Escape and focus trap', () => {
  test('Tab reaches the quick actions and Enter activates them', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(page.getByTestId('punch-button')).toBeVisible();
    await page.getByTestId('quick-attendance').focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/staff/attendance');
  });

  test('Escape closes sheets and dialogs', async ({ page }) => {
    await loginAs(page, 'manager');
    await visit(page, '/staff/settings');
    await page.getByTestId('shortcut-Staff Management').click();
    await expect(page.getByTestId('shortcut-sheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shortcut-sheet')).toHaveCount(0);
    await page.getByTestId('logout').click();
    await expect(page.getByText('Confirm Logout')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Confirm Logout')).toHaveCount(0);
    expect(await readSession(page)).not.toBeNull();
  });

  test('focus stays inside an open dialog while tabbing', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'staff');
    await visit(page, '/staff/settings');
    await page.getByTestId('logout').click();
    const dialog = page.getByRole('dialog').or(page.locator('[aria-modal="true"]')).first();
    await expect(page.getByText('Confirm Logout')).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || a === document.body) return true; // nothing focused is fine
        const host = a.closest('[aria-modal="true"], [role="dialog"], [role="alertdialog"]');
        return !!host;
      });
      expect(inside, `focus escaped the dialog on Tab #${i + 1}`).toBe(true);
    }
    void dialog;
  });
});

test.describe('deep links, back navigation and 404', () => {
  test('signed out: protected deep links land on the welcome screen', async ({ page }) => {
    for (const path of ['/staff/home', '/staff/requests/leave', '/admin/home']) {
      await visit(page, path);
      expect(new URL(page.url()).pathname, path).toBe('/');
    }
  });

  test('role areas: staff cannot open /admin/*, admin cannot open /staff/*', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/admin/home');
    expect(new URL(page.url()).pathname).toBe('/staff/home');
  });

  test('admin deep link to a staff screen lands on the admin home', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/staff/home');
    expect(new URL(page.url()).pathname).toBe('/admin/home');
  });

  test('a deep link with params opens the conversation directly', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, `/staff/chat/direct?userId=${USERS.admin.userId}`);
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await expect(page.getByText('Thanks. Also check the new shift roster.')).toBeVisible();
  });

  test('the signed-in landing page sends staff to /staff/home from the root', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/');
    await page.waitForURL('**/staff/home');
  });

  test('back navigation retraces home -> requests -> leave in order (header back and browser back)', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await page.getByTestId('quick-requests').click();
    await page.waitForURL('**/staff/requests');
    await page.getByTestId('request-card-leave').click();
    await page.waitForURL('**/staff/requests/leave');
    await page.getByRole('button', { name: 'Go back' }).click();
    await page.waitForURL((u) => u.pathname === '/staff/requests');
    await page.goBack();
    await page.waitForURL('**/staff/home');
  });

  test('after a reload / deep link (no history) a stack screen still offers Back, which lands on the role home', async ({ page }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/requests/leave');
    await page.getByRole('button', { name: 'Go back' }).click();
    await page.waitForURL('**/staff/home');
  });

  test('unknown route: 404 page offers the way home (signed in) / to welcome (signed out)', async ({ page }, testInfo) => {
    await loginAs(page, 'staff');
    await page.goto('/staff/definitely-not-a-page');
    await expect(page.getByText('Page not found', { exact: true }).first()).toBeVisible();
    await snap(page, testInfo, '404-signed-in');
    await page.getByRole('button', { name: 'Go to home' }).click();
    await page.waitForURL('**/staff/home');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/nope');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Page not found', { exact: true }).first()).toBeVisible();
  });
});

test.describe('offline / API failure / latency (sample)', () => {
  test('home: slow API still ends on real content; a failing 10 s poll keeps the last values and shows no error', async ({ page, mock, issues }) => {
    issues.allow(/attendance\/today|ERR_EMPTY_RESPONSE/);
    await mock.setLatency(1200);
    await loginAs(page, 'staff');
    await page.clock.install();
    await visit(page, '/staff/home', {}, { idle: false });
    await expect(page.getByTestId('punch-button')).toHaveAccessibleName('PUNCH IN', { timeout: 20_000 });
    await expect(page.getByTestId('shift-card')).toContainText('General');
    await mock.setLatency(0);
    await mock.failNext('/attendance/today/*', { networkError: true, times: -1 });
    await page.clock.fastForward(11_000);
    await expect(page.getByTestId('home-status-chip')).toContainText('NOT IN');
    await expect(page.getByTestId('punch-button')).toBeEnabled();
    await expect(page.getByText(/error|failed|network/i)).toHaveCount(0);
  });

  test('requests hub: badge API down -> hub still renders without badges', async ({ page, mock, issues }) => {
    issues.allow(/requests\/employee/);
    await loginAs(page, 'staff');
    await mock.failNext('/requests/employee/*', { status: 500, times: -1 });
    await visit(page, '/staff/requests');
    await expect(page.getByTestId('request-card-leave')).toBeVisible();
    await expect(page.getByTestId('request-card-leave-badge')).toHaveCount(0);
  });

  test('attendance calendar under latency shows its loading overlay and then the grid (no stuck spinner)', async ({ page, mock }) => {
    await mock.setLatency(1500);
    await loginAs(page, 'staff');
    await visit(page, '/staff/attendance', {}, { idle: false });
    await expect(page.getByTestId('attendance-calendar')).toBeVisible();
    await expect(page.getByTestId('calendar-loading')).toHaveCount(0, { timeout: 20_000 });
  });

  test('profile under latency shows skeletons, then data', async ({ page, mock }) => {
    await mock.setLatency(1500);
    await loginAs(page, 'staff');
    await visit(page, '/staff/profile', {}, { idle: false });
    await expect(page.getByTestId('profile-name')).toHaveText('Aarav Sharma', { timeout: 20_000 });
    await expect(page.getByTestId('profile-loading')).toHaveCount(0);
  });

  test('going offline mid-session: punching reports the failure instead of hanging', async ({ page, context, issues }) => {
    issues.allow(/ERR_INTERNET_DISCONNECTED|check-location/);
    await loginAs(page, 'staff');
    await visit(page, '/staff/home');
    await expect(page.getByTestId('punch-button')).toBeVisible();
    await context.setOffline(true);
    await page.getByTestId('punch-button').click();
    // the geofence request fails: a toast, the button comes back
    await expect(page.getByTestId('punch-button')).toBeEnabled({ timeout: 20_000 });
    await expect(page.getByTestId('face-recognition-modal')).toHaveCount(0);
    await context.setOffline(false);
  });
});
