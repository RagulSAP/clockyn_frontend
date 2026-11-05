/**
 * Q1 - admin dashboard (/admin/home) and Overview (/admin/overview).
 * Numbers are compared with the data the mock backend holds (read straight from the mock, not from the UI's own requests).
 */
import { BRANCHES, expect, loginAs, MOCK_URL, USERS, visit, test } from '../support';
import { isTruncated, mockGet, pickOption, snapBoth } from '../support/q1';

type Counts = { total_staff: number; punched_in: number; working: number; punched_out: number; absent: number; late_punched_in: number };

const FIGURES: [string, keyof Counts][] = [
  ['total', 'total_staff'],
  ['absent', 'absent'],
  ['late', 'late_punched_in'],
  ['punched_in', 'punched_in'],
  ['working', 'working'],
  ['punched_out', 'punched_out'],
];

async function expectFigures(page: import('@playwright/test').Page, expected: Counts): Promise<void> {
  for (const [key, field] of FIGURES) {
    await expect(page.getByTestId(`figure-${key}-value`), `figure ${key}`).toHaveText(String(expected[field]));
  }
}

const dayOffset = (iso: string, delta: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

test.describe('Q1 dashboard summary + filters', () => {
  test('summary numbers equal the mock data; the date defaults to today (IST)', async ({ page, mock, tenant }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    const fx = await mock.fixtures();
    const api = await mockGet<Counts>(tenant, `/home/dashboard-status?user_id=org-0001&target_date=${fx.today}`);
    await expectFigures(page, api);
    // independent derivation: total = active non-admin staff
    const activeStaff = fx.staff.filter((s) => s.status === 1 && s.role_id !== 1).length;
    expect(api.total_staff).toBe(activeStaff);
    await expect(page.getByTestId('filter-date')).toHaveValue(fx.today);
    await expect(page.getByTestId('org-name')).toContainText('Acme Traders');
    await snapBoth(page, testInfo, 'dash-home');
  });

  test('branch filter re-queries with the branch id and shows that branch\'s numbers', async ({ page, mock, tenant }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    const fx = await mock.fixtures();
    await pickOption(page, 'filter-branch', BRANCHES.warehouse.name);
    const api = await mockGet<Counts>(tenant, `/home/dashboard-status?user_id=org-0001&target_date=${fx.today}&branch_id=${BRANCHES.warehouse.id}`);
    await expectFigures(page, api);
    const all = await mockGet<Counts>(tenant, `/home/dashboard-status?user_id=org-0001&target_date=${fx.today}`);
    expect(api.total_staff).toBeLessThan(all.total_staff);
    const call = await mock.waitForRequest('/home/dashboard-status', { predicate: (r) => r.query.branch_id === BRANCHES.warehouse.id });
    expect(call.query.target_date).toBe(fx.today);
    // back to ALL
    await pickOption(page, 'filter-branch', 'ALL');
    await expectFigures(page, all);
  });

  test('date filter: a past day shows that day\'s numbers, a future date is clamped to today', async ({ page, mock, tenant }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    const fx = await mock.fixtures();
    const past = dayOffset(fx.today, -3);
    await page.getByTestId('filter-date').fill(past);
    const api = await mockGet<Counts>(tenant, `/home/dashboard-status?user_id=org-0001&target_date=${past}`);
    await mock.waitForRequest('/home/dashboard-status', { predicate: (r) => r.query.target_date === past });
    if (api.punched_in + api.working + api.punched_out > 0) await expectFigures(page, api);
    else await expect(page.getByTestId('summary-no-data')).toHaveText('No attendance record for this date');
    // future date: clamped
    await page.getByTestId('filter-date').fill(dayOffset(fx.today, 5));
    await expect(page.getByTestId('filter-date')).toHaveValue(fx.today);
  });

  test('a past date with nobody punched shows "No attendance record" and the figures are not tappable', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    const fx = await mock.fixtures();
    // 1 year back: the mock has ~45 days of history only
    const old = dayOffset(fx.today, -200);
    await page.getByTestId('filter-date').fill(old);
    await expect(page.getByTestId('summary-no-data')).toHaveText('No attendance record for this date');
    await expect(page.getByTestId('figure-total')).toHaveCount(0);
  });

  test('department mode lists department cards; a department badge opens the roster scoped to that department', async ({ page, mock, tenant }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    const fx = await mock.fixtures();
    await page.getByTestId('filter-department').click();
    await expect(page.getByTestId('department-list')).toBeVisible();
    const depts = await mockGet<({ dept_id: string; dept_name: string } & Counts)[]>(tenant, `/home/department-stats?user_id=org-0001&target_date=${fx.today}`);
    expect(depts.length).toBeGreaterThan(0);
    for (const d of depts) {
      await expect(page.getByTestId(`dept-card-${d.dept_id}`)).toContainText(d.dept_name);
      await expect(page.getByTestId(`dept-${d.dept_id}-total`)).toContainText(String(d.total_staff));
    }
    await snapBoth(page, testInfo, 'dash-home-dept-mode');
    const sales = depts.find((d) => d.dept_name === 'Sales')!;
    await page.getByTestId(`dept-${sales.dept_id}-total`).click();
    await page.waitForURL(/\/admin\/staff\?/);
    expect(new URL(page.url()).searchParams.get('deptId')).toBe(sales.dept_id);
    await expect(page.getByText('All Staff', { exact: true })).toBeVisible();
    await expect(page.getByTestId('roster-chips')).toBeVisible();
    // the dashboard also drops the quick actions in department mode
    await page.goBack();
    await expect(page.getByTestId('quick-actions')).toHaveCount(0);
  });

  test('each summary figure opens the roster with the right filter, branch and date', async ({ page, mock, tenant }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    const fx = await mock.fixtures();
    await pickOption(page, 'filter-branch', BRANCHES.hq.name);
    const api = await mockGet<Counts>(tenant, `/home/dashboard-status?user_id=org-0001&target_date=${fx.today}&branch_id=${BRANCHES.hq.id}`);
    await expectFigures(page, api);
    const titles: Record<string, string> = { absent: 'Absent Staff', late: 'Late Punched-In', working: 'Working Staff', punched_out: 'Punched Out', total: 'All Staff', punched_in: 'Punched-In' };
    for (const [key, field] of FIGURES) {
      await page.getByTestId(`figure-${key}`).click();
      await page.waitForURL(/\/admin\/staff\?/);
      const q = new URL(page.url()).searchParams;
      expect(q.get('filter')).toBe(key);
      expect(q.get('branchId')).toBe(BRANCHES.hq.id);
      expect(q.get('date')).toBe(fx.today);
      await expect(page.getByTestId('staff-list-screen').getByText(titles[key], { exact: true }).first()).toBeVisible();
      // the number of rows equals the figure that was tapped
      // the "All Staff" roster also lists inactive people (they carry the Inactive chip); live-status lists are active only
      const expectedRows = key === 'total' ? fx.staff.filter((x) => x.branch_id === BRANCHES.hq.id && x.role_id !== 1 && x.status !== 2).length : api[field];
      await expect(page.locator('[data-testid^="staff-row-"]'), `rows for ${key}`).toHaveCount(expectedRows, { timeout: 15_000 });
      await page.goBack();
      await expect(page.getByTestId('summary-card')).toBeVisible();
    }
  });

  test('the Overview header opens the Overview carrying date and branch', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    const fx = await mock.fixtures();
    await pickOption(page, 'filter-branch', BRANCHES.warehouse.name);
    await page.getByTestId('summary-open-overview').click();
    await page.waitForURL(/\/admin\/overview\?/);
    const q = new URL(page.url()).searchParams;
    expect(q.get('branchId')).toBe(BRANCHES.warehouse.id);
    expect(q.get('date')).toBe(fx.today);
  });

  test('refresh button reloads the numbers and returns the date to today', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    const fx = await mock.fixtures();
    await page.getByTestId('filter-date').fill(dayOffset(fx.today, -2));
    await mock.clearRequests();
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByTestId('filter-date')).toHaveValue(fx.today);
    await mock.waitForRequest('/home/dashboard-status');
  });

  test('a failed stats load shows an inline error with Retry that recovers', async ({ page, mock, issues }) => {
    issues.allow(/dashboard-status/);
    await loginAs(page, 'admin');
    await mock.failNext('/home/dashboard-status', { status: 503, times: -1, body: { detail: 'Dashboard is down' } });
    await visit(page, '/admin/home', {}, { idle: false });
    await expect(page.getByText(/Dashboard is down|Failed to load dashboard data/).first()).toBeVisible();
    await mock.clearFailures();
    await page.getByRole('button', { name: /try again|retry/i }).first().click();
    await expect(page.getByTestId('figure-total-value')).toBeVisible();
  });
});

