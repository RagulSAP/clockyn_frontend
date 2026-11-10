/** TEMPORARY recording spec: V03 add-branch-department. Deleted after the render. */
import { expect, loginAs, test, visit } from '../support';
import { startRecorder } from '../support/zz-rec';

const WORK = process.env.VIDEO_WORK_DIR;

test('record V03 branches and departments', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone viewport only (390x844, 3x)');
  test.skip(!WORK, 'set VIDEO_WORK_DIR to the work folder');
  test.setTimeout(240_000);

  await loginAs(page, 'admin');
  await visit(page, '/admin/home');
  await expect(page.getByTestId('admin-home')).toBeVisible();
  await expect(page.getByTestId('figure-total-value')).toBeVisible();
  // web-only quirk: inputs wider than their column make the form scroll sideways on focus, which blurs the field
  await page.addStyleTag({ content: 'input, textarea { min-width: 0 !important; max-width: 100% !important; }' });
  await page.waitForTimeout(2200);

  const { mark, tap, tapPoint, type, smoothTo, finish } = await startRecorder(page, `${WORK}/live`);
  const visible = (id: string) => page.locator(`[data-testid="${id}"]:visible`);
  const goBack = () => tap(page.locator('[aria-label="Go back"]:visible').last());

  // Scene 2 (~6.7 s): why branches and departments matter; Manage cards on screen
  mark('s2_start');
  await smoothTo('manage-view-branch');
  await page.waitForTimeout(5800);

  // Scene 3 (~4.2 s): open the Branches card
  mark('s3_start');
  await page.waitForTimeout(2300);
  mark('s3_tap');
  await tap('manage-view-branch');
  await expect(page.getByTestId('branch-list-screen')).toBeVisible();
  await page.waitForTimeout(1200);

  // Scene 4 (~6.8 s): the branch list (GPS and radius per branch, pencil, bin)
  mark('s4_start');
  await page.waitForTimeout(6300);

  // Scene 5 (~2.9 s): plus button
  mark('s5_start');
  await page.waitForTimeout(1300);
  mark('s5_tap');
  await tap('branch-add');
  await expect(page.getByTestId('branch-edit-screen')).toBeVisible();
  await page.waitForTimeout(900);

  // Scene 6 (~4.5 s): name and address
  mark('s6_start');
  await page.waitForTimeout(400);
  await type('branch-name', 'South Depot', 50);
  await page.waitForTimeout(200);
  await type('branch-address', '44 Depot Road, Bengaluru', 45);
  mark('s6_end');
  await page.waitForTimeout(1500);

  // Scene 7 (~5.5 s): GPS Location -> tap the map
  mark('s7_start');
  await page.waitForTimeout(1300);
  mark('s7_gps');
  await tap('branch-gps');
  await expect(page.getByTestId('location-picker')).toBeVisible();
  await page.waitForTimeout(1700);
  const box = (await page.getByTestId('location-picker-map').boundingBox())!;
  mark('s7_map');
  await tapPoint(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10);
  await expect(page.getByTestId('location-picker-coords')).toBeVisible();
  await page.waitForTimeout(1900);

  // Scene 8 (~4.2 s): Save Location
  mark('s8_start');
  await page.waitForTimeout(2100);
  mark('s8_tap');
  await tap('location-picker-confirm');
  await expect(page.getByTestId('location-picker')).toHaveCount(0);
  await page.waitForTimeout(1000);

  // Scene 9 (~6.3 s): attendance radius
  mark('s9_start');
  await smoothTo('radius-selector');
  await page.waitForTimeout(1400);
  mark('s9_tap');
  await tap(page.getByTestId('radius-selector').getByText('500m', { exact: true }).first());
  await page.waitForTimeout(3600);

  // Scene 10 (~4.7 s): Save Branch
  mark('s10_start');
  await page.waitForTimeout(900);
  mark('s10_tap');
  await tap('branch-submit');
  await page.waitForURL(/\/admin\/branches$/);
  await expect(page.getByText('South Depot').first()).toBeVisible();
  await page.waitForTimeout(2800);

  // Scene 11 (~5.3 s): deleting a branch that has staff -> reassign sheet (cancelled)
  mark('s11_start');
  await page.waitForTimeout(1700);
  mark('s11_tap');
  await tap(page.getByRole('button', { name: 'Delete Warehouse' }));
  await expect(page.getByTestId('reassign-sheet')).toBeVisible();
  await page.waitForTimeout(2500);
  await tap(page.getByRole('button', { name: 'Close dialog' }).last());
  await expect(page.getByTestId('reassign-sheet')).toHaveCount(0);
  await page.waitForTimeout(300);

  // Scene 12 (~5.2 s): back to Home, Departments card
  mark('s12_start');
  await page.waitForTimeout(1700);
  mark('s12_back');
  await goBack();
  await expect(visible('manage-view-dept')).toBeVisible();
  await smoothTo('manage-view-dept');
  await page.waitForTimeout(1400);
  mark('s12_tap');
  await tap('manage-view-dept');
  await expect(page.getByTestId('department-list-screen')).toBeVisible();

  // Scene 13 (~5.1 s): plus, name, Save Department
  mark('s13_start');
  await page.waitForTimeout(1200);
  mark('s13_plus');
  await tap('department-add');
  await expect(page.getByTestId('department-edit-screen')).toBeVisible();
  await page.waitForTimeout(500);
  await type('department-name', 'Finance', 55);
  await page.waitForTimeout(1000);
  mark('s13_save');
  await tap('department-submit');
  await page.waitForTimeout(800);

  // Scene 14 (~4.5 s): confirmation popup, then the list
  mark('s14_start');
  await expect(page.getByTestId('department-saved')).toBeVisible();
  await page.waitForTimeout(2800);
  await page.waitForURL(/\/admin\/departments$/, { timeout: 15_000 });
  await expect(page.getByText('Finance').first()).toBeVisible();
  await page.waitForTimeout(300);

  // Scene 15 (~7.0 s): pencil (rename), bin (delete refused while staff belong to it)
  mark('s15_start');
  await page.waitForTimeout(700);
  mark('s15_pencil');
  await tap(page.getByRole('button', { name: 'Edit Finance' }));
  await expect(page.getByTestId('department-edit-screen')).toBeVisible();
  await page.waitForTimeout(900);
  mark('s15_back');
  await goBack();
  await expect(page.getByTestId('department-list-screen')).toBeVisible();
  await page.waitForTimeout(500);
  mark('s15_bin');
  await tap(page.getByRole('button', { name: 'Delete Sales' }));
  await expect(page.getByTestId('department-delete-dialog')).toBeVisible();
  await page.waitForTimeout(1000);
  mark('s15_confirm');
  await tap(page.getByTestId('department-delete-dialog').getByRole('button', { name: 'Delete' }));
  await expect(page.getByText(/Cannot delete department/).first()).toBeVisible();
  await page.waitForTimeout(2200);
  mark('s15_end');

  await finish();
});
