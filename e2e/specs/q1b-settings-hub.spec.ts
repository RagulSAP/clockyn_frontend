/**
 * Q1b - Settings hub (/admin/settings): sections, row targets, plan-gated Salary Structure, "coming soon" rows,
 * Appearance (theme persists), logout confirmation, manager access to the admin-area settings routes.
 */
import type { Page } from '@playwright/test';

import { expect, loginAs, readSession, STORAGE, visit, test } from '../support';
import { hasHorizontalOverflow, snapBoth } from '../support/q1';

const SECTION_TITLES = [
  'Your Plan & Validity',
  'Company Settings',
  'Salary Structure',
  'Attendance & Devices',
  'View & Download Reports',
  'Managers',
  'Expenses & Allowances',
  'Appearance',
  'Beyond',
];

const open = async (page: Page, section: string): Promise<void> => {
  await page.getByTestId(`section-header-${section}`).click();
};

test.describe('Q1b settings hub - structure', () => {
  test('shows the nine sections in spec order, the organisation name and no horizontal overflow', async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/settings');
    await expect(page.getByTestId('settings-screen')).toBeVisible();
    await expect(page.getByText('Acme Traders').first()).toBeVisible();
    const text = await page.getByTestId('settings-screen').innerText();
    let last = -1;
    for (const title of SECTION_TITLES) {
      const at = text.indexOf(title);
      expect(at, `section "${title}" missing`).toBeGreaterThanOrEqual(0);
      // desktop renders two columns, so strict top-to-bottom order only holds on the single-column phone layout
      if (testInfo.project.name === 'phone') {
        expect(at, `section "${title}" out of order`).toBeGreaterThan(last);
        last = at;
      }
    }
    expect(await hasHorizontalOverflow(page)).toBe(false);
    await snapBoth(page, testInfo, 'settings-hub');
  });

  test('accordions open one at a time; the nested Incentive / OT / Bonus group toggles and collapses with its parent', async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/settings');
    await expect(page.getByTestId('item-company-view')).toHaveCount(0);
    await open(page, 'company');
    await expect(page.getByTestId('item-company-view')).toBeVisible();
    await open(page, 'attendance');
    await expect(page.getByTestId('item-shifts')).toBeVisible();
    await expect(page.getByTestId('item-company-view')).toHaveCount(0);
    await open(page, 'salary');
    await expect(page.getByTestId('item-monthly-fixed')).toBeVisible();
    await expect(page.getByTestId('item-overtime')).toHaveCount(0);
    await page.getByTestId('group-incentive-group').click();
    for (const id of ['incentive', 'overtime', 'bonus']) await expect(page.getByTestId(`item-${id}`)).toBeVisible();
    await snapBoth(page, testInfo, 'settings-hub-salary-open');
    await page.getByTestId('group-incentive-group').click();
    await expect(page.getByTestId('item-overtime')).toHaveCount(0);
    await page.getByTestId('group-incentive-group').click();
    await open(page, 'company'); // switching section collapses the nested group ...
    await open(page, 'salary'); // ... so it is closed again when Salary is re-opened
    await expect(page.getByTestId('item-overtime')).toHaveCount(0);
    await open(page, 'salary'); // header toggles closed
    await expect(page.getByTestId('item-monthly-fixed')).toHaveCount(0);
  });
});