test.describe('Q1 dashboard quick actions, manage grid, plan gating', () => {
  test('quick actions and manage grid navigate; the Requests badge equals the pending requests', async ({ page, mock }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    const fx = await mock.fixtures();
    const pending = fx.requests.filter((r) => r.status === 'pending' && r.type !== 'device_change').length;
    const pendingAll = fx.requests.filter((r) => r.status === 'pending').length;
    const badge = Number((await page.getByTestId('qa-requests-badge').innerText()).trim());
    expect([pending, pendingAll]).toContain(badge);

    // regression (Q1-D4): the Manage cards must not truncate their titles or the Add buttons
    for (const label of ['Staff', 'Branches', 'Departments']) {
      expect(await isTruncated(page.getByTestId('manage-grid').getByText(label, { exact: true })), `${label} truncated`).toBe(false);
    }
    for (const key of ['staff', 'branch', 'dept']) {
      await expect(page.getByTestId(`manage-add-${key}`)).toContainText('Add');
      expect(await isTruncated(page.getByTestId(`manage-add-${key}`).getByText('Add', { exact: true })), `Add ${key} truncated`).toBe(false);
    }
    const targets: [string, RegExp][] = [
      ['qa-reports', /\/admin\/reports$/],
      ['qa-requests', /\/admin\/requests$/],
      ['qa-location', /\/admin\/location/],
      ['manage-view-staff', /\/admin\/staff\?/],
      ['manage-add-staff', /\/admin\/staff\/edit/],
      ['manage-view-branch', /\/admin\/branches$/],
      ['manage-add-branch', /\/admin\/branches\/edit/],
      ['manage-view-dept', /\/admin\/departments$/],
      ['manage-add-dept', /\/admin\/departments\/edit/],
    ];
    for (const [id, re] of targets) {
      await page.getByTestId(id).click();
      await page.waitForURL(re);
      await visit(page, '/admin/home');
    }
  });

  for (const plan of ['elite', 'prime', 'core', 'trial', 'expired', 'none'] as const) {
    test(`plan ${plan}: Staff Location and CRM tab gating`, async ({ page, mock, issues }) => {
      issues.allow(/(group-)?chat\/list/); // the shell badge polls the chat lists, which answer the plan block as HTTP 500
      await mock.setPlan(plan);
      await loginAs(page, 'admin');
      await visit(page, '/admin/home');
      const locationBlocked = ['core', 'expired', 'none'].includes(plan);
      const crmBlocked = ['core', 'prime', 'expired', 'none'].includes(plan);
      await expect(page.getByTestId('qa-location')).toBeVisible();
      await page.getByTestId('qa-location').click();
      if (locationBlocked) {
        await expect(page.getByText(/Prime plan|Core Plan|upgrade|renew/i).first()).toBeVisible();
        expect(new URL(page.url()).pathname).toBe('/admin/home');
      } else {
        await page.waitForURL(/\/admin\/location/);
        await visit(page, '/admin/home');
      }
      const crmTab = page.locator('[data-testid="tab-crm"]:visible, [data-testid="sidebar-crm"]:visible').first();
      await crmTab.click();
      if (crmBlocked) {
        await expect(page.getByText(/Elite plan|Core Plan|upgrade|renew/i).first()).toBeVisible();
        expect(new URL(page.url()).pathname).toBe('/admin/home');
      } else {
        await page.waitForURL(/\/admin\/crm/);
      }
    });
  }

  test('plan expired: the Chat tab opens but shows the plan block instead of conversations', async ({ page, mock, issues }) => {
    issues.allow(/(group-)?chat\/list/);
    await mock.setPlan('expired');
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    const chat = page.locator('[data-testid="tab-chat"]:visible, [data-testid="sidebar-chat"]:visible').first();
    await chat.click();
    await page.waitForURL(/\/admin\/chat/);
    await expect(page.getByText('Feature Unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Renew Plan' })).toBeVisible();
  });
});

