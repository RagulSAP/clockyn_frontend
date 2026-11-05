import type { CarryForwardRequest, Lead, MyCarryForwardRequest } from '@/types/api/leads';

export function lead(over: Partial<Lead> & { id: string }): Lead {
  return {
    clientName: `Client ${over.id}`,
    mobile: '9876543210',
    address: '12 Main Road',
    categoryName: 'General',
    remarks: '',
    requiredDate: null,
    createdOn: '2026-10-01',
    createdAt: '2026-10-01T04:00:00.000Z',
    effectiveDate: over.requiredDate ?? over.createdOn ?? '2026-10-01',
    assignedUserId: null,
    assignedUserName: null,
    workStatus: null,
    assignedAt: null,
    pipelineStatus: null,
    raw: {},
    ...over,
  };
}

export function cfr(over: Partial<CarryForwardRequest> & { id: string; leadId: string }): CarryForwardRequest {
  return {
    userId: 'u1',
    employeeName: 'Asha',
    description: 'Client unavailable',
    requestDate: '2026-10-20',
    status: 'pending',
    createdAt: '2026-10-18T05:00:00.000Z',
    clientName: `Client ${over.leadId}`,
    leadDate: null,
    raw: {},
    ...over,
  };
}

export function myCfr(over: Partial<MyCarryForwardRequest> & { id: string; leadId: string }): MyCarryForwardRequest {
  return {
    description: 'Need another day',
    requestDate: '2026-10-20',
    status: 'pending',
    actionedAt: null,
    clientName: `Client ${over.leadId}`,
    forwardedDate: null,
    mobile: '',
    address: '',
    categoryName: '',
    workStatus: null,
    raw: {},
    ...over,
  };
}
