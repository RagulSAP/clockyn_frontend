/**
 * Q2 - Visual sweep of the admin-operations screens: screenshots (light + dark) per viewport into
 * `<artifacts>/screenshots/q2/<project>/`, plus automatic layout checks (no horizontal page overflow, no raw NaN / undefined).
 */
import type { Page } from '@playwright/test';

import { test, expect, loginAs, visit, setDarkMode } from '../support';
import { expectNoHorizontalOverflow, shoot } from '../support/q2';

interface Screen {
  name: string;
  path: string;
  params?: Record<string, string>;
  /** Text / test id that proves the screen is rendered with data. */
  ready: (page: Page) => ReturnType<Page['locator']>;
  /** Extra interaction before the shot (open a modal ...). */
  before?: (page: Page) => Promise<void>;
}

const tid = (id: string) => (page: Page) => page.getByTestId(id);
const text = (t: string | RegExp) => (page: Page) => page.getByText(t).first();

const SCREENS: Screen[] = [
  { name: 'payslips', path: '/admin/payroll/payslips', ready: tid('payslip-ps-1') },
  { name: 'payslip-edit', path: '/admin/payroll/payslips/edit', params: { templateId: 'ps-1' }, ready: tid('net-salary') },
  {
    name: 'payslip-assign-modal',
    path: '/admin/payroll/payslips',
    ready: tid('payslip-assign-modal'),
    before: async (p) => {
      await expect(p.getByTestId('payslip-ps-1')).toBeVisible();
      await p.getByTestId('payslip-ps-1-menu').click();
      await p.getByTestId('payslip-ps-1-assign').click();
      await expect(p.locator('[data-testid^="payslip-staff-"]').first()).toBeVisible();
    },
  },
  { name: 'daily-wages', path: '/admin/payroll/daily-wages', ready: tid('template-dw-1') },
  {
    name: 'daily-wages-form',
    path: '/admin/payroll/daily-wages',
    ready: tid('template-form-modal'),
    before: async (p) => {
      await p.getByTestId('template-add').click();
      await expect(p.getByTestId('template-form-modal')).toBeVisible();
      await p.getByTestId('template-form-save').click(); // shows the validation message
    },
  },
  { name: 'hourly', path: '/admin/payroll/hourly', ready: tid('template-hc-1') },
  { name: 'overtime', path: '/admin/payroll/overtime', ready: tid('template-inc-o1') },
  { name: 'bonus', path: '/admin/payroll/bonus', ready: tid('template-inc-b1') },
  { name: 'count-basis', path: '/admin/payroll/count-basis', ready: tid('template-inc-c1') },
  { name: 'turnover', path: '/admin/payroll/turnover', ready: tid('template-inc-t1') },
  { name: 'incentive', path: '/admin/payroll/incentive', ready: tid('incentive-count') },
  { name: 'monthly-salary', path: '/admin/payroll/monthly-salary', ready: text('Payment Progress') },
  { name: 'salary-sheet', path: '/admin/payroll/salary-sheet', ready: tid('salary-table') },
  {
    name: 'salary-advance-sheet',
    path: '/admin/payroll/salary-sheet',
    ready: text('Advance Details'),
    before: async (p) => {
      await expect(p.getByTestId('salary-table')).toBeVisible();
      await p.getByTestId('salary-table').getByText('Aarav Sharma', { exact: true }).first().click();
      await expect(p.getByText('₹1,000.00')).toBeVisible();
    },
  },
  { name: 'reports-hub', path: '/admin/reports', ready: tid('category-Attendance Reports') },
  { name: 'report-monthly', path: '/admin/reports/monthly-attendance', ready: tid('generate-pdf') },
  { name: 'report-staff-detailed', path: '/admin/reports/staff-detailed', ready: tid('staff-detailed-table') },
  { name: 'report-late', path: '/admin/reports/late', ready: tid('report-summary') },
  { name: 'report-overtime', path: '/admin/reports/overtime', ready: tid('overtime-table') },
  { name: 'report-employee-details', path: '/admin/reports/employee-details', ready: tid('employee-stf-0001') },
  { name: 'report-shifts', path: '/admin/reports/employee-shifts', ready: tid('employee-shifts-report') },
  { name: 'requests-hub', path: '/admin/requests', ready: tid('requests-hub-leave') },
  { name: 'requests-leave', path: '/admin/requests/leave', ready: tid('request-req-001') },
  { name: 'requests-permission', path: '/admin/requests/permission', ready: text('Bank work') },
  { name: 'requests-shift', path: '/admin/requests/shift-change', ready: tid('request-req-201') },
  { name: 'requests-device', path: '/admin/requests/device-change', ready: tid('request-req-301') },
  { name: 'expenses-odometer', path: '/admin/expenses/odometer', ready: tid('odometer-odo-001') },
  { name: 'expenses-travel', path: '/admin/expenses/travel', ready: tid('expense-exp-001') },
  { name: 'expenses-bills', path: '/admin/expenses/bills', ready: tid('expense-exp-005') },
  { name: 'location', path: '/admin/location', ready: tid('location-map') },
  { name: 'chat-direct-list', path: '/admin/chat/direct', ready: tid('chat-row-stf-0001') },
  { name: 'chat-direct-conversation', path: '/admin/chat/direct', params: { userId: 'stf-0001' }, ready: tid('chat-input') },
];

test.describe('visual sweep', () => {
  for (const screen of SCREENS) {
    test(screen.name, async ({ page }, testInfo) => {
      await loginAs(page, 'admin');
      await visit(page, screen.path, screen.params ?? {});
      if (screen.before) await screen.before(page);
      await expect(screen.ready(page)).toBeVisible();
      await expect(page.locator('body')).not.toContainText('NaN');
      await expect(page.locator('body')).not.toContainText('undefined');
      await setDarkMode(page, false);
      // modals are fixed overlays; the page behind may legitimately scroll, so the overflow check runs before them only
      if (!screen.before) await expectNoHorizontalOverflow(page);
      await shoot(page, testInfo, screen.name, 'light');
      await setDarkMode(page, true);
      await shoot(page, testInfo, screen.name, 'dark');
    });
  }
});