test.describe('Q1 plan-expiry popup', () => {
  test('expired plan: popup cannot be dismissed, Renew opens the upgrade screen in renew mode; shown once per day', async ({ page, mock, issues }, testInfo) => {
    issues.allow(/(group-)?chat\/list/);
    await mock.setPlan('expired');
    await loginAs(page, 'admin', { showPlanPopup: true });
    await visit(page, '/admin/home');
    const modal = page.getByTestId('plan-expiry-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Plan Expired' })).toBeVisible();
    await expect(page.getByTestId('plan-popup-skip')).toHaveCount(0);
    // regression (Q1-D3): the dialog's decorative icon must not take the keyboard focus (focus ring around the icon)
    expect(await page.evaluate(() => document.activeElement?.tagName.toLowerCase())).not.toBe('svg');
    await snapBoth(page, testInfo, 'dash-plan-expired-popup');
    await page.keyboard.press('Escape');
    await expect(modal).toBeVisible(); // not dismissible
    await page.getByTestId('plan-popup-primary').click();
    await page.waitForURL(/\/admin\/billing\/upgrade\?.*mode=renew/);
    // second visit the same day: the flag was written, no popup
    await visit(page, '/admin/home');
    await expect(page.getByTestId('filter-bar')).toBeVisible();
    await expect(page.getByTestId('plan-expiry-modal')).toHaveCount(0);
  });

  test('plan ending in 3 days: dismissible "Plan Expiring Soon"; trial ending in 3 days: "Free Trial Ending Soon" -> billing', async ({ page, mock }) => {
    const iso = (d: number) => new Date(Date.now() + 330 * 60_000 + d * 86_400_000).toISOString().slice(0, 10);
    const sub = { success: true, data: { plan_id: 3, plan_name: 'Elite', plan_amount: 999, plan_month: 1, start_date: iso(-27), end_date: iso(3), staff_limit: 50, status: 'ACTIVE', is_expired: false, is_free_trial: false, free_trial_end: null, billing_date: iso(3) } };
    await mock.failNext('/plans/subscription/*', { status: 200, body: sub, times: -1 });
    await loginAs(page, 'admin', { showPlanPopup: true });
    await visit(page, '/admin/home');
    await expect(page.getByTestId('plan-expiry-modal').getByRole('heading', { name: 'Plan Expiring Soon' })).toBeVisible();
    await page.getByTestId('plan-popup-skip').click();
    await expect(page.getByTestId('plan-expiry-modal')).toHaveCount(0);

    // trial variant on a fresh tab state
    const sub2 = { success: true, data: { ...sub.data, plan_id: null, is_free_trial: true, free_trial_end: iso(3), end_date: iso(3) } };
    await mock.clearFailures();
    await mock.failNext('/plans/subscription/*', { status: 200, body: sub2, times: -1 });
    await page.evaluate(() => window.localStorage.clear());
    await loginAs(page, 'admin', { showPlanPopup: true, plan: 'trial' });
    await page.evaluate(() => window.sessionStorage.clear());
    await page.reload();
    await expect(page.getByTestId('plan-expiry-modal').getByRole('heading', { name: 'Free Trial Ending Soon' })).toBeVisible();
    await page.getByTestId('plan-popup-primary').click();
    await page.waitForURL(/\/admin\/billing$/);
  });

  test('no popup when the plan has plenty of time left or the trial ends in more than 7 days', async ({ page, mock }) => {
    await mock.setPlan('trial'); // free trial ends in 14 days
    await loginAs(page, 'admin', { showPlanPopup: true });
    await visit(page, '/admin/home');
    await expect(page.getByTestId('filter-bar')).toBeVisible();
    await expect(page.getByTestId('plan-expiry-modal')).toHaveCount(0);
  });
});

