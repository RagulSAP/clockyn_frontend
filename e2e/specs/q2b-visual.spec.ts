/**
 * Q2b - Visual QA of the admin comms + CRM screens: light + dark screenshots at both viewports (reviewed by eye, see
 * docs/qa/Q2b-e2e-report.md), plus cheap automatic layout probes (no horizontal overflow, key controls inside the viewport,
 * chat bubble text contrast).
 */
import type { Page } from '@playwright/test';

import { test, expect, loginAs, visit, USERS } from '../support';
import { contrast, insideX, noHScroll, shotBoth, isPhone } from '../support/q2b';

const open = async (page: Page, path: string, probe: string): Promise<void> => {
  await visit(page, path);
  await expect(page.getByTestId(probe).first()).toBeVisible();
};

test.describe('admin chat visuals', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('hub', async ({ page }, testInfo) => {
    await open(page, '/admin/chat', 'hub-card-group');
    await expect(page.getByTestId('hub-badge-group')).toBeVisible();
    await noHScroll(page);
    await shotBoth(page, testInfo, 'chat-hub');
  });

  test('group list, create group sheet, conversation, members, add staff', async ({ page, mock }, testInfo) => {
    await open(page, '/admin/chat/groups', 'group-row-grp-1');
    await noHScroll(page);
    await shotBoth(page, testInfo, 'group-list');

    await page.getByTestId('create-group').click();
    await expect(page.getByTestId('create-group-submit')).toBeVisible();
    await page.getByLabel('Group name').fill('Visual QA group');
    await page.getByTestId(`staff-pick-${USERS.staff.userId}`).click();
    await shotBoth(page, testInfo, 'group-create');
    await page.keyboard.press('Escape');

    await page.getByTestId('group-row-grp-1').click();
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await expect(page.getByTestId('message-list')).toContainText('Reminder: quarterly review on Friday.');
    await noHScroll(page);
    await shotBoth(page, testInfo, 'group-conversation');

    await mock.waitForSocket(USERS.admin.userId);
    await page.getByTestId('chat-menu').click();
    await shotBoth(page, testInfo, 'group-menu');
    await page.getByRole('button', { name: /View Members/ }).or(page.getByText('View Members')).first().click();
    await expect(page.getByText('Admin', { exact: true }).first()).toBeVisible();
    await shotBoth(page, testInfo, 'group-members');
    await page.keyboard.press('Escape');
  });

  test('bubble text contrast in both themes', async ({ page }) => {
    await open(page, '/admin/chat/groups', 'group-row-grp-1');
    await page.getByTestId('group-row-grp-1').click();
    const list = page.getByTestId('message-list');
    await expect(list).toContainText('Noted, thanks!');
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const text of ['Noted, thanks!', 'Reminder: quarterly review on Friday.', 'Welcome to the All Hands group.']) {
        const el = list.getByText(text);
        await expect(el).toBeVisible();
        const colors = await el.evaluate((node) => {
          const fg = getComputedStyle(node).color;
          let bg = 'rgba(0, 0, 0, 0)';
          for (let e: Element | null = node; e; e = e.parentElement) {
            const c = getComputedStyle(e).backgroundColor;
            if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
              bg = c;
              break;
            }
          }
          return { fg, bg };
        });
        expect(contrast(colors.fg, colors.bg), `${scheme}: "${text}" fg ${colors.fg} on ${colors.bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

test.describe('announcement visuals', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('compose, picker, history, targeted', async ({ page }, testInfo) => {
    await visit(page, '/admin/chat/announcements');
    await expect(page.getByTestId('announcement-title')).toBeVisible();
    await noHScroll(page);
    await shotBoth(page, testInfo, 'ann-compose');
    await page.getByRole('radio', { name: 'Select Staff' }).or(page.getByText('Select Staff', { exact: true })).first().click();
    await expect(page.getByTestId('staff-picker')).toBeVisible();
    await page.getByTestId('staff-select-all').click();
    await shotBoth(page, testInfo, 'ann-picker');
    await page.getByTestId('staff-picker-done').click();
    await shotBoth(page, testInfo, 'ann-compose-selected');
    if (isPhone(testInfo)) {
      await page.getByRole('tab', { name: /History/ }).or(page.getByText('History').first()).first().click();
    }
    await expect(page.getByTestId(`announcement-${'ann-1'}`)).toBeVisible();
    await shotBoth(page, testInfo, 'ann-history');

    await visit(page, '/admin/chat/announcements-targeted');
    await expect(page.getByTestId('announcement-title')).toBeVisible();
    await noHScroll(page);
    await shotBoth(page, testInfo, 'ann-targeted');
  });
});

test.describe('admin CRM visuals', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('hub, carry forward, lead details', async ({ page }, testInfo) => {
    await open(page, '/admin/crm', 'crm-menu-assign');
    await expect(page.getByTestId('crm-stats-grid')).toBeVisible();
    await noHScroll(page);
    await shotBoth(page, testInfo, 'crm-hub');
    await page.getByTestId('crm-lead-row-lead-004').click();
    await expect(page.getByTestId('crm-lead-detail')).toBeVisible();
    await shotBoth(page, testInfo, 'crm-lead-detail');
    await page.keyboard.press('Escape');
    if (isPhone(testInfo)) await page.getByRole('tab', { name: /Carry Forward/ }).or(page.getByText('Carry Forward Requests').first()).first().click();
    await expect(page.getByTestId('crm-cfr-cfr-1')).toBeVisible();
    await shotBoth(page, testInfo, 'crm-cfr');
  });

  test('assign list, assign view, enter lead, category sheet', async ({ page }, testInfo) => {
    await open(page, '/admin/crm/leads', 'crm-lead-card-lead-004');
    await noHScroll(page);
    await shotBoth(page, testInfo, 'crm-assign-list');
    await page.getByTestId('crm-assign-lead-004').click();
    await expect(page.getByTestId('crm-assign-branch')).toBeVisible();
    await noHScroll(page);
    await shotBoth(page, testInfo, 'crm-assign-view');

    await open(page, '/admin/crm/leads/edit', 'crm-lead-save');
    await noHScroll(page);
    await insideX(page, page.getByTestId('crm-lead-save'));
    await shotBoth(page, testInfo, 'crm-enter-lead');
    await page.getByTestId('crm-category-trigger').click();
    await expect(page.getByText('Select Category').first()).toBeVisible();
    await shotBoth(page, testInfo, 'crm-category-sheet');
  });

  test('edit lead prefilled', async ({ page }, testInfo) => {
    await open(page, '/admin/crm/leads/edit?leadId=lead-004', 'crm-lead-save');
    await shotBoth(page, testInfo, 'crm-edit-lead');
  });
});

test('CRM plan-blocked card', async ({ page, mock, issues }, testInfo) => {
  issues.allow(/chat\/list|group-chat\/list/);
  await mock.setPlan('expired');
  await loginAs(page, 'admin');
  await open(page, '/admin/crm', 'crm-plan-blocked');
  await shotBoth(page, testInfo, 'crm-plan-blocked');
});

test('staff feeds', async ({ page }, testInfo) => {
  await loginAs(page, 'staff');
  await visit(page, '/staff/chat/broadcast');
  await expect(page.getByTestId('broadcast-feed')).toBeVisible();
  await noHScroll(page);
  await shotBoth(page, testInfo, 'staff-broadcast');
  await visit(page, '/staff/chat/targeted');
  await expect(page.getByTestId('targeted-feed')).toBeVisible();
  await shotBoth(page, testInfo, 'staff-targeted');
});
