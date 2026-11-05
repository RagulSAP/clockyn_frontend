import type { CrmLead } from '../types';
import {
  assignViewTitle,
  attachCarryForwardLatest,
  cfrAssignViewTitle,
  cfrBannerTitle,
  cfrRowLine,
  cfrStateOf,
  indexCarryForward,
  orderCfrRequests,
  pendingCfrCount,
} from '../utils/carryForward';
import { cfr, lead } from './fixtures';

const withCf = (over: Partial<CrmLead>): CrmLead => ({ ...lead({ id: 'L1' }), carryForward: null, ...over });

describe('carry-forward lifecycle mapping', () => {
  it('ignores rejected requests and requests without a lead', () => {
    const map = indexCarryForward([cfr({ id: 'r1', leadId: 'L1', status: 'rejected' }), cfr({ id: 'r2', leadId: '', status: 'pending' })]);
    expect(map.size).toBe(0);
  });

  it('a pending request wins over an approved one regardless of age (v1 picked the oldest)', () => {
    const map = indexCarryForward([
      cfr({ id: 'old-approved', leadId: 'L1', status: 'approved', createdAt: '2026-10-01T00:00:00Z' }),
      cfr({ id: 'new-pending', leadId: 'L1', status: 'pending', createdAt: '2026-10-10T00:00:00Z' }),
      cfr({ id: 'older-pending', leadId: 'L1', status: 'pending', createdAt: '2026-09-01T00:00:00Z' }),
    ]);
    expect(map.get('L1')).toMatchObject({ requestId: 'new-pending', status: 'pending' });
  });

  it('among approved requests the newest one is used', () => {
    const map = indexCarryForward([
      cfr({ id: 'a-old', leadId: 'L1', status: 'approved', createdAt: '2026-09-01T00:00:00Z', employeeName: 'Old' }),
      cfr({ id: 'a-new', leadId: 'L1', status: 'approved', createdAt: '2026-10-01T00:00:00Z', employeeName: 'New' }),
    ]);
    expect(map.get('L1')).toMatchObject({ requestId: 'a-new', previousStaffName: 'New' });
  });

  it('attaches the marker to the matching lead only', () => {
    const out = attachCarryForwardLatest([lead({ id: 'L1' }), lead({ id: 'L2' })], [cfr({ id: 'r1', leadId: 'L2' })]);
    expect(out[0].carryForward).toBeNull();
    expect(out[1].carryForward).toMatchObject({ requestId: 'r1', previousStaffName: 'Asha' });
  });

  it('maps lifecycle state: pending -> approved (unassigned) -> assigned to someone else', () => {
    const pending = withCf({ assignedUserId: 'u1', carryForward: { requestId: 'r', status: 'pending', previousStaffName: 'Asha', previousStaffId: 'u1' } });
    const approved = withCf({ assignedUserId: null, carryForward: { requestId: 'r', status: 'approved', previousStaffName: 'Asha', previousStaffId: 'u1' } });
    const reassigned = withCf({ assignedUserId: 'u2', assignedUserName: 'Ravi', carryForward: { requestId: 'r', status: 'approved', previousStaffName: 'Asha', previousStaffId: 'u1' } });
    expect(cfrStateOf(withCf({}))).toBe('none');
    expect(cfrStateOf(pending)).toBe('pending');
    expect(cfrStateOf(approved)).toBe('approved');
    expect(cfrStateOf(reassigned)).toBe('assigned');

    expect(cfrRowLine(pending)).toBe('CFR Pending • Prev: Asha');
    expect(cfrRowLine(approved)).toBe('CFR Approved • Prev: Asha');
    expect(cfrRowLine(reassigned)).toBe('CFR Assigned • Prev: Asha');
    expect(cfrRowLine(withCf({}))).toBeNull();

    expect(cfrBannerTitle(pending)).toBe('Carry Forward Requested');
    expect(cfrBannerTitle(approved)).toBe('CFR Approved — Assign New Staff');
    expect(cfrBannerTitle(reassigned)).toBe('CFR Assigned');
    expect(cfrAssignViewTitle(approved)).toBe('CFR Approved — Assign New Staff');
    expect(cfrAssignViewTitle(pending)).toBe('Carry Forward Requested');
    expect(cfrAssignViewTitle(withCf({}))).toBeNull();
  });

  it('titles the assign view', () => {
    expect(assignViewTitle(withCf({}))).toBe('Assign Lead');
    expect(assignViewTitle(withCf({ assignedUserId: 'u1' }))).toBe('Reassign Lead');
    expect(assignViewTitle(withCf({ carryForward: { requestId: 'r', status: 'pending', previousStaffName: '', previousStaffId: '' } }))).toBe('Assign Lead (CFR)');
  });

  it('orders pending first, de-duplicates by request id and filters by the submitted day', () => {
    const list = [
      cfr({ id: '1', leadId: 'a', status: 'approved', createdAt: '2026-10-18T03:00:00Z' }),
      cfr({ id: '2', leadId: 'b', status: 'pending', createdAt: '2026-10-17T03:00:00Z' }),
      cfr({ id: '2', leadId: 'b', status: 'pending', createdAt: '2026-10-17T03:00:00Z' }),
      cfr({ id: '3', leadId: 'c', status: 'rejected', createdAt: '2026-10-18T03:00:00Z' }),
      cfr({ id: '4', leadId: 'd', status: 'pending', createdAt: '2026-10-18T03:00:00Z' }),
    ];
    expect(orderCfrRequests(list).map((r) => r.id)).toEqual(['2', '4', '1', '3']);
    expect(orderCfrRequests(list, '2026-10-18').map((r) => r.id)).toEqual(['4', '1', '3']);
    expect(pendingCfrCount(orderCfrRequests(list, '2026-10-18'))).toBe(1);
  });
});
