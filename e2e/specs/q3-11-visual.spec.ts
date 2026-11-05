/**
 * Q3 - Visual QA sweep: every staff / manager screen of the area in light and dark on both viewports
 * (desktop 1280x800 and phone 390x844 via the two projects). The screenshots land in
 * `<artifacts>/screenshots-q3/<project>/visual-<theme>-<name>.png` and are reviewed by eye. The assertions are
 * cheap structural checks that catch the usual layout regressions automatically:
 *   - no horizontal page overflow,
 *   - nothing wider than the viewport inside the content (clipped cards / off-screen buttons),
 *   - the screen shows real text, no stuck skeleton / spinner after load.
 */
import type { Page } from '@playwright/test';

import { expect, loginAs, test, USERS, visit, type Role } from '../support';
import { snap } from '../support/q3';

type Step = (page: Page) => Promise<void>;
interface Shot {
  name: string;
  role?: Role;
  path: string;
  ready: string;
  /** Extra interaction before the screenshot (open a sheet, pick a tab...). */
  act?: Step;
  prepare?: (mock: import('../support/mock').MockClient) => Promise<void>;
  clock?: string;
}

const ready = (id: string) => id;

const SHOTS: Shot[] = [
  { name: 'home', path: '/staff/home', ready: 'punch-button' },
  { name: 'home-working', role: 'fieldStaff', path: '/staff/home', ready: 'punch-button' },
  { name: 'attendance', path: '/staff/attendance', ready: 'attendance-calendar' },
  {
    name: 'attendance-day-sheet',
    path: '/staff/attendance',
    ready: 'attendance-calendar',
    act: async (page) => {
      const day = page.locator('[data-testid^="day-20"]').first();
      await day.click({ trial: true }).catch(() => undefined);
      const cells = await page.locator('[data-testid^="day-20"]').all();
      for (const c of cells) {
        await c.click();
        if (await page.getByTestId('day-sheet').isVisible().catch(() => false)) break;
      }
      await expect(page.getByTestId('day-sheet')).toBeVisible();
    },
  },
  { name: 'attendance-payslip', path: '/staff/attendance', ready: 'attendance-calendar', act: async (p) => { await p.getByTestId('open-payslip').click(); await expect(p.getByTestId('payslip-net')).toBeVisible(); } },
  { name: 'attendance-advance', path: '/staff/attendance', ready: 'attendance-calendar', act: async (p) => { await p.getByTestId('open-bonus').click(); await expect(p.getByTestId('advance-row')).toBeVisible(); } },
  { name: 'profile', path: '/staff/profile', ready: 'profile-name' },
  { name: 'profile-edit', path: '/staff/profile', ready: 'profile-name', act: async (p) => { await p.getByTestId('profile-edit').click(); await expect(p.getByTestId('profile-save')).toBeVisible(); } },
  { name: 'settings', path: '/staff/settings', ready: 'staff-settings' },
  { name: 'settings-manager', role: 'manager', path: '/staff/settings', ready: 'admin-shortcuts' },
  { name: 'permissions', path: '/staff/permissions', ready: 'permissions-screen' },
  { name: 'more', path: '/staff/more', ready: 'more-screen' },
  { name: 'requests-hub', path: '/staff/requests', ready: 'request-card-leave' },
  { name: 'leave', path: '/staff/requests/leave', ready: 'leave-request', act: async (p) => { await expect(p.getByTestId('calendar-loading')).toHaveCount(0); } },
  { name: 'permission', path: '/staff/requests/permission', ready: 'permission-request' },
  { name: 'shift-new', path: '/staff/requests/shift-change', ready: 'shift-change-request' },
  { name: 'shift-history', path: '/staff/requests/shift-change', ready: 'shift-change-request', act: async (p) => { await p.getByText('My Requests', { exact: true }).first().click(); } },
  { name: 'device-change', path: '/staff/requests/device-change', ready: 'device-change-request' },
  { name: 'device-change-login', path: '/device-change-request?userId=stf-0001&orgId=org-0001', ready: 'device-change-request' },
  { name: 'expenses-hub', path: '/staff/expenses', ready: 'expenses-hub' },
  { name: 'odometer', path: '/staff/expenses/odometer', ready: 'odometer-screen' },
  { name: 'odometer-stop', role: 'fieldStaff', path: '/staff/expenses/odometer', ready: 'reading-0' },
  { name: 'travel', path: '/staff/expenses/travel', ready: 'expense-upload-screen' },
  { name: 'bills', path: '/staff/expenses/bills', ready: 'expense-upload-screen' },
  { name: 'crm', path: '/staff/crm', ready: 'crm-emp-lead-lead-004' },
  { name: 'crm-empty', role: 'fieldStaff', path: '/staff/crm', ready: 'staff-crm' },
  { name: 'crm-blocked', path: '/staff/crm', ready: 'crm-plan-blocked', prepare: async (m) => { await m.setPlan('prime'); } },
  { name: 'chat-hub', path: '/staff/chat', ready: 'hub-card-individual' },
  { name: 'chat-direct', path: '/staff/chat/direct', ready: 'chat-list' },
  { name: 'chat-conversation', path: `/staff/chat/direct?userId=${USERS.admin.userId}`, ready: 'chat-input' },
  { name: 'chat-groups', path: '/staff/chat/groups', ready: 'group-list' },
  { name: 'chat-group-conversation', path: '/staff/chat/groups?groupId=grp-1', ready: 'chat-input' },
  { name: 'broadcast', path: '/staff/chat/broadcast', ready: 'broadcast-feed' },
  { name: 'targeted', path: '/staff/chat/targeted', ready: 'targeted-feed' },
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`visual sweep (${theme})`, () => {
    for (const shot of SHOTS) {
      test(`${shot.name}`, async ({ page, mock }, testInfo) => {
        await shot.prepare?.(mock);
        await loginAs(page, shot.role ?? 'staff', { theme });
        await visit(page, shot.path);
        await expect(page.getByTestId(ready(shot.ready)).first()).toBeVisible({ timeout: 20_000 });
        await shot.act?.(page);
        // structural checks
        await expect(page.getByTestId('guard-loading')).toHaveCount(0);
        const overflow = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
        expect(overflow.s, `${shot.name} overflows horizontally`).toBeLessThanOrEqual(overflow.c + 1);
        const clipped = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const out: string[] = [];
          for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-testid], button, [role="button"]'))) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const style = getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none') continue;
            if (r.right > vw + 2 && r.left < vw) out.push(`${el.getAttribute('data-testid') ?? el.textContent?.slice(0, 20)} -> right ${Math.round(r.right)} > ${vw}`);
          }
          return out.slice(0, 5);
        });
        expect(clipped, 'elements crossing the right edge of the viewport').toEqual([]);
        await snap(page, testInfo, `visual-${theme}-${shot.name}`, { fullPage: false });
      });
    }
  });
}
