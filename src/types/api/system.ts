/** DTOs for system-level endpoints (`src/api/system.ts`): version check, suggestions, holidays, attendance rule. */
import type { DateString } from './common';

/** Result of the app version check. */
export interface VersionCheck {
  updateRequired: boolean;
  latestVersion: string | null;
  forceUpdate: boolean;
  message: string | null;
  storeUrl: string | null;
}

/** Input of `submitFeatureSuggestion`. */
export interface FeatureSuggestionInput {
  orgId: string;
  subject: string;
  content: string;
  companyName: string;
  userEmail: string;
}

/** Result of requesting deletion of the account. */
export interface DeletionRequestResult {
  message: string;
}

/** A holiday entry. `branchName`/`deptName` of `null` means organisation-wide. */
export interface Holiday {
  id: number;
  name: string;
  date: DateString;
  branchName: string | null;
  deptName: string | null;
  /** When true, punching is blocked on that day. */
  blockAttendance: boolean;
}

/** Input of `addHoliday`. */
export interface HolidayInput {
  name: string;
  date: DateString;
  branchName?: string | null;
  deptName?: string | null;
  /** Defaults to `true` (v1 default). */
  blockAttendance?: boolean;
}

/** Patch of `updateHoliday`. */
export interface HolidayPatch {
  name: string;
  blockAttendance?: boolean;
  date?: DateString;
}

/** Weekly off days as Python weekday numbers (Monday = 0 … Sunday = 6). */
export type PyWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** What a penalised (repeatedly late) day counts as. */
export type AttendanceRuleConsider = 'Half Day' | 'Leave';

/** The late-arrival attendance rule. */
export interface AttendanceRule {
  /** How many late punch-ins trigger the penalty (default 3). */
  latePunchInCount: number;
  /** What the penalised day counts as (default `Half Day`). */
  considerAs: AttendanceRuleConsider;
}

/** Outcome of adding several holiday dates at once. */
export interface AddHolidaysResult {
  added: number;
  failed: { date: DateString; message: string }[];
}