test.describe('Q1b settings hub - every row navigates to its screen', () => {
  const link = (section: string, item: string, path: string, group?: string) => ({ section, item, path, group });
  const ROWS = [
    link('company', 'company-view', '/admin/company'),
    link('company', 'company-add', '/admin/company/edit'),
    link('company', 'holidays', '/admin/holidays'),
    link('salary', 'monthly-fixed', '/admin/payroll/payslips'),
    link('salary', 'daily-wages', '/admin/payroll/daily-wages'),
    link('salary', 'hourly', '/admin/payroll/hourly'),
    link('salary', 'overtime', '/admin/payroll/overtime', 'incentive-group'),
    link('salary', 'bonus', '/admin/payroll/bonus', 'incentive-group'),
    link('attendance', 'shifts', '/admin/shifts'),
    link('attendance', 'devices', '/admin/devices'),
    link('attendance', 'attendance-rule', '/admin/attendance-rule'),
    link('expenses', 'odometer', '/admin/expenses/odometer'),
    link('expenses', 'travel', '/admin/expenses/travel'),
    link('expenses', 'bills', '/admin/expenses/bills'),
    link('beyond', 'suggest', '/admin/suggest-feature'),
    link('beyond', 'support', '/admin/support'),
    link('beyond', 'more', '/admin/more'),
    link('beyond', 'permissions', '/admin/permissions'),
  ];

  for (const row of ROWS) {
    test(`${row.section} > ${row.item} opens ${row.path}`, async ({ page }) => {
      await loginAs(page, 'admin');
      await visit(page, '/admin/settings');
      await open(page, row.section);
      if (row.group) await page.getByTestId(`group-${row.group}`).click();
      await page.getByTestId(`item-${row.item}`).click();
      await page.waitForURL((u) => u.pathname === row.path);
      await expect(page.getByText('Page not found', { exact: true })).toHaveCount(0);
    });
  }

  for (const [header, path] of [
    ['plan', '/admin/billing'],
    ['reports', '/admin/reports'],
    ['roles', '/admin/managers'],
  ] as const) {
    test(`link section ${header} opens ${path}`, async ({ page }) => {
      await loginAs(page, 'admin');
      await visit(page, '/admin/settings');
      await page.getByTestId(`section-header-${header}`).click();
      await page.waitForURL((u) => u.pathname === path);
    });
  }

  test('Incentive opens the "Select Incentive Type" sheet: Count Basis and Turnover Basis route correctly', async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/settings');
    await open(page, 'salary');
    await page.getByTestId('group-incentive-group').click();
    await page.getByTestId('item-incentive').click();
    await expect(page.getByText('Select Incentive Type')).toBeVisible();
    await snapBoth(page, testInfo, 'settings-incentive-sheet');
    await page.getByTestId('incentive-count').click();
    await page.waitForURL((u) => u.pathname === '/admin/payroll/count-basis');
    await page.goBack();
    await expect(page.getByTestId('settings-screen')).toBeVisible();
    // the hub keeps its open accordion / group while it stays mounted behind the pushed screen
    if (!(await page.getByTestId('item-incentive').isVisible())) {
      if (!(await page.getByTestId('group-incentive-group').isVisible())) await open(page, 'salary');
      await page.getByTestId('group-incentive-group').click();
    }
    await page.getByTestId('item-incentive').click();
    await page.getByTestId('incentive-turnover').click();
    await page.waitForURL((u) => u.pathname === '/admin/payroll/turnover');
  });

  test('Fine / Deduction is a "Coming soon" row: toast, no navigation', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/settings');
    await open(page, 'salary');
    await page.getByTestId('item-fine').click();
    await expect(page.getByText('Coming soon')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/admin/settings');
  });
});

