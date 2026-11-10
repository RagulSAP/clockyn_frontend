/** TEMPORARY recording spec: V09 check-attendance-download-report. Deleted after the render. */
import { expect, loginAs, test, visit } from '../support';
import { installExportProbe } from '../support/q2';
import { startRecorder } from '../support/zz-rec';

const WORK = process.env.VIDEO_WORK_DIR;

test('record V09 attendance reports', async ({ page, mock }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone viewport only (390x844, 3x)');
  test.skip(!WORK, 'set VIDEO_WORK_DIR to the work folder');
  test.setTimeout(400_000);

  await installExportProbe(page);
  await mock.setState({ userAuth: 'email' });
  await loginAs(page, 'admin');
  await visit(page, '/admin/home');
  await expect(page.getByTestId('admin-home')).toBeVisible();
  await expect(page.getByTestId('figure-total-value')).toBeVisible();
  await page.waitForTimeout(2200);

  const { mark, tap, type, smoothTo, finish, finishPause, finishResume } = await startRecorder(page, `${WORK}/live`);
  const goBack = () => tap(page.locator('[aria-label="Go back"]:visible').last());
  // smooth scrollTo does not move this table in the browser build, so pan it by hand
  const panTable = (to: number, ms: number) =>
    page.evaluate(
      async ([x, dur]) => {
        const root = document.querySelector('[data-testid="staff-detailed-table"]')!;
        const all = [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[];
        const el = all.find((e) => e.scrollWidth > e.clientWidth + 20 && /auto|scroll/.test(getComputedStyle(e).overflowX))!;
        const from = el.scrollLeft;
        const steps = Math.max(1, Math.round(dur / 16));
        for (let i = 1; i <= steps; i++) {
          const p = i / steps;
          el.scrollLeft = from + (x - from) * (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
          await new Promise((r) => setTimeout(r, 16));
        }
      },
      [to, ms],
    );
  // Scene 2: Quick Actions -> View Reports
  mark('s2_start');
  await smoothTo('qa-reports');
  await page.waitForTimeout(2600);
  mark('s2_tap');
  await tap('qa-reports');
  await expect(page.getByTestId('reports-hub')).toBeVisible();
  await page.waitForTimeout(800);

  // Scene 3: hub categories
  mark('s3_start');
  await page.waitForTimeout(5800);
  await page.evaluate(() => document.querySelector('[data-testid="category-Salary Reports"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  await page.waitForTimeout(5200);
  await page.evaluate(() => document.querySelector('[data-testid="category-Attendance Reports"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await page.waitForTimeout(900);

  // Scene 4: Staff-wise Detailed Report
  mark('s4_start');
  await page.waitForTimeout(2200);
  mark('s4_tap');
  await tap('report-row-Staff-wise Detailed Report');
  await expect(page.getByTestId('staff-detailed-table')).toBeVisible();
  await expect(page.getByTestId('report-summary')).toContainText(/\d+ staff/);
  await page.waitForTimeout(800);

  // Scene 5: one row per staff, the month stepper
  mark('s5_start');
  await page.waitForTimeout(6500);
  mark('s5_prev');
  await tap(page.getByRole('button', { name: 'Previous month' }));
  await expect(page.getByTestId('report-summary')).toContainText(/\d+ staff/);
  await page.waitForTimeout(2600);

  // Scene 6: attendance columns
  mark('s6_start');
  await page.waitForTimeout(900);
  await panTable(600, 5400);
  await page.waitForTimeout(500);

  // Scene 7: request columns
  mark('s7_start');
  await page.waitForTimeout(600);
  await panTable(1400, 6000);
  await page.waitForTimeout(500);
  await panTable(0, 900);
  await page.waitForTimeout(500);

  // Scene 8: Export
  mark('s8_start');
  await page.waitForTimeout(900);
  mark('s8_export');
  await tap('report-export');
  await expect(page.getByText('Export Report')).toBeVisible();
  await page.waitForTimeout(6200);
  mark('s8_xlsx');
  const download = page.waitForEvent('download').catch(() => undefined);
  await tap('export-xlsx');
  await download;
  await page.waitForTimeout(3000);

  // Scene 9: Late Report
  mark('s9_start');
  await goBack();
  await expect(page.getByTestId('reports-hub')).toBeVisible();
  await page.waitForTimeout(1200);
  mark('s9_tap');
  await tap('report-row-Late Report');
  await expect(page.getByTestId('late-report')).toBeVisible();
  await page.waitForTimeout(6000);

  // Scene 10: Overtime Report
  mark('s10_start');
  await goBack();
  await expect(page.getByTestId('reports-hub')).toBeVisible();
  await page.waitForTimeout(1000);
  mark('s10_tap');
  await tap('report-row-Overtime Report');
  await expect(page.getByTestId('overtime-report')).toBeVisible();
  await page.waitForTimeout(5400);

  // Scene 11: Monthly Summary, choose staff
  mark('s11_start');
  await goBack();
  await expect(page.getByTestId('reports-hub')).toBeVisible();
  await page.waitForTimeout(1000);
  mark('s11_tap');
  await tap('report-row-Monthly Summary');
  await expect(page.getByTestId('monthly-attendance-report')).toBeVisible();
  await page.waitForTimeout(4500);
  mark('s11_picker');
  await tap('staff-picker');
  await expect(page.getByText('Select Staff', { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(3400);
  mark('s11_pick');
  await tap('staff-stf-0001');
  await expect(page.getByTestId('staff-picker')).toContainText('Aarav Sharma');
  await page.waitForTimeout(1200);

  // Scene 12: period, Generate & View PDF
  mark('s12_start');
  await page.waitForTimeout(1500);
  mark('s12_prev');
  await tap(page.getByRole('button', { name: 'Previous month' }));
  await page.waitForTimeout(3000);
  mark('s12_gen');
  await tap('generate-pdf');
  await expect.poll(async () => page.evaluate(() => ((window as unknown as { __probe?: { windowOpens: string[] } }).__probe?.windowOpens ?? []).length)).toBeGreaterThan(0);
  await page.waitForTimeout(4200);

  // Scene 13: View Reports history
  mark('s13_start');
  await goBack();
  await expect(page.getByTestId('reports-hub')).toBeVisible();
  await page.waitForTimeout(900);
  mark('s13_tab');
  await tap(page.locator('[data-testid="reports-hub"]:visible').getByText('View Reports', { exact: true }));
  await expect(page.locator('[data-testid^="saved-"]').first()).toBeVisible();
  await page.waitForTimeout(8200);
  mark('s13_end');

  await finish();
});
