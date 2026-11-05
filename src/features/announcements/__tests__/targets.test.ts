import { buildAnnouncementBody, mapAnnouncement } from '@/api/announcements';
import {
  accentIndex,
  allVisibleSelected,
  audienceTag,
  chipLabel,
  filterAnnouncements,
  filterStaff,
  isSendDisabled,
  sendLabel,
  staffSubtitle,
  successSubtitle,
  toCreateInput,
  toggleId,
  toggleSelectAll,
  validateCompose,
  type ComposeAudience,
} from '../targets';

const base = { orgId: 'org1', sentById: 'admin1', title: '  Holiday  ', message: ' Office closed ' };

describe('audience -> payload mapping', () => {
  it('all staff: no recipient fields, trimmed text', () => {
    const body = buildAnnouncementBody(toCreateInput({ ...base, audience: { kind: 'all' } }));
    expect(body).toEqual({ org_id: 'org1', sent_by_id: 'admin1', title: 'Holiday', message: 'Office closed', target: 'all' });
    expect(body).not.toHaveProperty('selected_user_ids');
  });

  it('selected staff: selected_user_ids only', () => {
    const body = buildAnnouncementBody(toCreateInput({ ...base, audience: { kind: 'selected', userIds: ['u1', 'u2'] } }));
    expect(body).toMatchObject({ target: 'selected', selected_user_ids: ['u1', 'u2'] });
    expect(body).not.toHaveProperty('branch_id');
    expect(body).not.toHaveProperty('dept_id');
  });

  it('branch: numeric branch_id only', () => {
    const body = buildAnnouncementBody(toCreateInput({ ...base, audience: { kind: 'branch', branchId: '7' } }));
    expect(body).toMatchObject({ target: 'branch', branch_id: 7 });
    expect(body).not.toHaveProperty('dept_id');
    expect(body).not.toHaveProperty('selected_user_ids');
  });

  it('department: dept_id only', () => {
    const body = buildAnnouncementBody(toCreateInput({ ...base, audience: { kind: 'dept', deptId: 'D-9' } }));
    expect(body).toMatchObject({ target: 'dept', dept_id: 'D-9' });
    expect(body).not.toHaveProperty('branch_id');
  });

  it('refuses incomplete audiences', () => {
    expect(() => toCreateInput({ ...base, audience: { kind: 'selected', userIds: [] } })).toThrow('Select at least 1 staff member');
    expect(() => toCreateInput({ ...base, audience: { kind: 'branch', branchId: null } })).toThrow('Select a branch');
    expect(() => toCreateInput({ ...base, audience: { kind: 'dept', deptId: '' } })).toThrow('Select a department');
  });
});

describe('validation (v1 order and wording)', () => {
  const all: ComposeAudience = { kind: 'all' };
  it('title first, then message, then the audience', () => {
    expect(validateCompose('  ', '', all)).toBe('Title is required');
    expect(validateCompose('t', '   ', all)).toBe('Message is required');
    expect(validateCompose('t', 'm', { kind: 'selected', userIds: [] })).toBe('Select at least 1 staff member');
    expect(validateCompose('t', 'm', { kind: 'branch', branchId: null })).toBe('Select a branch');
    expect(validateCompose('t', 'm', { kind: 'dept', deptId: null })).toBe('Select a department');
    expect(validateCompose('t', 'm', all)).toBeNull();
  });
  it('send is disabled while invalid or sending', () => {
    expect(isSendDisabled('', 'm', all, false)).toBe(true);
    expect(isSendDisabled('t', 'm', all, true)).toBe(true);
    expect(isSendDisabled('t', 'm', { kind: 'selected', userIds: ['a'] }, false)).toBe(false);
  });
});

describe('labels', () => {
  it('send button label', () => {
    expect(sendLabel({ kind: 'all' })).toBe('Send to All Staff');
    expect(sendLabel({ kind: 'selected', userIds: ['a', 'b', 'c'] })).toBe('Send to 3 Staff');
    expect(sendLabel({ kind: 'branch', branchId: null })).toBe('Send to Branch');
    expect(sendLabel({ kind: 'branch', branchId: '1' }, { branchName: 'Chennai' })).toBe('Send to Chennai');
    expect(sendLabel({ kind: 'dept', deptId: null })).toBe('Send to Department');
    expect(sendLabel({ kind: 'dept', deptId: '1' }, { deptName: 'Sales' })).toBe('Send to Sales');
  });

  it('success subtitle reflects the audience that was sent to (computed before the reset)', () => {
    expect(successSubtitle({ kind: 'all' })).toBe('All staff have been notified');
    expect(successSubtitle({ kind: 'selected', userIds: ['a'] })).toBe('1 staff member notified');
    expect(successSubtitle({ kind: 'selected', userIds: ['a', 'b', 'c'] })).toBe('3 staff members notified');
    expect(successSubtitle({ kind: 'branch', branchId: '1' }, { branchName: 'Chennai' })).toBe('Chennai staff notified');
    expect(successSubtitle({ kind: 'dept', deptId: '1' }, { deptName: 'Sales' })).toBe('Sales staff notified');
    expect(successSubtitle({ kind: 'branch', branchId: '1' })).toBe('Branch staff notified');
  });
});

