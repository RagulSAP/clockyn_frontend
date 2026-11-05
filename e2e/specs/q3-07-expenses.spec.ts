/**
 * Q3 - Staff expenses: hub, odometer (start -> stop, validations, readings table), travel tickets and other bills
 * (photo + amount, upload failure -> retry without duplicates, date navigation clamped to today).
 * Photos use the browser file chooser (web `pickImage`), answered with Playwright's `filechooser` event.
 */
import type { Page } from '@playwright/test';

import { expect, loginAs, test, USERS, visit } from '../support';
import { snap } from '../support/q3';

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function takePhoto(page: Page, testId: string): Promise<void> {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId(`${testId}-add`).click()]);
  await chooser.setFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await expect(page.getByTestId(`${testId}-preview`)).toBeVisible();
}

test.describe('expenses hub', () => {
  test('three cards open odometer, travel tickets and other bills', async ({ page }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/expenses');
    await expect(page.getByText('Expenses are submitted for manager approval')).toBeVisible();
    await snap(page, testInfo, 'expenses-hub');
    for (const [key, path] of [['odo', '/staff/expenses/odometer'], ['travel', '/staff/expenses/travel'], ['bills', '/staff/expenses/bills']] as const) {
      await visit(page, '/staff/expenses');
      await page.getByTestId(`expense-card-${key}`).click();
      await page.waitForURL(`**${path}`);
    }
  });

  test('a failing pre-load never blocks the card', async ({ page, mock, issues }) => {
    issues.allow(/expenses\//);
    await loginAs(page, 'staff');
    await visit(page, '/staff/expenses');
    await mock.failNext('/expenses/odometer/readings', { status: 500, times: -1 });
    await page.getByTestId('expense-card-odo').click();
    await page.waitForURL('**/staff/expenses/odometer');
    await expect(page.getByText('Could not load the readings.')).toBeVisible();
    await mock.clearFailures();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('No readings yet')).toBeVisible();
  });
});

