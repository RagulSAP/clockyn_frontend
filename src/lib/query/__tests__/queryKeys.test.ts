import { QueryClient } from '@tanstack/react-query';

import { invalidateScope, normalizeParams, queryKeys } from '../queryKeys';

const startsWith = (key: readonly unknown[], prefix: readonly unknown[]): boolean => prefix.every((p, i) => key[i] === p);

describe('normalizeParams', () => {
  it('drops empty values and sorts keys', () => {
    expect(normalizeParams({ b: 2, a: 1, c: undefined, d: null, e: '' })).toEqual({ a: 1, b: 2 });
    expect(Object.keys(normalizeParams({ z: 1, a: 2 }))).toEqual(['a', 'z']);
    expect(normalizeParams(undefined)).toEqual({});
  });
  it('keeps falsy-but-meaningful values', () => {
    expect(normalizeParams({ n: 0, f: false })).toEqual({ n: 0, f: false });
  });
  it('copies arrays', () => {
    const arr = [1, 2];
    const out = normalizeParams({ ids: arr }).ids as number[];
    expect(out).toEqual([1, 2]);
    expect(out).not.toBe(arr);
  });
});

describe('queryKeys structure', () => {
  it('domain is key[0] and scope is key[1]', () => {
    expect(queryKeys.staff.list('org1', { branchId: 3 })[0]).toBe('staff');
    expect(queryKeys.staff.list('org1')[1]).toBe('org1');
    expect(queryKeys.chat.list('u1', 'org1')[1]).toBe('u1');
    expect(queryKeys.plans.status('org1')).toEqual(['plans', 'org1', 'status']);
  });
  it('scopes differ per organisation (no cross-org cache sharing)', () => {
    expect(queryKeys.branches.list('orgA')).not.toEqual(queryKeys.branches.list('orgB'));
    expect(queryKeys.home.dashboard('orgA', { date: '2025-01-01' })).not.toEqual(queryKeys.home.dashboard('orgB', { date: '2025-01-01' }));
  });
  it('equal filters share a key regardless of property order or empty values', () => {
    expect(queryKeys.staff.list('o', { a: 1, b: 2, c: undefined })).toEqual(queryKeys.staff.list('o', { b: 2, a: 1 }));
  });
  it('different filters produce different keys', () => {
    expect(queryKeys.staff.list('o', { branchId: 1 })).not.toEqual(queryKeys.staff.list('o', { branchId: 2 }));
    expect(queryKeys.attendance.month('u', 2025, 1)).not.toEqual(queryKeys.attendance.month('u', 2025, 2));
  });
  it('null / undefined scopes become empty strings (never "undefined")', () => {
    expect(queryKeys.staff.all(undefined)).toEqual(['staff', '']);
    expect(queryKeys.staff.all(null)).toEqual(['staff', '']);
    expect(JSON.stringify(queryKeys.staff.detail('o', undefined))).not.toContain('undefined');
  });
  it('`all(scope)` is a prefix of every other key in the domain', () => {
    const o = 'org1';
    const staffKeys = [
      queryKeys.staff.list(o),
      queryKeys.staff.detail(o, 's1'),
      queryKeys.staff.profile(o, 's1'),
      queryKeys.staff.picker(o),
      queryKeys.staff.count(o),
      queryKeys.staff.nextEmployeeId(o),
      queryKeys.staff.options(o, 'branches'),
    ];
    for (const k of staffKeys) expect(startsWith(k, queryKeys.staff.all(o))).toBe(true);

    const homeKeys = [
      queryKeys.home.dashboard(o, { date: '2025-01-01' }),
      queryKeys.home.departmentStats(o, '2025-01-01'),
      queryKeys.home.staffByStatus(o, 'late', { date: '2025-01-01' }),
      queryKeys.home.allStaff(o),
      queryKeys.home.branches(o),
    ];
    for (const k of homeKeys) expect(startsWith(k, queryKeys.home.all(o))).toBe(true);

    expect(startsWith(queryKeys.plans.status(o), queryKeys.plans.all(o))).toBe(true);
    expect(startsWith(queryKeys.plans.subscription(o), queryKeys.plans.all(o))).toBe(true);
    expect(startsWith(queryKeys.requests.pendingCounts(o), queryKeys.requests.all(o))).toBe(true);
    expect(startsWith(queryKeys.leads.categories(o), queryKeys.leads.all(o))).toBe(true);
    expect(startsWith(queryKeys.payroll.templates(o, 'payslip'), queryKeys.payroll.all(o))).toBe(true);
    expect(startsWith(queryKeys.location.live(o, '2025-01-01'), queryKeys.location.all(o))).toBe(true);
    expect(startsWith(queryKeys.chat.messages('u', 'p'), queryKeys.chat.all('u'))).toBe(true);
    expect(startsWith(queryKeys.groupChat.members('u', 'g'), queryKeys.groupChat.all('u'))).toBe(true);
    expect(startsWith(queryKeys.attendance.today('u'), queryKeys.attendance.all('u'))).toBe(true);
    expect(startsWith(queryKeys.expenses.odometer('u'), queryKeys.expenses.all('u'))).toBe(true);
  });
  it('keys are JSON serialisable', () => {
    expect(() => JSON.stringify(queryKeys.home.dashboard('o', { date: '2025-01-01', branchId: 2 }))).not.toThrow();
  });
});

describe('invalidateScope', () => {
  it('invalidates every query scoped to the id and nothing else', async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.staff.list('orgA'), [1]);
    client.setQueryData(queryKeys.branches.list('orgA'), [2]);
    client.setQueryData(queryKeys.staff.list('orgB'), [3]);
    await invalidateScope(client, 'orgA');
    expect(client.getQueryState(queryKeys.staff.list('orgA'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.branches.list('orgA'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.staff.list('orgB'))?.isInvalidated).toBe(false);
    client.clear();
  });
});
