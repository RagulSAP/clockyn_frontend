import type { AttendanceDay, MonthlyAttendance } from '@/types/api/attendance';
import type { StaffRequest } from '@/types/api/requests';
import type { StaffMember } from '@/types/api/staff';

export function staff(over: Partial<StaffMember> = {}): StaffMember {
  return {
    userId: 'u1',
    name: 'Asha Verma',
    empId: 'E001',
    mobile: '',
    email: '',
    department: 'Sales',
    branch: 'HQ',
    status: 'working',
    statusLabel: 'Working',
    isActive: true,
    roleId: 3,
    raw: {},
    ...over,
  };
}

export function day(over: Partial<AttendanceDay> & { rawExtra?: Record<string, unknown> } = {}): AttendanceDay {
  const { rawExtra, ...rest } = over;
  return {
    date: '2026-10-05',
    status: 'present',
    punchIn: '09:00',
    raw: { ...(rawExtra ?? {}) },
    ...rest,
  };
}

export function month(days: AttendanceDay[], over: Partial<MonthlyAttendance> = {}): MonthlyAttendance {
  return {
    month: 10,
    year: 2026,
    totalDays: 31,
    presentDays: days.filter((d) => d.status === 'present' || d.status === 'late').length,
    absentDays: 0,
    lateDays: days.filter((d) => d.status === 'late').length,
    days,
    ...over,
  };
}

export function request(over: Record<string, unknown>): StaffRequest {
  return {
    id: 'r1',
    reason: '',
    status: 'pending',
    dates: [],
    dateStatuses: {},
    userId: 'u1',
    raw: {},
    type: 'leave',
    ...over,
  } as StaffRequest;
}
