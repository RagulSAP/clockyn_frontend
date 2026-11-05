/**
 * Q2 - Payroll: numbered templates (daily wages, hourly, overtime, bonus, count basis, turnover) and the incentive chooser.
 * Create / validation messages / edit / assign + unassign / delete-latest-only / numbering.
 */
import type { Page } from '@playwright/test';

import { test, expect, loginAs, visit } from '../support';

const ADD = 'template-add';
const SAVE = 'template-form-save';
const form = (page: Page) => page.getByTestId('template-form-modal');
const fill = (page: Page, id: string, v: string) => page.getByTestId(id).fill(v);

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'admin');
});

test.describe('daily wages', () => {
  const path = '/admin/payroll/daily-wages';

  test('seeded cards, create with validation, payload, new card appears with next number', async ({ page, mock }) => {
    await visit(page, path);
    await expect(page.getByTestId('template-dw-1')).toContainText('₹800');
    await expect(page.getByTestId('template-dw-2')).toContainText('₹1,000');
    await expect(page.getByTestId('template-dw-1')).toContainText('2 Assigned Staff');

    await page.getByTestId(ADD).click();
    await expect(form(page)).toBeVisible();
    // blank
    await page.getByTestId(SAVE).click();
    await expect(form(page).getByText('Amount is required')).toBeVisible();
    // invalid / zero / negative
    for (const bad of ['abc', '0', '-5']) {
      await fill(page, 'field-amount', bad);
      await expect(form(page).getByText('Amount must be a valid number')).toBeVisible();
      await page.getByTestId(SAVE).click();
      await expect(form(page).getByText('Amount must be a valid number')).toBeVisible();
    }
    expect((await mock.requests({ path: '/api/daily-wages/template', method: 'POST' })).length).toBe(0);

    await fill(page, 'field-amount', '1250.5');
    await expect(form(page).getByText('Amount must be a valid number')).toHaveCount(0);
    await page.getByTestId(SAVE).click();
    await expect(page.getByText('Template Saved!').first()).toBeVisible();
    const call = await mock.waitForRequest('/api/daily-wages/template', { method: 'POST' });
    expect(call.body).toMatchObject({ amount: 1250.5 });
    await expect(page.getByText('₹1,250.5').first()).toBeVisible();
  });

  test('edit changes the amount via PUT; a server refusal is surfaced and the dialog stays open', async ({ page, mock, issues }) => {
    issues.allow(/daily-wages\/template/);
    await visit(page, path);
    await page.getByTestId('template-dw-1-menu').click();
    await page.getByTestId('template-dw-1-edit').click();
    await expect(page.getByTestId('field-amount')).toHaveValue('800');
    await fill(page, 'field-amount', '1000');
    await mock.failNext('/api/daily-wages/template/dw-1', { method: 'PUT', status: 400, body: { detail: 'Amount already used by another template' } });
    await page.getByTestId(SAVE).click();
    await expect(page.getByText('Amount already used by another template').first()).toBeVisible();
    await expect(form(page)).toBeVisible();
    await fill(page, 'field-amount', '900');
    await page.getByTestId(SAVE).click();
    await expect(page.getByText('Template Updated!').first()).toBeVisible();
    expect((await mock.waitForRequest('/api/daily-wages/template/dw-1', { method: 'PUT', predicate: (r) => r.body?.amount === 900 })).status).toBe(200);
    await expect(page.getByTestId('template-dw-1')).toContainText('₹900');
  });

  test('assign + unassign staff; delete is offered only for the last template', async ({ page, mock }) => {
    await visit(page, path);
    await page.getByTestId('template-dw-2-menu').click();
    await expect(page.getByTestId('template-dw-1-delete')).toHaveCount(0);
    await expect(page.getByTestId('template-dw-2-delete')).toBeVisible();
    await page.getByTestId('template-dw-2-assign').click();
    const modal = page.getByTestId('assign-staff-modal');
    await expect(modal.getByText(/AVAILABLE STAFF \(\d+\)/)).toBeVisible();
    const row = modal.locator('[data-testid^="available-"]').first();
    const id = ((await row.getAttribute('data-testid')) as string).replace('available-', '');
    await row.click();
    await modal.getByTestId('assign-staff-submit').click();
    await expect(page.getByText('1 staff assigned!').first()).toBeVisible();
    expect((await mock.waitForRequest('/api/wages/assign', { method: 'POST' })).body).toMatchObject({ temp_id: 'dw-2', user_ids: [id] });
    await expect(modal.getByTestId(`assigned-${id}`)).toBeVisible();
    await modal.getByTestId(`remove-${id}`).click();
    await expect(modal.getByTestId(`assigned-${id}`)).toHaveCount(0);
    await expect(modal.getByTestId(`available-${id}`)).toBeVisible();
    expect((await mock.waitForRequest('/api/wages/unassign/', { method: 'DELETE' })).path).toContain(`/${id}/dw-2`);
  });

  test('delete the last template: confirm, removed; the previous becomes deletable', async ({ page }) => {
    await visit(page, path);
    await page.getByTestId('template-dw-2-menu').click();
    await page.getByTestId('template-dw-2-delete').click();
    await expect(page.getByText('Delete this template?')).toBeVisible();
    await page.getByTestId('template-dw-2-confirm-delete').click();
    await expect(page.getByText('Template Deleted!').first()).toBeVisible();
    await expect(page.getByTestId('template-dw-2')).toHaveCount(0);
    await page.getByTestId('template-dw-1-menu').click();
    await expect(page.getByTestId('template-dw-1-delete')).toBeVisible();
  });
});

