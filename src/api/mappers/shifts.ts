import type { Shift, ShiftInput } from '@/types/api/shifts';
import { bool, num, objectOf, optNum, pick, rec, str, toCompact12h, toHHmm } from './common';

/**
 * Maps one shift. Tolerates the key variants seen in v1 (`start_time | startTime | shift_start`,
 * `shift_name | name | shiftName`, `shift_id | id`).
 */
export function mapShift(input: unknown): Shift {
  const r = rec(input);
  const status = optNum(r.status);
  return {
    id: num(pick(r, 'shift_id', 'id', 'shiftId')),
    name: str(pick(r, 'shift_name', 'name', 'shiftName')),
    startTime: toHHmm(pick(r, 'start_time', 'startTime', 'shift_start')) ?? '',
    endTime: toHHmm(pick(r, 'end_time', 'endTime', 'shift_end')) ?? '',
    isActive: status === undefined ? true : status === 1 || bool(r.status),
    raw: r,
  };
}

/** `/shift/get_shift/{id}` may answer `{data}`, `{shift}` or a bare object. */
export function mapSingleShift(body: unknown): Shift {
  return mapShift(objectOf(body, ['data', 'shift']));
}

/** Body of `POST /shift/create` and `PUT /shift/update/{id}`: times are sent as `hh:mmAM/PM` (no space), like v1. */
export function toShiftBody(input: ShiftInput): Record<string, unknown> {
  return {
    org_id: input.orgId,
    shift_name: input.name.trim(),
    start_time: toCompact12h(input.startTime),
    end_time: toCompact12h(input.endTime),
  };
}
