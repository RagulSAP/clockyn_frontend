/**
 * Q1b - layout regression checks found during visual QA (phone stacking, clipping) and a loading-state capture.
 */
import path from 'node:path';

import type { Locator } from '@playwright/test';

import { expect, loginAs, visit, test } from '../support';
import { hasHorizontalOverflow, settle } from '../support/q1';
import { WORKED_CATALOGUE } from '../support/q1b';

const artifacts = process.env.E2E_ARTIFACTS ? path.resolve(__dirname, '..', '..', process.env.E2E_ARTIFACTS) : path.join(__dirname, '..', '.artifacts');

const box = async (l: Locator) => {
  const b = await l.boundingBox();
  if (!b) throw new Error('element has no box');
  return b;
};

test.describe('Q1b layout (phone stacking)', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'stacked layout only exists on phones');
  });

  test('upgrade configurator: cards stack without overlapping (Features card no longer clipped under Staff Limit)', async ({ page, mock }) => {
    await mock.setState({ catalogue: WORKED_CATALOGUE, subscription: { staff_limit: 12 } });
    await mock.setPlan('core');
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing/upgrade', { mode: 'new', planId: 2 });
    const features = await box(page.getByTestId('upgrade-features-card'));
    const staff = await box(page.getByTestId('upgrade-staff-card'));
    expect(staff.y).toBeGreaterThanOrEqual(features.y + features.height - 1);
    // the Features card shows all of its chips (Prime = 4 features)
    for (const f of ['Chat', 'Payslips', 'Geo Fencing Attendance', 'GPS Live Location']) {
      const chip = page.getByTestId('upgrade-features-card').getByText(f, { exact: true });
      const c = await box(chip);
      expect(c.y + c.height).toBeLessThanOrEqual(features.y + features.height + 1);
    }
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('payment summary: plan card and price breakdown are adjacent (no blank stretch between them)', async ({ page, mock }) => {
    await mock.setState({ catalogue: WORKED_CATALOGUE });
    await mock.setPlan('none');
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing/checkout', { mode: 'new', planId: 2, staff: 15 });
    const plan = await box(page.getByTestId('checkout-plan-card'));
    const breakdown = await box(page.getByTestId('price-breakdown'));
    expect(breakdown.y - (plan.y + plan.height)).toBeLessThan(40);
  });

  test('billing overview: status card and the Billing Actions list are adjacent', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/billing');
    const card = await box(page.getByTestId('plan-status-card'));
    const first = await box(page.getByTestId('action-plan-details'));
    expect(first.y - (card.y + card.height)).toBeLessThan(110); // section header + gaps only
  });

  test('support: the ticket list follows the form directly', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/support');
    const form = await box(page.getByTestId('support-form'));
    const ticket = await box(page.getByTestId('ticket-tkt-1'));
    expect(ticket.y - (form.y + form.height)).toBeLessThan(100); // "My Tickets" header + gaps only
  });
});

test.describe('Q1b layout (all viewports)', () => {
  test('permission cards clip their accent bar to the rounded card', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/permissions');
    const overflow = await page.getByTestId('permission-location').evaluate((e) => getComputedStyle(e).overflow);
    expect(overflow).toBe('hidden');
  });

  test('loading state: skeleton while the subscription loads, then content (capture for review)', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'admin');
    await mock.setLatency(1500);
    await page.goto('/admin/billing');
    await expect(page.getByTestId('subscription-screen')).toBeVisible({ timeout: 20_000 });
    await settle(page);
    await page.screenshot({ path: path.join(artifacts, 'q1-shots', testInfo.project.name, 'billing-loading.png') });
    await expect(page.getByTestId('plan-state-badge')).toHaveText('ACTIVE', { timeout: 20_000 });
  });
});