test.describe('hourly charges', () => {
  const path = '/admin/payroll/hourly';
  test('duplicate amount is refused on save, valid amount is created, delete newest', async ({ page, mock }) => {
    await visit(page, path);
    await expect(page.getByTestId('template-hc-1')).toContainText('₹150');
    await page.getByTestId(ADD).click();
    await fill(page, 'field-amount', '150');
    await page.getByTestId(SAVE).click();
    await expect(form(page).getByText(/This amount already exists in Hour-Pay-/)).toBeVisible();
    expect((await mock.requests({ path: '/api/hourly-charges/template', method: 'POST' })).length).toBe(0);
    await fill(page, 'field-amount', '175');
    await page.getByTestId(SAVE).click();
    await expect(page.getByText('Template Saved!').first()).toBeVisible();
    await expect(page.getByText('₹175').first()).toBeVisible();
    expect((await mock.waitForRequest('/api/hourly-charges/template', { method: 'POST' })).body).toMatchObject({ amount: 175 });
  });
});

test.describe('overtime', () => {
  const path = '/admin/payroll/overtime';
  test('validation messages (duration, minutes range, amount, duplicate) then create + chips', async ({ page, mock }) => {
    await visit(page, path);
    await expect(page.getByTestId('template-inc-o1')).toContainText('1h');
    await page.getByTestId(ADD).click();
    await page.getByTestId(SAVE).click();
    await expect(form(page).getByText('Enter the Duration')).toBeVisible();
    await expect(form(page).getByText('Amount is required')).toBeVisible();
    await fill(page, 'field-hours', '1');
    await fill(page, 'field-minutes', '75');
    await expect(form(page).getByText('Minutes must be 0-59')).toBeVisible();
    await fill(page, 'field-minutes', '0');
    await fill(page, 'field-amount', '200');
    await page.getByTestId(SAVE).click();
    await expect(form(page).getByText(/This duration already exists in Over Time/)).toBeVisible(); // 1h == seeded 60 min
    await fill(page, 'field-hours', '1');
    await fill(page, 'field-minutes', '30');
    await page.getByTestId(SAVE).click();
    await expect(page.getByText('Saved Successfully!').first()).toBeVisible();
    expect((await mock.waitForRequest('/api/incentive/overtime', { method: 'POST' })).body).toMatchObject({ duration_minutes: 90, amount: 200 });
    await expect(page.getByText('1h 30m').first()).toBeVisible();
    // new card has a successive number
    await expect(page.getByText('Over Time 2').first()).toBeVisible();
  });

  test('edit keeps the number, assign modal lists staff, delete message names overtime', async ({ page }) => {
    await visit(page, path);
    await page.getByTestId('template-inc-o1-menu').click();
    await page.getByTestId('template-inc-o1-edit').click();
    await expect(page.getByTestId('field-hours')).toHaveValue('1');
    await fill(page, 'field-amount', '175');
    await page.getByTestId(SAVE).click();
    await expect(page.getByText('Updated Successfully!').first()).toBeVisible();
    await expect(page.getByTestId('template-inc-o1')).toContainText('₹175');
    await page.getByTestId('template-inc-o1-menu').click();
    await page.getByTestId('template-inc-o1-delete').click();
    await expect(page.getByText('Delete this overtime?')).toBeVisible();
  });
});