test.describe('odometer', () => {
  test('start reading then stop reading: photo is uploaded before the record, distance is shown', async ({ page, mock }, testInfo) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/expenses/odometer');
    await expect(page.getByText("Today's Readings")).toBeVisible();
    await expect(page.getByText('No readings yet')).toBeVisible();
    await expect(page.getByText('Starting Reading')).toBeVisible();
    await expect(page.getByTestId('odometer-submit')).toBeDisabled();
    await snap(page, testInfo, 'odometer-start');

    await takePhoto(page, 'odometer-photo');
    await expect(page.getByTestId('odometer-submit')).toBeDisabled(); // km still missing
    await page.getByTestId('odometer-km').fill('-5');
    await page.getByTestId('odometer-submit').click();
    await expect(page.getByText(/KM/i).first()).toBeVisible();
    expect(await mock.requests({ path: '/expenses/odometer/start' })).toHaveLength(0);
    await page.getByTestId('odometer-km').fill('1000.5');
    await page.getByTestId('odometer-submit').click();
    await expect(page.getByTestId('odometer-start-modal')).toBeVisible();
    await expect(page.getByText('Start Recorded!')).toBeVisible();

    const all = await mock.requests({ path: '/expenses/odometer/' });
    const order = all.map((r) => r.path.replace('/expenses/odometer/', ''));
    expect(order.indexOf('upload-photo')).toBeLessThan(order.indexOf('start'));
    const start = all.find((r) => r.path.endsWith('/start'));
    expect(start?.body).toMatchObject({ user_id: USERS.staff.userId, start_km: 1000.5 });
    expect(all.find((r) => r.path.endsWith('/upload-photo'))?.query).toMatchObject({ photo_type: 'start', user_id: USERS.staff.userId });

    await page.getByRole('button', { name: 'Got it' }).click();
    await expect(page.getByText('Ending Reading')).toBeVisible();
    await expect(page.getByTestId('odometer-table')).toContainText('1,000.5');
    await snap(page, testInfo, 'odometer-stop');

    // stop below the start is refused client-side
    await takePhoto(page, 'odometer-photo');
    await page.getByTestId('odometer-km').fill('900');
    await page.getByTestId('odometer-submit').click();
    expect(await mock.requests({ path: '/expenses/odometer/stop' })).toHaveLength(0);
    await page.getByTestId('odometer-km').fill('1042.5');
    await page.getByTestId('odometer-submit').click();
    await expect(page.getByText('Trip Complete!')).toBeVisible();
    await expect(page.getByTestId('odometer-stop-modal')).toContainText('42');
    await expect(page.getByTestId('odometer-stop-modal')).toContainText('km travelled');
    expect((await mock.waitForRequest('/expenses/odometer/stop', { method: 'POST' })).body).toMatchObject({ stop_km: 1042.5 });
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('odometer-table')).toContainText('42');
    await expect(page.getByText('Starting Reading')).toBeVisible(); // a finished trip returns the form to "start"
  });

  test('field staff with an open trip land on the stop reading with today\'s readings table', async ({ page }) => {
    await loginAs(page, 'fieldStaff');
    await visit(page, '/staff/expenses/odometer');
    await expect(page.getByText('Ending Reading')).toBeVisible();
    await expect(page.getByTestId('reading-0')).toBeVisible();
    await expect(page.getByTestId('odometer-steps')).toHaveAccessibleName('Step 2 of 2: Stop reading');
  });

  test('a failed photo upload reports the error and does not record the km', async ({ page, mock, issues }) => {
    issues.allow(/odometer/);
    await loginAs(page, 'staff');
    await visit(page, '/staff/expenses/odometer');
    await takePhoto(page, 'odometer-photo');
    await page.getByTestId('odometer-km').fill('500');
    await mock.failNext('/expenses/odometer/upload-photo', { status: 500, body: { detail: 'Storage unavailable' } });
    await page.getByTestId('odometer-submit').click();
    await expect(page.getByText('Storage unavailable')).toBeVisible();
    expect(await mock.requests({ path: '/expenses/odometer/start' })).toHaveLength(0);
    await expect(page.getByTestId('odometer-submit')).toBeEnabled(); // not stuck on a spinner; form kept
    await expect(page.getByTestId('odometer-km')).toHaveValue('500');
  });

  test('date navigation: previous day relabels the table, next is disabled at today and the picker is capped', async ({ page, mock }) => {
    await loginAs(page, 'staff');
    await visit(page, '/staff/expenses/odometer');
    await expect(page.getByTestId('odometer-date-next')).toBeDisabled();
    await page.getByTestId('odometer-date-prev').click();
    await expect(page.getByText(/^Readings for /)).toBeVisible();
    await expect(page.getByTestId('odometer-date-next')).toBeEnabled();
    const calls = await mock.requests({ path: '/expenses/odometer/readings' });
    const today = (await mock.state()).today;
    expect(calls.at(-1)?.query.reading_date).toBeTruthy();
    expect(calls.at(-1)?.query.reading_date! < today).toBe(true);
    await expect(page.getByTestId('odometer-date-field')).toHaveAttribute('max', today);
    await page.getByTestId('odometer-date-next').click();
    await expect(page.getByText("Today's Readings")).toBeVisible();
    await expect(page.getByTestId('odometer-date-next')).toBeDisabled();
  });
});

