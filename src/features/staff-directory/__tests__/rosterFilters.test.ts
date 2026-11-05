import type { StaffMember } from '@/types/api/staff';

import {
  bannerFor,
  chipCounts,
  dedupeById,
  emptyCopy,
  filterRoster,
  liveStatusFor,
  mergeRoleInfo,
  normalizeRosterFilter,
  statusDisplay,
} from '../utils/rosterFilters';

function member(over: Partial<StaffMember> & { userId: string }): StaffMember {
  return {
    name: over.userId,
    empId: '',
    mobile: '',
    email: '',
    department: '',
    branch: '',
    status: 'unknown',
    statusLabel: '',
    isActive: true,
    raw: {},
    ...over,
  };
}

describe('normalizeRosterFilter', () => {
  it('accepts the six filter values', () => {
    for (const f of ['total', 'late', 'punched_in', 'working', 'punched_out', 'absent']) expect(normalizeRosterFilter(f)).toBe(f);
  });
  it('maps the department-tile aliases', () => {
    expect(normalizeRosterFilter('punch_in')).toBe('punched_in');
    expect(normalizeRosterFilter('punch_out')).toBe('punched_out');
    expect(normalizeRosterFilter('late_punched_in')).toBe('late');
  });
  it('falls back to total', () => {
    expect(normalizeRosterFilter(undefined)).toBe('total');
    expect(normalizeRosterFilter('nonsense')).toBe('total');
    expect(normalizeRosterFilter(' ABSENT ')).toBe('absent');
  });
});

describe('liveStatusFor', () => {
  it('maps filters to live endpoints', () => {
    expect(liveStatusFor('total')).toBeNull();
    expect(liveStatusFor('late')).toBe('late_punched_in');
    expect(liveStatusFor('absent')).toBe('absent');
    expect(liveStatusFor('working')).toBe('working');
  });
});

describe('mergeRoleInfo (tile-driven views)', () => {
  const live = [member({ userId: 'a', name: 'Asha' }), member({ userId: 'b', name: 'Bala' })];
  const full = [
    member({ userId: 'a', roleId: 3, isActive: true, photoUrl: 'https://img/a.png' }),
    member({ userId: 'b', roleId: 2, isActive: false }),
    member({ userId: 'c', roleId: 3 }),
  ];

  it('fills role, active flag and photo from the full roster without adding members', () => {
    const merged = mergeRoleInfo(live, full);
    expect(merged.map((m) => m.userId)).toEqual(['a', 'b']);
    expect(merged[0]).toMatchObject({ roleId: 3, photoUrl: 'https://img/a.png' });
    expect(merged[1]).toMatchObject({ roleId: 2, isActive: false });
  });

  it('keeps the live list when the full roster is unavailable', () => {
    expect(mergeRoleInfo(live, undefined)).toHaveLength(2);
    expect(mergeRoleInfo(live, [])).toHaveLength(2);
  });

  it('makes the chip counts work for a live bucket', () => {
    expect(chipCounts(mergeRoleInfo(live, full))).toEqual({ all: 2, staff: 1, manager: 1, inactive: 1 });
  });
});

describe('chipCounts', () => {
  it('counts roles, inactive and ignores duplicates', () => {
    const list = [
      member({ userId: '1', roleId: 3 }),
      member({ userId: '2', roleId: 3 }),
      member({ userId: '3', roleId: 3 }),
      member({ userId: '4', roleId: 2 }),
      member({ userId: '5', roleId: 3, isActive: false }),
      member({ userId: '5', roleId: 3, isActive: false }),
      member({ userId: '6' }),
    ];
    expect(chipCounts(list)).toEqual({ all: 6, staff: 4, manager: 1, inactive: 1 });
  });
});

describe('filterRoster', () => {
  const list = [
    member({ userId: '1', name: 'zara', roleId: 3, branch: 'Mumbai HQ', department: 'Sales' }),
    member({ userId: '2', name: 'Asha', roleId: 2, branch: 'Pune', department: 'Ops' }),
    member({ userId: '3', name: 'bala', roleId: 3, isActive: false, branch: 'Pune', department: 'Sales' }),
    member({ userId: '3', name: 'bala', roleId: 3, isActive: false, branch: 'Pune', department: 'Sales' }),
  ];

  it('sorts A-Z case-insensitively and de-duplicates', () => {
    expect(filterRoster(list, { role: 'all', search: '' }).map((m) => m.name)).toEqual(['Asha', 'bala', 'zara']);
  });
  it('filters by role chip', () => {
    expect(filterRoster(list, { role: 'staff', search: '' })).toHaveLength(2);
    expect(filterRoster(list, { role: 'manager', search: '' }).map((m) => m.name)).toEqual(['Asha']);
    expect(filterRoster(list, { role: 'inactive', search: '' }).map((m) => m.name)).toEqual(['bala']);
  });
  it('searches name, branch and department (trimmed, case-insensitive)', () => {
    expect(filterRoster(list, { role: 'all', search: '  MUM ' }).map((m) => m.name)).toEqual(['zara']);
    expect(filterRoster(list, { role: 'all', search: 'ops' }).map((m) => m.name)).toEqual(['Asha']);
    expect(filterRoster(list, { role: 'all', search: 'zzz' })).toEqual([]);
  });
  it('combines filters with AND', () => {
    expect(filterRoster(list, { role: 'staff', search: 'pune' }).map((m) => m.name)).toEqual(['bala']);
  });
  it('a department filter with no matches is EMPTY, not the whole roster', () => {
    expect(filterRoster(list, { role: 'all', search: '', deptName: 'Finance' })).toEqual([]);
    expect(filterRoster(list, { role: 'all', search: '', deptName: 'sales' }).map((m) => m.name)).toEqual(['bala', 'zara']);
  });
  it('filters by branch name', () => {
    expect(filterRoster(list, { role: 'all', search: '', branchName: 'Pune' }).map((m) => m.name)).toEqual(['Asha', 'bala']);
  });
});

describe('banners, empty copy, status', () => {
  it('shows banners only for absent / late with rows and pluralises', () => {
    expect(bannerFor('absent', 1)).toMatchObject({ title: 'Absent Today', subtitle: '1 member absent' });
    expect(bannerFor('absent', 3)?.subtitle).toBe('3 members absent');
    expect(bannerFor('late', 2)).toMatchObject({ title: 'Late Punch-In Today', subtitle: '2 members punched in late' });
    expect(bannerFor('late', 0)).toBeNull();
    expect(bannerFor('total', 5)).toBeNull();
  });
  it('empty copy depends on the search text', () => {
    expect(emptyCopy('mum')).toEqual({ title: 'No Results', message: 'No staff matching "mum"' });
    expect(emptyCopy('  ')).toEqual({ title: 'No Staff Found', message: 'There are no staff members in this category' });
  });
  it('maps live statuses to badges', () => {
    expect(statusDisplay('absent')).toEqual({ label: 'Absent', tone: 'danger' });
    expect(statusDisplay('unknown')).toBeNull();
  });
  it('dedupeById keeps the first row', () => {
    expect(dedupeById([member({ userId: '1', name: 'first' }), member({ userId: '1', name: 'second' })])[0].name).toBe('first');
  });
});