test.describe('Q1 company switcher', () => {
  test('switching to another company resets filters and loads that company; the plan follows the company', async ({ page, mock, tenant }, testInfo) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    // create a second company for the admin through the real API
    const res = await fetch(`${MOCK_URL}/company/add`, {
      method: 'POST',
      headers: { 'x-e2e-tenant': tenant, 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: USERS.admin.userId, org_name: 'Second Co', org_address: '1 Lane', branches: ['Only Branch'], departments: ['Ops'] }),
    });
    expect(res.ok).toBeTruthy();
    // set a filter first: it must reset
    await pickOption(page, 'filter-branch', BRANCHES.warehouse.name);
    await page.getByTestId('switch-company').click();
    await expect(page.getByTestId('company-switcher')).toBeVisible();
    await expect(page.getByTestId('company-org-0002')).toBeVisible();
    await expect(page.getByTestId('company-org-0001')).toBeVisible();
    await snapBoth(page, testInfo, 'dash-company-switcher');
    await page.getByTestId('company-org-0002').click();
    await expect(page.getByTestId('org-name')).toContainText('Second Co');
    await expect(page.getByTestId('filter-branch')).toContainText('ALL');
    // the new company has no staff
    await expect(page.getByTestId('figure-total-value')).toHaveText('0');
    // the switcher marks the current one
    await page.getByTestId('switch-company').click();
    await expect(page.getByLabel('Current company')).toBeVisible();
    // tapping the current company just closes the sheet
    await page.getByTestId('company-org-0002').click();
    await expect(page.getByTestId('company-switcher')).toHaveCount(0);
  });

  test('"Add New Company" opens the company editor', async ({ page }) => {
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    await page.getByTestId('switch-company').click();
    await page.getByTestId('add-company').click();
    await page.waitForURL(/\/admin\/company\/edit/);
  });

  test('a failing company list shows an error with retry', async ({ page, mock, issues }) => {
    issues.allow(/company\/list/);
    await loginAs(page, 'admin');
    await visit(page, '/admin/home');
    await mock.failNext('/company/list/*', { status: 500, body: { detail: 'Company service down' } });
    await page.getByTestId('switch-company').click();
    await expect(page.getByText(/Company service down|Failed to load companies/).first()).toBeVisible();
  });
});