for (const spec of [
  { name: 'travel tickets', path: '/staff/expenses/travel', title: 'Travel Tickets', submit: 'Submit Ticket', success: 'Ticket Submitted!', type: 'travel', retryNoun: 'ticket' },
  { name: 'other bills', path: '/staff/expenses/bills', title: 'Other Bills', submit: 'Submit Bill', success: /Submitted!/, type: 'bill', retryNoun: 'bill' },
] as const) {
  test.describe(spec.name, () => {
    test('photo + amount are submitted (record first, then photo) and listed with a rounded total', async ({ page, mock }, testInfo) => {
      await loginAs(page, 'staff');
      await visit(page, spec.path);
      await expect(page.getByTestId('expense-submit')).toBeDisabled();
      await snap(page, testInfo, `${spec.type}-empty`);
      await takePhoto(page, 'expense-photo');
      await page.getByTestId('expense-amount').fill('150.5');
      await page.getByTestId('expense-submit').click();
      await expect(page.getByTestId('expense-success-modal')).toBeVisible();
      await snap(page, testInfo, `${spec.type}-success`);
      const calls = await mock.requests({ path: '/expenses/travel-bill/' });
      const order = calls.filter((c) => c.method === 'POST').map((c) => c.path.split('/').pop());
      expect(order).toEqual(['submit', 'upload-photo']);
      expect(calls.find((c) => c.path.endsWith('/submit'))?.body).toMatchObject({ user_id: USERS.staff.userId, amount: 150.5 });
      expect(String(calls.find((c) => c.path.endsWith('/submit'))?.body?.expense_type).toLowerCase()).toBe(spec.type);
      expect(calls.find((c) => c.path.endsWith('/upload-photo'))?.files?.some((f) => f.size > 0)).toBe(true);
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByTestId('expense-row-0')).toBeVisible();
      await expect(page.getByTestId('expense-total')).toContainText('151'); // 150.5 rounds to 151
      await expect(page.getByTestId('expense-submit')).toBeDisabled(); // form reset
    });

    test('zero / negative amounts are rejected inline and nothing is sent', async ({ page, mock }) => {
      await loginAs(page, 'staff');
      await visit(page, spec.path);
      await takePhoto(page, 'expense-photo');
      for (const bad of ['0', '-20']) {
        await page.getByTestId('expense-amount').fill(bad);
        await page.getByTestId('expense-submit').click();
        await expect(page.getByTestId('expense-form').getByText(/amount/i).first()).toBeVisible();
      }
      expect(await mock.requests({ path: '/expenses/travel-bill/submit' })).toHaveLength(0);
    });

    test('upload failure keeps the record, shows a retry banner and the retry creates no duplicate', async ({ page, mock, issues }) => {
      issues.allow(/travel-bill\/upload-photo/);
      await loginAs(page, 'staff');
      await visit(page, spec.path);
      await takePhoto(page, 'expense-photo');
      await page.getByTestId('expense-amount').fill('320');
      await mock.failNext('/expenses/travel-bill/upload-photo', { status: 500, body: { detail: 'Upload failed (test)' } });
      await page.getByTestId('expense-submit').click();
      await expect(page.getByTestId('photo-retry-banner')).toBeVisible();
      await expect(page.getByTestId('photo-retry-banner')).toContainText(`${spec.retryNoun} for`);
      await expect(page.getByTestId('expense-submit')).toHaveText(/Retry photo upload/);
      await expect(page.getByTestId('expense-amount')).toHaveAttribute('readonly', ''); // amount locked while retrying
      await snap(page, testInfo_(spec.type), `${spec.type}-retry-banner`);
      await page.getByTestId('expense-submit').click();
      await expect(page.getByTestId('expense-success-modal')).toBeVisible();
      const calls = await mock.requests({ path: '/expenses/travel-bill/', method: 'POST' });
      expect(calls.filter((c) => c.path.endsWith('/submit'))).toHaveLength(1);
      const uploads = calls.filter((c) => c.path.endsWith('/upload-photo'));
      expect(uploads).toHaveLength(2);
      expect(uploads[1].query.expense_id).toBe(uploads[0].query.expense_id);
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByTestId(/expense-row-/)).toHaveCount(1);
      await expect(page.getByTestId('photo-retry-banner')).toHaveCount(0);
    });

    test('date navigation is clamped to today and the list is requested per date', async ({ page, mock }) => {
      await loginAs(page, 'staff');
      await visit(page, spec.path);
      const today = (await mock.state()).today;
      await expect(page.getByTestId('expense-date-next')).toBeDisabled();
      await page.getByTestId('expense-date-prev').click();
      await expect.poll(async () => (await mock.requests({ path: '/expenses/travel-bill/expenses' })).at(-1)?.query.expense_date).toBeTruthy();
      const q = (await mock.requests({ path: '/expenses/travel-bill/expenses' })).at(-1)!.query;
      expect(q.expense_date < today).toBe(true);
      expect(q.expense_type?.toLowerCase()).toBe(spec.type);
      await page.getByTestId('expense-date-next').click();
      await expect(page.getByTestId('expense-date-next')).toBeDisabled();
    });

    test('a failed list shows an error with retry', async ({ page, mock, issues }) => {
      issues.allow(/travel-bill\/expenses/);
      await loginAs(page, 'staff');
      await visit(page, spec.path.replace('/staff/expenses', '/staff/expenses'));
      await mock.failNext('/expenses/travel-bill/expenses', { status: 500, times: -1 });
      await page.getByTestId('expense-date-prev').click();
      await expect(page.getByText('Could not load the list.')).toBeVisible();
      await mock.clearFailures();
      await page.getByRole('button', { name: 'Try again' }).click();
      await expect(page.getByText('Could not load the list.')).toHaveCount(0);
    });
  });
}

// `snap` needs the TestInfo of the running test; inside the loop above the fixture is not destructured, so use this shim.
function testInfo_(_name: string) {
  return test.info();
}
