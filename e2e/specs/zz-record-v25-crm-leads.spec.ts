/** TEMPORARY recording spec: V25 crm-leads. Deleted after the render. */
import { expect, loginAs, test, USERS, visit } from '../support';
import { loginViaUi, logoutViaUi } from '../support/auth';
import { startRecorder } from '../support/zz-rec';

const WORK = process.env.VIDEO_WORK_DIR;

test('record V25 crm leads', async ({ page, mock }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone viewport only (390x844, 3x)');
  test.skip(!WORK, 'set VIDEO_WORK_DIR to the work folder');
  test.setTimeout(600_000);

  await mock.setState({ userAuth: 'email' });
  await loginAs(page, 'admin');
  await visit(page, '/admin/home');
  await expect(page.getByTestId('admin-home')).toBeVisible();
  await expect(page.getByTestId('figure-total-value')).toBeVisible();
  // Warm the lazy route bundles off-screen so no blank screen is filmed
  for (const path of ['/admin/crm', '/admin/crm/leads', '/admin/crm/leads/edit']) {
    await visit(page, path);
    await page.waitForTimeout(2500);
  }
  await visit(page, '/admin/home');
  await expect(page.getByTestId('figure-total-value')).toBeVisible();
  await page.addStyleTag({ content: 'input, textarea { min-width: 0 !important; max-width: 100% !important; }' });
  await page.waitForTimeout(2200);

  const { mark, tap, finish, finishPause, finishResume } = await startRecorder(page, `${WORK}/live`);
  const visible = (id: string) => page.locator(`[data-testid="${id}"]:visible`);
  const typeKeys = async (target: ReturnType<typeof page.getByPlaceholder>, text: string, delay = 70) => {
    await tap(target);
    for (const ch of text) {
      await target.evaluate((el) => {
        const f = el as HTMLInputElement;
        f.focus();
        f.setSelectionRange(f.value.length, f.value.length);
      });
      await target.press(ch === ' ' ? 'Space' : ch);
      await page.waitForTimeout(delay);
    }
  };

  // Scene 2: CRM tab, the hub
  mark('s2_start');
  await page.waitForTimeout(2200);
  mark('s2_tap');
  await tap('tab-crm');
  await expect(page.getByTestId('admin-crm')).toBeVisible();
  await expect(visible('crm-menu-enter')).toBeVisible();
  await page.waitForTimeout(11500);

  // Scene 3: Enter Leads
  mark('s3_start');
  await page.waitForTimeout(800);
  mark('s3_tap');
  await tap('crm-menu-enter');
  await expect(page.getByTestId('enter-lead')).toBeVisible();
  await page.waitForTimeout(7000);

  // Scene 4: name, mobile, address
  mark('s4_start');
  await page.waitForTimeout(500);
  mark('s4_name');
  await typeKeys(page.getByPlaceholder('Enter full name'), 'Sharma Traders');
  await page.waitForTimeout(500);
  mark('s4_mobile');
  await typeKeys(page.getByPlaceholder('Enter mobile number'), '9811122200');
  await page.waitForTimeout(500);
  mark('s4_addr');
  await typeKeys(page.getByPlaceholder('Enter address'), '5 MG Road');
  await page.waitForTimeout(1400);

  // Scene 5: category
  mark('s5_start');
  await page.waitForTimeout(500);
  mark('s5_trigger');
  await tap('crm-category-trigger');
  await expect(page.getByText('Select Category').first()).toBeVisible();
  await page.waitForTimeout(4200);
  mark('s5_pick');
  await tap(page.getByText('Retail', { exact: true }).last());
  await page.waitForTimeout(2400);

  // Scene 6: remarks, required date, Save Lead
  mark('s6_start');
  await page.waitForTimeout(500);
  mark('s6_remarks');
  await typeKeys(page.getByPlaceholder('Enter remarks'), 'Hot prospect');
  await page.waitForTimeout(1500);
  mark('s6_save');
  await tap('crm-lead-save');
  await expect(page.getByTestId('crm-success-popup')).toContainText('Lead Saved!');
  await page.waitForTimeout(2200);

  // Scene 7: back on the hub, the lead is Unassigned
  mark('s7_start');
  await page.waitForTimeout(3000);
  await expect(visible('crm-menu-assign')).toBeVisible();
  await page.waitForTimeout(6200);
  mark('s7_tap');
  await tap('crm-menu-assign');
  await expect(page.getByTestId('assign-leads')).toBeVisible();
  await expect(page.locator('[data-testid^="crm-lead-card-"]:visible').first()).toBeVisible();
  await page.waitForTimeout(1000);

  // Scene 8: the list
  mark('s8_start');
  await page.waitForTimeout(13000);

  // Scene 9: Assign
  const card = page.locator('[data-testid^="crm-lead-card-"]:visible', { hasText: 'Sharma Traders' }).first();
  mark('s9_start');
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  mark('s9_assign');
  await tap(card.locator('[data-testid^="crm-assign-lead-"]'));
  await expect(page.getByTestId('crm-assign-branch')).toBeVisible();
  await page.waitForTimeout(6600);
  mark('s9_pick');
  await tap(`crm-assign-employee-${USERS.staff.userId}`);
  await expect(page.getByTestId('crm-success-popup')).toContainText('Lead Assigned!');
  await page.waitForTimeout(2000);
  mark('s9_done');
  await expect(card).toContainText('Assigned to: Aarav Sharma', { timeout: 10_000 });
  await page.waitForTimeout(3200);

  // Switch to the employee (page navigations are not filmed)
  await finishPause();
  await logoutViaUi(page, 'admin');
  await expect(page.getByTestId('welcome-card')).toBeVisible();
  await mock.setState({ userAuth: 'mobile' });
  await loginViaUi(page, 'staff');
  await visit(page, '/staff/home');
  await expect(page.getByTestId('punch-button')).toBeVisible();
  await expect(page.getByTestId('permission-onboarding')).toBeVisible({ timeout: 8000 });
  await page.getByText('Skip Now').first().click();
  await expect(page.getByTestId('permission-onboarding')).toHaveCount(0);
  await page.waitForTimeout(800);
  await finishResume();

  // Scene 10: the employee's CRM tab
  mark('s10_start');
  await page.waitForTimeout(1600);
  mark('s10_tap');
  await tap('tab-crm');
  await expect(page.getByTestId('staff-crm')).toBeVisible();
  const emp = page.locator('[data-testid^="crm-emp-lead-"]:visible', { hasText: 'Sharma Traders' }).first();
  await expect(emp).toBeVisible();
  await page.waitForTimeout(10000);

  // Scene 11: work status
  mark('s11_start');
  await page.waitForTimeout(800);
  mark('s11_tap');
  await tap(emp.locator('[data-testid^="crm-status-"]'));
  await expect(page.getByTestId('crm-status-sheet')).toBeVisible();
  await page.waitForTimeout(9400);
  mark('s11_pick');
  await tap('crm-status-option-working');
  await page.waitForTimeout(2800);

  // Scene 12: wrap up
  mark('s12_start');
  await page.waitForTimeout(12000);
  mark('s12_end');

  await finish();
});
