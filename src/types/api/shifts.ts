import type { RawRecord, TimeString } from './common';

export interface Shift {
  /** Integer id. */
  id: number;
  name: string;
  /** `HH:mm` 24-hour (the server sends `"09:30AM"`). */
  startTime: TimeString;
  endTime: TimeString;
  isActive: boolean;
  raw: RawRecord;
}

export interface ShiftInput {
  orgId: string;
  name: string;
  startTime: TimeString;
  endTime: TimeString;
}

export interface ShiftWriteResult {
  shiftId?: number;
  message: string;
}

export interface AssignShiftInput {
  orgId: string;
  shiftId: number;
  userIds: string[];
}
