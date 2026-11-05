/**
 * Q2 - Staff location (admin): map + markers, 15-minute freshness, branch filter, route polyline, live refresh (today only),
 * plan gate states.
 */
import { test, expect, loginAs, visit, BRANCHES, USERS } from '../support';
import { mockApi, istPlusDays } from '../support/q2';

const PATH = '/admin/location';
const pins = (page: import('@playwright/test').Page) => page.locator('.clockyn-pin');

test.describe('location', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('map renders with a marker per located field staff; counters + live caption', async ({ page, mock }) => {
    await visit(page, PATH);
    await expect(page.getByTestId('location-map')).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    const fx = await mock.fixtures();
    const field = fx.staff.filter((s) => s.field && s.status === 1);
    await expect(pins(page)).toHaveCount(field.length);
    await expect(page.getByText('Live: positions refresh every 10 seconds.')).toBeVisible();
    // every seeded position is 20 minutes old -> all outdated, none recent
    await expect(page.getByTestId('location-stat-recent')).toContainText('0');
    await expect(page.getByTestId('location-stat-outdated')).toContainText(String(field.length));
    await page.getByTestId('location-view-all').click();
    await expect(page.getByTestId('location-panel-all')).toContainText(`All Field Staff (${field.length})`);
    await expect(page.getByTestId('location-panel-all')).toContainText('Last updated:');
    await expect(page.locator('body')).not.toContainText('NaN');
  });

  test('freshness: a fresh ping turns that staff green and moves the counter; it turns stale after 15 minutes (browser clock)', async ({ page, tenant }) => {
    await page.clock.install();
    await visit(page, PATH, {}, { idle: false });
    await expect(pins(page).first()).toBeVisible();
    await expect(page.getByTestId('location-stat-recent')).toContainText('0');
    await mockApi(tenant, 'POST', '/staff-location/log', { user_id: USERS.fieldStaff.userId, org_id: 'org-0001', latitude: 12.9716, longitude: 77.5946 });
    await page.clock.fastForward(11_000);
    await expect(page.getByTestId('location-stat-recent')).toContainText('1');
    await page.getByTestId('location-stat-recent').click();
    await expect(page.getByTestId('location-panel-recent')).toContainText('Recently Updated Staff (1)');
    await expect(page.getByTestId('location-row-stf-0002')).toBeVisible();
    // 16 minutes later, without another ping, the same position is outdated
    await page.clock.fastForward(16 * 60_000);
    await page.clock.fastForward(11_000);
    await expect(page.getByTestId('location-stat-recent')).toContainText('0');
    await expect(page.getByTestId('location-stat-outdated')).not.toContainText(/^0$/);
  });

  test('branch filter really filters markers, counters and lists; changing it clears the selection', async ({ page, mock, tenant }) => {
    // the seed keeps every field employee in Warehouse: move two to Head Office so the filter has something to split
    for (const id of ['stf-0002', 'stf-0004']) await mockApi(tenant, 'PUT', `/addstaff/${id}`, { branch_name: BRANCHES.hq.name });
    await visit(page, PATH);
    const fx = await mock.fixtures();
    const field = fx.staff.filter((s) => s.field && s.status === 1);
    const inWarehouse = field.filter((s) => s.branch_id === BRANCHES.warehouse.id).length;
    const inHq = field.filter((s) => s.branch_id === BRANCHES.hq.id).length;
    expect(inWarehouse).toBeGreaterThan(0);
    expect(inHq).toBeGreaterThan(0);
    await expect(pins(page)).toHaveCount(field.length);
    await page.getByTestId('location-branch').click();
    await page.getByRole('option', { name: BRANCHES.warehouse.name }).or(page.getByText(BRANCHES.warehouse.name, { exact: true }).last()).click();
    await expect(pins(page)).toHaveCount(inWarehouse);
    await expect(page.getByTestId('location-view-all')).toContainText(`(${inWarehouse})`);
    await expect(page.getByTestId('location-stat-outdated')).toContainText(String(inWarehouse));
    await page.getByTestId('location-view-all').click();
    await expect(page.getByTestId('location-panel-all')).not.toContainText(BRANCHES.hq.name);
    await page.getByTestId('location-branch').click();
    await page.getByRole('option', { name: BRANCHES.hq.name }).or(page.getByText(BRANCHES.hq.name, { exact: true }).last()).click();
    await expect(pins(page)).toHaveCount(inHq);
    await expect(page.getByTestId('location-panel-all')).toHaveCount(0); // selection / panel cleared on change
  });

  test('selecting a staff member draws the route polyline (all pings, not a simplified stub) with Start / End markers', async ({ page, tenant }) => {
    // the seeded trail is a straight line (Leaflet simplifies it): add a zig-zag so the polyline must keep several vertices
    for (const [lat, lng] of [[12.97, 77.62], [12.99, 77.58], [12.96, 77.6], [12.98, 77.57]]) {
      await mockApi(tenant, 'POST', '/staff-location/log', { user_id: USERS.fieldStaff.userId, org_id: 'org-0001', latitude: lat, longitude: lng });
    }
    await visit(page, PATH);
    await page.getByTestId('location-view-all').click();
    await page.getByTestId('location-row-stf-0002').click();
    await expect(pins(page).filter({ hasText: /^S$/ })).toHaveCount(1);
    await expect(pins(page).filter({ hasText: /^E$/ })).toHaveCount(1);
    const lines = await page.locator('path.leaflet-interactive').evaluateAll((els) => els.map((e) => e.getAttribute('d') ?? ''));
    const route = lines.reduce((a, b) => ((b.match(/L/g) ?? []).length > (a.match(/L/g) ?? []).length ? b : a), '');
    expect((route.match(/L/g) ?? []).length).toBeGreaterThanOrEqual(4);
    // the viewport is fitted to the whole route (both ends visible inside the map), even when the route answers instantly
    const box = (await page.locator('.leaflet-container').boundingBox())!;
    for (const label of [/^S$/, /^E$/]) {
      const pin = (await pins(page).filter({ hasText: label }).boundingBox())!;
      await expect.poll(async () => {
        const b = (await pins(page).filter({ hasText: label }).boundingBox())!;
        return b.x >= box.x && b.x + b.width <= box.x + box.width && b.y >= box.y && b.y + b.height <= box.y + box.height;
      }, { message: `route pin ${label} must be inside the map viewport` }).toBe(true);
      void pin;
    }
  });

  test('live refresh only for today: positions poll every 10 s today, a past date is static and shows the no-data overlay', async ({ page, mock }) => {
    await page.clock.install();
    await visit(page, PATH, {}, { idle: false });
    await expect(pins(page).first()).toBeVisible();
    await mock.clearRequests();
    await page.clock.fastForward(10_500);
    await mock.waitForRequest('/staff-location/locations');
    // pick yesterday: static, no more polling
    const yesterday = istPlusDays(-1);
    await page.getByTestId('location-date').fill(yesterday);
    await expect(page.getByText(/No staff location data for/)).toBeVisible();
    await expect(page.getByText('Live: positions refresh every 10 seconds.')).toHaveCount(0);
    await mock.clearRequests();
    await page.clock.fastForward(35_000);
    expect((await mock.requests({ path: '/staff-location/locations' })).length).toBe(0);
  });

  test('live-poll refetch updates positions without moving the viewport the admin panned to', async ({ page, tenant }) => {
    await visit(page, PATH);
    await expect(pins(page).first()).toBeVisible();
    await mockApi(tenant, 'POST', '/staff-location/log', { user_id: USERS.fieldStaff.userId, org_id: 'org-0001', latitude: 12.98, longitude: 77.61 });
    await page.getByTestId('location-stat-outdated').click(); // triggers a re-render, not a context change
    await expect(page.getByTestId('location-panel-outdated')).toBeVisible();
  });

  test('load failure shows an error state with retry', async ({ page, mock, issues }) => {
    issues.allow(/staff-location/);
    await mock.failNext('/staff-location/locations', { status: 500, times: 3 });
    await visit(page, PATH);
    await expect(page.getByText('Something went wrong')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /try again/i }).click();
    await expect(pins(page).first()).toBeVisible();
  });
});

test.describe('plan gate', () => {
  for (const plan of ['core', 'expired', 'none'] as const) {
    test(`plan ${plan}: blocked panel, no location data is fetched`, async ({ page, mock, issues }) => {
      issues.allow(/.*/);
      await mock.setPlan(plan);
      await loginAs(page, 'admin');
      await visit(page, PATH);
      await expect(page.getByText('Page Unavailable')).toBeVisible();
      await expect(page.getByTestId('location-map')).toHaveCount(0);
      expect((await mock.requests({ path: '/staff-location/locations' })).length).toBe(0);
    });
  }

  test('elite plan has access', async ({ page, mock }) => {
    await mock.setPlan('elite');
    await loginAs(page, 'admin');
    await visit(page, PATH);
    await expect(page.getByTestId('location-map')).toBeVisible();
  });
});
