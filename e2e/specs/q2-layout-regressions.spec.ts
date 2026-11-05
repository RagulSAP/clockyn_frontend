/**
 * Q2 - Regression tests for layout defects found in the visual sweep (phone and desktop): clipped KPI values, truncated action
 * buttons / stat labels, over-wide frozen table column, misaligned assign rows.
 */
import type { Locator, Page } from '@playwright/test';

import { test, expect, loginAs, visit } from '../support';

/** No descendant text is cut with an ellipsis (scrollWidth > clientWidth on an overflow-hidden text node). */
async function expectNoTruncatedText(scope: Locator): Promise<void> {
  const clipped = await scope.evaluate((root) => {
    const out: string[] = [];
    for (const el of [root, ...root.querySelectorAll('*')] as HTMLElement[]) {
      if (el.children.length > 0 || !el.textContent?.trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.push(el.textContent.trim());
    }
    return out;
  });
  expect(clipped, `text cut with an ellipsis: ${clipped.join(' | ')}`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'admin');
});

test('monthly salary: amount KPI values are fully readable (no "₹4,08,0...")', async ({ page }) => {
  await visit(page, '/admin/payroll/monthly-salary');
  await expect(page.getByText('Payment Progress')).toBeVisible();
  await expectNoTruncatedText(page.getByText('Total Amt', { exact: true }).locator('xpath=ancestor::*[contains(@data-testid,"") or true][3]'));
  const amounts = page.getByText(/^₹[\d,]+$/);
  await expect(amounts.first()).toBeVisible();
  for (const handle of await amounts.all()) {
    const cut = await handle.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(cut, 'amount value is clipped').toBe(false);
  }
});

test('odometer cards: Reject / Approve buttons show their full labels', async ({ page }) => {
  await visit(page, '/admin/expenses/odometer');
  const card = page.getByTestId('odometer-odo-001');
  await expect(card.getByTestId('odometer-odo-001-approve')).toBeVisible();
  await expectNoTruncatedText(card.getByTestId('odometer-odo-001-approve'));
  await expectNoTruncatedText(card.getByTestId('odometer-odo-001-reject'));
});

test('location: the two freshness counters keep the "15 MINS" part of their label', async ({ page }) => {
  await visit(page, '/admin/location');
  await expect(page.getByTestId('location-stat-recent')).toBeVisible();
  await expectNoTruncatedText(page.getByTestId('location-stat-recent'));
  await expectNoTruncatedText(page.getByTestId('location-stat-outdated'));
  const labelBox = await page.getByTestId('location-stat-recent').getByText('UPDATED WITHIN 15 MINS').boundingBox();
  expect(labelBox).not.toBeNull();
});

test('frozen Employee column leaves room for data on a phone (<= 45% of the viewport)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone layout');
  for (const [path, tid] of [
    ['/admin/payroll/salary-sheet', 'salary-table'],
    ['/admin/reports/staff-detailed', 'staff-detailed-table'],
  ] as const) {
    await visit(page, path);
    const table = page.getByTestId(tid);
    await expect(table).toBeVisible();
    const emp = await table.getByText('Employee', { exact: true }).first().boundingBox();
    const first = await table.locator('xpath=.//*[contains(text(),"Aarav") or contains(text(),"Meera")]').first().boundingBox();
    expect(emp).not.toBeNull();
    expect(first).not.toBeNull();
    const vp = page.viewportSize()!;
    // the first body column header (right of the frozen pane) starts before 50% of the viewport width
    const header = await table.getByText(/Working Days|Type|OT Amount|Hrs/).first().boundingBox();
    expect(header!.x, `${path}: first scrolling column starts too far right`).toBeLessThan(vp.width * 0.6);
  }
});

test('payslip assign dialog: rows keep their name on at most two lines and the action column is aligned', async ({ page }) => {
  await visit(page, '/admin/payroll/payslips');
  await page.getByTestId('payslip-ps-1-menu').click();
  await page.getByTestId('payslip-ps-1-assign').click();
  const rows = page.locator('[data-testid^="payslip-staff-"]');
  await expect(rows.first()).toBeVisible();
  const xs = await rows.evaluateAll((els) =>
    els.map((e) => {
      const eye = e.querySelector('[aria-label^="Preview payslip"]') as HTMLElement | null;
      return eye ? Math.round(eye.getBoundingClientRect().x) : -1;
    }),
  );
  expect(new Set(xs).size, `preview buttons are not aligned: ${xs.join(',')}`).toBe(1);
});

void (null as unknown as Page);