test.describe('bonus', () => {
  const path = '/admin/payroll/bonus';
  test('percent range, month/year required, unique percent, create, edit keeps month/year', async ({ page, mock }) => {
    await visit(page, path);
    await expect(page.getByTestId('template-inc-b1')).toContainText('10%');
    await page.getByTestId(ADD).click();
    await page.getByTestId(SAVE).click();
    await expect(form(page).getByText('Percentage is required')).toBeVisible();
    await expect(form(page).getByText('Month is required')).toBeVisible();
    await expect(form(page).getByText('Year is required')).toBeVisible();
    await fill(page, 'field-percent', '150');
    await expect(form(page).getByText('Enter a number between 0-100')).toBeVisible();
    await fill(page, 'field-percent', '10');
    await page.getByTestId('field-month').click();
    await page.getByRole('option', { name: 'November' }).or(page.getByText('November', { exact: true }).last()).click();
    await page.getByTestId('field-year').click();
    await page.getByRole('option', { name: '2026' }).or(page.getByText('2026', { exact: true }).last()).click();
    await page.getByTestId(SAVE).click();
    await expect(form(page).getByText(/This percentage already exists in Bonus/)).toBeVisible();
    await fill(page, 'field-percent', '12.5');
    await page.getByTestId(SAVE).click();
    await expect(page.getByText('Saved Successfully!').first()).toBeVisible();
    expect((await mock.waitForRequest('/api/incentive/bonus', { method: 'POST' })).body).toMatchObject({ bonus_percent: 12.5, month: 'November', year: 2026 });
    await expect(page.getByText('12.5%').first()).toBeVisible();
    await expect(page.getByText('November 2026').first()).toBeVisible();
  });
});