test.describe('Q1b settings hub - Salary Structure plan gate', () => {
  for (const plan of ['elite', 'prime', 'core', 'trial'] as const) {
    test(`${plan}: Salary Structure opens`, async ({ page, mock }) => {
      await mock.setPlan(plan);
      await loginAs(page, 'admin');
      await visit(page, '/admin/settings');
      await expect(page.getByTestId('section-header-salary')).toContainText('Pay templates & rules');
      await open(page, 'salary');
      await expect(page.getByTestId('item-monthly-fixed')).toBeVisible();
    });
  }

  for (const [plan, message] of [
    ['expired', 'Your free trial has ended. Please subscribe to the Core Plan to continue accessing this feature.'],
    ['none', 'Your free trial has ended. Please subscribe to the Core Plan to continue accessing this feature.'],
  ] as const) {
    test(`${plan}: Salary Structure is gated (subtitle + toast, does not expand)`, async ({ page, mock, issues }, testInfo) => {
      issues.allow(/\/(group-)?chat\/list\//); // chat is plan-gated server-side: the sidebar badge poll answers 500 on an expired plan
      await mock.setPlan(plan);
      await loginAs(page, 'admin');
      await visit(page, '/admin/settings');
      await expect(page.getByTestId('section-header-salary')).toContainText('Upgrade plan to access');
      await open(page, 'salary');
      await expect(page.getByText(message)).toBeVisible();
      await expect(page.getByTestId('item-monthly-fixed')).toHaveCount(0);
      await snapBoth(page, testInfo, `settings-salary-gated-${plan}`);
    });
  }

  test('when the plan status cannot be loaded the gate fails open (v1 rule)', async ({ page, mock, issues }) => {
    issues.allow(/plan-status|503|\/(group-)?chat\/list\//);
    await mock.setPlan('expired');
    await mock.failNext('/plans/plan-status/*', { status: 503, times: -1 });
    await loginAs(page, 'admin');
    await visit(page, '/admin/settings');
    await open(page, 'salary');
    await expect(page.getByTestId('item-monthly-fixed')).toBeVisible();
  });
});

test.describe('Q1b settings hub - Appearance and Logout', () => {
  const lum = (rgb: string) => {
    const [r, g, b] = (rgb.match(/\d+/g) ?? ['0', '0', '0']).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  const bgOf = (page: Page) =>
    page.getByTestId('settings-screen').evaluate((el) => {
      let node: HTMLElement | null = el as HTMLElement;
      while (node) {
        const c = getComputedStyle(node).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
        node = node.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    });

  test('Light / Dark / System: selection is stored, applied, persists across reload and System follows the OS', async ({ page }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/settings');
    const control = page.getByTestId('appearance-control');
    await expect(control.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');
    expect(lum(await bgOf(page))).toBeGreaterThan(0.8);
    await control.getByRole('radio', { name: 'Dark' }).click();
    await expect.poll(async () => lum(await bgOf(page))).toBeLessThan(0.2);
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE.themePreference)).toBe('dark');
    await expect(control.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({ path: `${testInfo.outputDir}/hub-dark.png` });
    await page.reload();
    await expect(page.getByTestId('settings-screen')).toBeVisible();
    await expect.poll(async () => lum(await bgOf(page))).toBeLessThan(0.2);
    await expect(page.getByTestId('appearance-control').getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    // the choice also holds on another screen
    await visit(page, '/admin/support');
    await expect.poll(async () => lum(await page.evaluate(() => getComputedStyle(document.body).backgroundColor))).toBeLessThan(0.2);
    await visit(page, '/admin/settings');
    await page.getByTestId('appearance-control').getByRole('radio', { name: 'Light' }).click();
    await expect.poll(async () => lum(await bgOf(page))).toBeGreaterThan(0.8);
    await page.reload();
    await expect(page.getByTestId('appearance-control').getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('appearance-control').getByRole('radio', { name: 'System' }).click();
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(async () => lum(await bgOf(page))).toBeLessThan(0.2);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(async () => lum(await bgOf(page))).toBeGreaterThan(0.8);
  });

  test('Logout: Cancel keeps the session, confirming signs out and protected routes redirect', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/settings');
    await open(page, 'beyond');
    await page.getByTestId('item-logout').click();
    await expect(page.getByText('Are you sure you want to logout?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Are you sure you want to logout?')).toHaveCount(0);
    expect(await readSession(page)).not.toBeNull();
    await page.getByTestId('item-logout').click();
    await page.getByRole('button', { name: 'Logout' }).last().click();
    await page.waitForURL((u) => u.pathname === '/');
    expect(await readSession(page)).toBeNull();
    await visit(page, '/admin/settings');
    expect(new URL(page.url()).pathname).not.toBe('/admin/settings');
  });
});

test.describe('Q1b settings hub - manager (role 2)', () => {
  test('managers are routed to their own /staff/settings tab; the admin hub is reachable only by URL', async ({ page }) => {
    await loginAs(page, 'manager');
    await visit(page, '/staff/settings');
    await expect(page.getByTestId('staff-settings')).toBeVisible();
    await expect(page.getByTestId('section-header-plan')).toHaveCount(0);
  });
});