test.describe('Q1 overview', () => {
  test('status circles show the mock counts; selecting one lists exactly those people; a row opens the day detail with punch times', async ({ page, mock, tenant }, testInfo) => {
    await loginAs(page, 'admin');
    const fx = await mock.fixtures();
    await visit(page, '/admin/overview', { date: fx.today });
    const api = await mockGet<Counts>(tenant, `/home/dashboard-status?user_id=org-0001&target_date=${fx.today}`);
    for (const key of ['total', 'absent', 'late', 'punched_in', 'working', 'punched_out']) {
      const field = FIGURES.find(([k]) => k === key)![1];
      await expect(page.getByTestId(`tile-${key}-value`)).toHaveText(String(api[field]));
    }
    await expect(page.getByTestId('staff-count')).toContainText(`${api.total_staff} Staff`);
    // regression (Q1-D5): status circle labels are not clipped ("Punched ...")
    for (const key of ['total', 'absent', 'late', 'punched_in', 'working', 'punched_out']) {
      expect(await isTruncated(page.getByTestId(`tile-${key}`).locator('div').last()), `tile ${key} label`).toBe(false);
    }
    await page.getByTestId('tile-absent').click();
    await expect(page.getByTestId('staff-count')).toContainText(`${api.absent} Staff`);
    await page.getByTestId('tile-punched_out').click();
    await expect(page.getByTestId('staff-count')).toContainText(`${api.punched_out} Staff`);
    await snapBoth(page, testInfo, 'dash-overview');
    await page.getByTestId('tile-working').click();
    await expect(page.getByTestId('staff-count')).toContainText(`${api.working} Staff`);
    // open the first person (the working list always has someone)
    await page.locator('[data-testid^="staff-row-"]').first().click();
    await expect(page.getByTestId('staff-detail')).toBeVisible();
    await expect(page.getByTestId('session-1')).toBeVisible();
    await expect(page.getByTestId('total-hours')).toBeVisible();
    await snapBoth(page, testInfo, 'dash-overview-detail');
  });

  test('a past date drives the counts and the list; a future date is clamped; empty bucket shows "No Staff Found"', async ({ page, mock, tenant }) => {
    await loginAs(page, 'admin');
    const fx = await mock.fixtures();
    await visit(page, '/admin/overview', { date: dayOffset(fx.today, 10), filter: 'absent' });
    await expect(page.getByTestId('overview-date')).toHaveValue(fx.today);
    const past = dayOffset(fx.today, -200);
    await page.getByTestId('overview-date').fill(past);
    await expect(page.getByTestId('tile-working-value')).toHaveText('0');
    await page.getByTestId('tile-working').click();
    await expect(page.getByText('No Staff Found')).toBeVisible();
    await expect(page.getByTestId('date-banner-text')).toContainText(/\d{4}/);
  });
});