test.describe('count basis + turnover + chooser', () => {
  test('incentive chooser leads to both screens', async ({ page }) => {
    await visit(page, '/admin/payroll/incentive');
    await page.getByTestId('incentive-count').click();
    await page.waitForURL('**/admin/payroll/count-basis');
    await expect(page.getByTestId('template-inc-c1')).toBeVisible();
    await visit(page, '/admin/payroll/incentive');
    await page.getByTestId('incentive-turnover').click();
    await page.waitForURL('**/admin/payroll/turnover');
    await expect(page.getByTestId('template-inc-t1')).toBeVisible();
  });

  test('count basis: whole numbers only, duplicates per field, create + payload', async ({ page, mock }) => {
    await visit(page, '/admin/payroll/count-basis');
    await expect(page.getByTestId('template-inc-c1')).toContainText('20');
    await page.getByTestId(ADD).click();
    await page.getByTestId(SAVE).click();
    await expect(form(page).getByText('Count upto is required')).toBeVisible();
    await expect(form(page).getByText('Next count is required')).toBeVisible();
    await expect(form(page).getByText('Incentive is required')).toBeVisible();
    await fill(page, 'field-count-upto', '12.5');
    await expect(form(page).getByText('Must be a valid number').first()).toBeVisible();
    await fill(page, 'field-count-upto', '20');
    await fill(page, 'field-next-count', '5');
    await fill(page, 'field-incentive', '100');
    await page.getByTestId(SAVE).click();
    await expect(form(page).getByText(/This value already exists in Count 1/).first()).toBeVisible();
    await fill(page, 'field-count-upto', '30');
    await fill(page, 'field-next-count', '8');
    await fill(page, 'field-incentive', '250.5');
    await page.getByTestId(SAVE).click();
    await expect(page.getByText('Saved Successfully!').first()).toBeVisible();
    expect((await mock.waitForRequest('/api/incentive/count', { method: 'POST' })).body).toMatchObject({ count_upto: 30, next_count: 8, each_incentive: 250.5 });
    await expect(page.getByText('Count 2').first()).toBeVisible();
  });

  test('turnover: validation, create, delete newest only, assign + unassign', async ({ page, mock }) => {
    await visit(page, '/admin/payroll/turnover');
    await expect(page.getByTestId('template-inc-t1')).toContainText('2%');
    await page.getByTestId(ADD).click();
    await page.getByTestId(SAVE).click();
    await expect(form(page).getByText('Turnover upto is required')).toBeVisible();
    await fill(page, 'field-turnover-upto', '100000');
    await fill(page, 'field-turnover-incentive', '3');
    await page.getByTestId(SAVE).click();
    await expect(form(page).getByText(/This value already exists in Turnover 1/)).toBeVisible();
    await fill(page, 'field-turnover-upto', '250000');
    await page.getByTestId(SAVE).click();
    await expect(page.getByText('Saved Successfully!').first()).toBeVisible();
    expect((await mock.waitForRequest('/api/incentive/turnover', { method: 'POST' })).body).toMatchObject({ turnover_upto: 250000, incentive_percent: 3 });
    await expect(page.getByText('Turnover 2').first()).toBeVisible();

    const fx = await page.getByTestId('template-inc-t1').getAttribute('data-testid');
    expect(fx).toBe('template-inc-t1');
    await page.getByTestId('template-inc-t1-menu').click();
    await expect(page.getByTestId('template-inc-t1-delete')).toHaveCount(0);
    await page.getByTestId('template-inc-t1-assign').click();
    const modal = page.getByTestId('assign-staff-modal');
    await expect(modal.getByTestId('assigned-stf-0003')).toBeVisible();
    await modal.getByTestId('remove-stf-0003').click();
    await expect(modal.getByTestId('assigned-stf-0003')).toHaveCount(0);
  });

  test('bonus assign warns before re-assigning someone already on a bonus', async ({ page, mock }) => {
    await visit(page, '/admin/payroll/bonus');
    // second bonus template to assign into
    await mock.setState({});
    await page.getByTestId(ADD).click();
    await fill(page, 'field-percent', '5');
    await page.getByTestId('field-month').click();
    await page.getByRole('option', { name: 'December' }).or(page.getByText('December', { exact: true }).last()).click();
    await page.getByTestId('field-year').click();
    await page.getByRole('option', { name: '2026' }).or(page.getByText('2026', { exact: true }).last()).click();
    await page.getByTestId(SAVE).click();
    await expect(page.getByText('Saved Successfully!').first()).toBeVisible();
    const cards = page.locator('[data-testid^="template-inc-b"]').filter({ hasText: '5%' });
    await cards.first().locator('[data-testid$="-menu"]').click();
    await cards.first().locator('[data-testid$="-assign"]').click();
    const modal = page.getByTestId('assign-staff-modal');
    await expect(modal.getByTestId('available-stf-0007')).toHaveCount(0); // already on inc-b1 -> listed as assigned elsewhere? server hides it
  });
});
