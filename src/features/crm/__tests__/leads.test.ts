import { customChipLabel, displayDate, matchesLeadDate, matchesSubmittedDate, resolveFilterDate } from '../utils/dates';
import { buildCrmLeads, bucketOf, countBuckets, countForDay, dedupeLeads, filterByDate, filterByStat, leadsTodayLabel, sortCompletedLast, uniqueByUserId } from '../utils/leads';
import { cfr, lead } from './fixtures';

const crm = (over: Parameters<typeof lead>[0]) => ({ ...lead(over), carryForward: null });

describe('date filters (IST)', () => {
  it('resolves the relative chips from the given IST day', () => {
    expect(resolveFilterDate('today', '', '2026-10-18')).toBe('2026-10-18');
    expect(resolveFilterDate('tomorrow', '', '2026-10-31')).toBe('2026-11-01');
    expect(resolveFilterDate('yesterday', '', '2026-11-01')).toBe('2026-10-31');
    expect(resolveFilterDate('custom', '2026-03-05', '2026-10-18')).toBe('2026-03-05');
    expect(resolveFilterDate('custom', '', '2026-10-18')).toBe('');
    expect(resolveFilterDate('all', '', '2026-10-18')).toBe('');
  });

  it('matches a lead by required date, else creation day; empty selection matches all', () => {
    expect(matchesLeadDate({ effectiveDate: '2026-10-18' }, '2026-10-18')).toBe(true);
    expect(matchesLeadDate({ effectiveDate: '2026-10-17' }, '2026-10-18')).toBe(false);
    expect(matchesLeadDate({ effectiveDate: null }, '')).toBe(true);
  });

  it('filters carry-forward requests by the IST submission day', () => {
    // 2026-10-17T20:00Z is already 18 Oct in IST
    expect(matchesSubmittedDate({ createdAt: '2026-10-17T20:00:00Z' }, '2026-10-18')).toBe(true);
    expect(matchesSubmittedDate({ createdAt: '2026-10-17T20:00:00Z' }, '2026-10-17')).toBe(false);
    expect(matchesSubmittedDate({ createdAt: null }, '')).toBe(true);
  });

  it('formats chip and display dates', () => {
    expect(customChipLabel('2026-03-05')).toBe('05/03');
    expect(customChipLabel('')).toBe('Pick Date');
    expect(displayDate('2026-03-05')).toBe('05 Mar 2026');
    expect(displayDate(null)).toBe('N/A');
  });
});

describe('lead list logic', () => {
  it('merges multi-assignee rows into ONE lead (no duplicate cards)', () => {
    const rows = [
      lead({ id: 'L1', assignedUserId: 'u1', assignedUserName: 'Asha', workStatus: 'working' }),
      lead({ id: 'L1', assignedUserId: 'u2', assignedUserName: 'Ravi', workStatus: 'pending' }),
      lead({ id: 'L2' }),
    ];
    const out = dedupeLeads(rows);
    expect(out.map((l) => l.id)).toEqual(['L1', 'L2']);
    expect(out[0].assignedUserName).toBe('Asha, Ravi');
    expect(out[0].assignedUserId).toBe('u1');
    expect(buildCrmLeads(rows, [])).toHaveLength(2);
  });

  it('counts and lists use the same buckets', () => {
    const leads = [
      crm({ id: '1' }),
      crm({ id: '2', assignedUserId: 'u', workStatus: 'pending' }),
      crm({ id: '3', assignedUserId: 'u', workStatus: 'working' }),
      crm({ id: '4', assignedUserId: 'u', workStatus: 'completed' }),
      crm({ id: '5', assignedUserId: 'u', workStatus: 'carry_forward' }),
      crm({ id: '6', workStatus: 'carry_forward' }), // unassigned carry-forward (v1 count/list disagreed)
      crm({ id: '7', assignedUserId: 'u', workStatus: null }), // unknown status -> pending
    ];
    const counts = countBuckets(leads);
    expect(counts).toEqual({ total: 7, unassigned: 1, pending: 2, working: 1, completed: 1, carry_forward: 2 });
    for (const key of ['unassigned', 'pending', 'working', 'completed', 'carry_forward'] as const) {
      expect(filterByStat(leads, key)).toHaveLength(counts[key]);
    }
    expect(filterByStat(leads, 'total')).toHaveLength(7);
    expect(bucketOf(leads[5])).toBe('carry_forward');
  });

  it('filters by day, sorts completed last (stable) and counts "today"', () => {
    const leads = [
      crm({ id: 'a', requiredDate: '2026-10-18', workStatus: 'completed', assignedUserId: 'u' }),
      crm({ id: 'b', requiredDate: '2026-10-18' }),
      crm({ id: 'c', requiredDate: '2026-10-19' }),
      crm({ id: 'd', createdOn: '2026-10-18' }),
    ];
    expect(filterByDate(leads, '2026-10-18').map((l) => l.id)).toEqual(['a', 'b', 'd']);
    expect(sortCompletedLast(filterByDate(leads, '2026-10-18')).map((l) => l.id)).toEqual(['b', 'd', 'a']);
    expect(countForDay(leads, '2026-10-18')).toBe(3);
  });

  it('labels the menu card count with singular / plural', () => {
    expect(leadsTodayLabel(1)).toBe('1 lead today');
    expect(leadsTodayLabel(0)).toBe('0 leads today');
    expect(leadsTodayLabel(3)).toBe('3 leads today');
  });

  it('de-duplicates employees and excludes the current assignee', () => {
    const emps = [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u1' }, { userId: 'u3' }];
    expect(uniqueByUserId(emps, 'u2').map((e) => e.userId)).toEqual(['u1', 'u3']);
    expect(uniqueByUserId(emps)).toHaveLength(3);
  });

  it('attaches the newest pending CFR when building admin leads', () => {
    const out = buildCrmLeads([lead({ id: 'L1' })], [cfr({ id: 'x', leadId: 'L1', status: 'approved' }), cfr({ id: 'y', leadId: 'L1', status: 'pending' })]);
    expect(out[0].carryForward?.requestId).toBe('y');
  });
});
