import type { DateDecision, RequestStatus, RequestType, StaffRequest } from '@/types/api/requests';

type Over = Partial<{
  id: string;
  status: RequestStatus;
  dates: string[];
  dateStatuses: Record<string, DateDecision>;
  createdAt: string;
  staffName: string;
  reason: string;
  raw: Record<string, unknown>;
  startTime: string;
  endTime: string;
  currentShiftTiming: string;
  requestedShiftTiming: string;
  shiftChangeDate: string;
}>;

export function makeRequest(type: RequestType, over: Over = {}): StaffRequest {
  const base = {
    id: over.id ?? `${type}-1`,
    reason: over.reason ?? 'Family function',
    status: over.status ?? 'pending',
    dates: over.dates ?? [],
    dateStatuses: over.dateStatuses ?? {},
    createdAt: over.createdAt ?? '2025-01-05T10:00:00Z',
    staffName: over.staffName ?? 'Asha Verma',
    raw: over.raw ?? {},
  };
  switch (type) {
    case 'permission':
      return { ...base, type, startTime: over.startTime ?? '14:30', endTime: over.endTime ?? '16:00' };
    case 'shift_change':
      return {
        ...base,
        type,
        currentShiftTiming: over.currentShiftTiming ?? '09:00 AM - 06:00 PM',
        requestedShiftTiming: over.requestedShiftTiming ?? '10:00 AM - 07:00 PM',
        shiftChangeDate: over.shiftChangeDate ?? '2025-01-10',
      };
    case 'device_change':
      return { ...base, type };
    default:
      return { ...base, type: 'leave' };
  }
}

export const decided = (status: RequestStatus): DateDecision => ({ status });