describe('staff picker helpers', () => {
  it('toggleId adds and removes', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('select all works over the visible rows and keeps picks outside the filter', () => {
    expect(allVisibleSelected(['a'], [])).toBe(false);
    expect(toggleSelectAll([], ['a', 'b'])).toEqual(['a', 'b']);
    expect(toggleSelectAll(['z'], ['a', 'b'])).toEqual(['z', 'a', 'b']);
    expect(toggleSelectAll(['z', 'a', 'b'], ['a', 'b'])).toEqual(['z']); // pressing again removes only the visible ones
    expect(toggleSelectAll(['a', 'b'], ['a', 'b'])).toEqual([]);
  });

  const staff = [
    { userId: '1', name: 'Asha Verma', department: 'Sales', branch: 'Pune' },
    { userId: '2', name: 'Rahul Nair', department: 'Ops', branch: 'Chennai' },
  ];
  it('filters by name, department or branch', () => {
    expect(filterStaff(staff, 'asha').map((s) => s.userId)).toEqual(['1']);
    expect(filterStaff(staff, ' chennai ').map((s) => s.userId)).toEqual(['2']);
    expect(filterStaff(staff, 'sales').map((s) => s.userId)).toEqual(['1']);
    expect(filterStaff(staff, '')).toHaveLength(2);
  });
  it('subtitle and chip label fall back to "Staff"', () => {
    expect(staffSubtitle({ department: 'Sales', branch: 'Pune' })).toBe('Sales · Pune');
    expect(staffSubtitle({ department: '', branch: 'Pune' })).toBe('Pune');
    expect(staffSubtitle({ department: '', branch: '' })).toBe('Staff');
    expect(chipLabel('Asha Verma')).toBe('Asha');
    expect(chipLabel(undefined)).toBe('Staff');
  });
});

describe('history search and audience tags', () => {
  const a = mapAnnouncement({ id: 'a1', title: 'Payroll update', message: 'Salaries on 5th', target: 'all' });
  const b = mapAnnouncement({ id: 'b1', title: 'Diwali', message: 'Sweets', target: 'branch', branch_name: 'Chennai' });
  const c = mapAnnouncement({ id: 'c1', title: 'Offsite', message: 'Trip', target: 'dept', dept_name: 'Sales' });
  const d = mapAnnouncement({ id: 'd1', title: 'Training', message: 'Room 2', target: 'selected', recipient_count: 4 });

  it('searches title and message (trimmed, case-insensitive)', () => {
    expect(filterAnnouncements([a, b], '  PAYROLL ')).toEqual([a]);
    expect(filterAnnouncements([a, b], 'sweets')).toEqual([b]);
    expect(filterAnnouncements([a, b], 'zzz')).toEqual([]);
    expect(filterAnnouncements([a, b], '')).toEqual([a, b]);
  });
  it('can also match the branch / department name', () => {
    expect(filterAnnouncements([b, c], 'chennai')).toEqual([]);
    expect(filterAnnouncements([b, c], 'chennai', true)).toEqual([b]);
    expect(filterAnnouncements([b, c], 'sales', true)).toEqual([c]);
  });
  it('audience pill text', () => {
    expect(audienceTag(a).label).toBe('All Staff');
    expect(audienceTag(d).label).toBe('4 Staff'); // admin history: recipient_count
    expect(audienceTag(d, { feed: 'broadcast' }).label).toBe('Selected Staff'); // staff feed
    expect(audienceTag(a, { feed: 'broadcast' }).label).toBe('All Staff');
    expect(audienceTag(b)).toEqual({ icon: 'building', label: 'Chennai' });
    expect(audienceTag(c)).toEqual({ icon: 'layers', label: 'Sales' });
    expect(audienceTag({ ...b, branchName: null }).label).toBe('Branch');
    expect(audienceTag({ ...c, deptName: null }).label).toBe('Department');
  });
  it('accent index is sum(char codes) % 8 (stable, string ids only)', () => {
    expect(accentIndex('a')).toBe(97 % 8);
    expect(accentIndex('ab')).toBe((97 + 98) % 8);
    expect(accentIndex('')).toBe(0);
  });
});
