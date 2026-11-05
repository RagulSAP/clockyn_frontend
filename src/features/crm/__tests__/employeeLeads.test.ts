import { buildEmployeeLeads, filterEmployeeLeads } from '../utils/employeeLeads';
import { lead, myCfr } from './fixtures';

describe('employee lead list', () => {
  const rows = [
    lead({ id: '1', workStatus: 'pending', assignedAt: '2026-10-10T04:00:00Z' }), // assigned on an earlier day
    lead({ id: '2', workStatus: 'working' }),
    lead({ id: '3', workStatus: 'completed' }),
    lead({ id: '4', workStatus: null }),
    lead({ id: '2', workStatus: 'working' }), // duplicate row
  ];

  it('keeps leads assigned on earlier days (the v1 "assigned today" filter hid them)', () => {
    const list = buildEmployeeLeads(rows, []);
    expect(list.map((l) => l.id)).toEqual(['1', '2', '3', '4']);
    expect(filterEmployeeLeads(list, 'all')).toHaveLength(4);
  });

  it('filters by status chip; unknown status counts as pending', () => {
    const list = buildEmployeeLeads(rows, []);
    expect(filterEmployeeLeads(list, 'pending').map((l) => l.id)).toEqual(['1', '4']);
    expect(filterEmployeeLeads(list, 'working').map((l) => l.id)).toEqual(['2']);
    expect(filterEmployeeLeads(list, 'completed').map((l) => l.id)).toEqual(['3']);
  });

  it('drives the carry-forward card from my pending request, not from the (never persisted) status', () => {
    const list = buildEmployeeLeads(rows, [myCfr({ id: 'r1', leadId: '2' }), myCfr({ id: 'r2', leadId: '3', status: 'approved' }), myCfr({ id: 'r3', leadId: '1', status: 'rejected' })]);
    const byId = Object.fromEntries(list.map((l) => [l.id, l]));
    expect(byId['2'].pendingCfr?.id).toBe('r1');
    expect(byId['2'].displayStatus).toBe('carry_forward');
    expect(byId['3'].pendingCfr).toBeNull();
    expect(byId['3'].displayStatus).toBe('completed');
    expect(byId['1'].pendingCfr).toBeNull();
    // a lead awaiting approval is in no status chip (v1 has no carry-forward chip)
    expect(filterEmployeeLeads(list, 'working')).toHaveLength(0);
  });
});
