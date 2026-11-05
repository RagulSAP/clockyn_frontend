/** Employee shift / timing report: grouping staff by shift, durations and the search filter. */
import { formatDurationMinutes } from '@/lib/format';
import { formatTime12, shiftSpanMinutes } from '@/lib/datetime';
import type { Shift } from '@/types/api/shifts';
import type { StaffMember } from '@/types/api/staff';

export interface ShiftGroup {
  shift: Shift;
  staff: StaffMember[];
}

export interface ShiftReportData {
  groups: ShiftGroup[];
  unassigned: StaffMember[];
  /** Staff whose shift could not be read (they are listed under Unassigned). */
  unknownCount: number;
}

/**
 * `shiftIdByUser` maps user id → shift id; a missing entry (no shift, failed lookup or unknown shift id) means Unassigned.
 * `failedUserIds` only feeds `unknownCount`.
 */
export function groupStaffByShift(
  shifts: readonly Shift[],
  staff: readonly StaffMember[],
  shiftIdByUser: ReadonlyMap<string, number | undefined>,
  failedUserIds: ReadonlySet<string> = new Set(),
): ShiftReportData {
  const groups: ShiftGroup[] = shifts.map((shift) => ({ shift, staff: [] }));
  const byId = new Map(groups.map((g) => [g.shift.id, g]));
  const unassigned: StaffMember[] = [];
  let unknownCount = 0;
  const seen = new Set<string>();
  for (const s of staff) {
    if (seen.has(s.userId)) continue; // a duplicated id would otherwise double-count and clash as a React key
    seen.add(s.userId);
    const group = byId.get(shiftIdByUser.get(s.userId) ?? -1);
    if (group) group.staff.push(s);
    else unassigned.push(s);
    if (failedUserIds.has(s.userId)) unknownCount += 1;
  }
  return { groups, unassigned, unknownCount };
}

export function assignedCount(data: Pick<ShiftReportData, 'groups'>): number {
  return data.groups.reduce((n, g) => n + g.staff.length, 0);
}

/** `09:00 AM – 06:00 PM`, `—` for a missing side. */
export function shiftTimeRange(shift: Pick<Shift, 'startTime' | 'endTime'>): string {
  const t = (v: string) => (v ? formatTime12(v) : '—');
  return `${t(shift.startTime)} – ${t(shift.endTime)}`;
}

/** Shift length with the overnight rule: `9h`, `8h 30m`; empty when a time is missing. */
export function shiftDuration(shift: Pick<Shift, 'startTime' | 'endTime'>): string {
  if (!shift.startTime || !shift.endTime) return '';
  const span = shiftSpanMinutes(shift.startTime, shift.endTime);
  return span === null ? '' : formatDurationMinutes(span, { zero: '' });
}

/** Search over name, employee id, department and branch. Applies to the lists inside the cards only. */
export function filterShiftStaff(staff: readonly StaffMember[], query: string): StaffMember[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...staff];
  return staff.filter((s) => [s.name, s.empId, s.department, s.branch].some((v) => (v ?? '').toLowerCase().includes(q)));
}
