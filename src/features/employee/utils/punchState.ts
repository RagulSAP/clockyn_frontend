/** Punch-button / status-chip state machine of the employee home (pure, unit-tested). */
import type { IconName } from '@/components/ui';

export const MAX_SESSIONS_PER_DAY = 2;

export interface PunchStateInput {
  isFaceRegistered: boolean;
  isPunchedIn: boolean;
  punchIn?: string;
  punchOut?: string;
  punchCount: number;
}

export interface DerivedPunchState {
  /** Two sessions are done and the employee is not punched in: the button is locked. */
  isMaxSessionsReached: boolean;
  /**
   * The day's work is done for now: a punch-in and punch-out exist, or two sessions are complete. Never true while
   * punched in (v1 could report "complete" during an open second session when the API kept the first punch-out).
   * After ONE completed session the button stays active for a second punch-in.
   */
  isDone: boolean;
}

export function derivePunchState(input: PunchStateInput): DerivedPunchState {
  const isMaxSessionsReached = input.punchCount >= MAX_SESSIONS_PER_DAY && !input.isPunchedIn;
  const isDone = !input.isPunchedIn && (!!(input.punchIn && input.punchOut) || isMaxSessionsReached);
  return { isMaxSessionsReached, isDone };
}

export type StatusChipKey = 'setup' | 'complete' | 'working' | 'not-in';
export type StateTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface StatusChip {
  key: StatusChipKey;
  label: string;
  tone: StateTone;
}

/** SETUP / COMPLETE / WORKING / NOT IN. */
export function statusChip(input: PunchStateInput): StatusChip {
  if (!input.isFaceRegistered) return { key: 'setup', label: 'SETUP', tone: 'warning' };
  const { isDone } = derivePunchState(input);
  if (isDone) return { key: 'complete', label: 'COMPLETE', tone: 'success' };
  if (input.isPunchedIn) return { key: 'working', label: 'WORKING', tone: 'info' };
  return { key: 'not-in', label: 'NOT IN', tone: 'neutral' };
}

export type PunchButtonKey = 'checking' | 'setup' | 'limit' | 'punch-out' | 'punch-in';

export interface PunchButtonState {
  key: PunchButtonKey;
  label: string;
  stateLabel: string;
  icon: IconName | 'spinner';
  tone: StateTone;
  disabled: boolean;
}

/** The round punch button: first matching rule wins (`checking` overrides everything while pre-checks run). */
export function punchButtonState(input: PunchStateInput & { isChecking: boolean }): PunchButtonState {
  const { isMaxSessionsReached } = derivePunchState(input);
  if (!input.isFaceRegistered) {
    return {
      key: input.isChecking ? 'checking' : 'setup',
      label: input.isChecking ? 'CHECKING…' : 'SETUP FACE',
      stateLabel: 'Setup Required',
      icon: input.isChecking ? 'spinner' : 'camera',
      tone: 'primary',
      disabled: input.isChecking,
    };
  }
  if (input.isChecking) {
    return {
      key: 'checking',
      label: 'CHECKING…',
      stateLabel: input.isPunchedIn ? 'Currently Working' : 'Not Punched In',
      icon: 'spinner',
      tone: input.isPunchedIn ? 'danger' : 'success',
      disabled: true,
    };
  }
  if (isMaxSessionsReached) {
    return { key: 'limit', label: 'LIMIT REACHED', stateLabel: 'Max Sessions Reached', icon: 'lock', tone: 'neutral', disabled: true };
  }
  if (input.isPunchedIn) {
    return { key: 'punch-out', label: 'PUNCH OUT', stateLabel: 'Currently Working', icon: 'logout', tone: 'danger', disabled: false };
  }
  return { key: 'punch-in', label: 'PUNCH IN', stateLabel: 'Not Punched In', icon: 'scan-face', tone: 'success', disabled: false };
}

/** Field-staff location tracking: start while punched in, stop otherwise (only once today's attendance has loaded). */
export type TrackingAction = 'start' | 'stop' | 'none';

export function trackingAction(input: { isFieldStaff: boolean; hasUser: boolean; attendanceLoaded: boolean; isPunchedIn: boolean }): TrackingAction {
  if (!input.isFieldStaff || !input.hasUser || !input.attendanceLoaded) return 'none';
  return input.isPunchedIn ? 'start' : 'stop';
}

/** Request badge: how many of the employee's requests still have a pending decision. */
export interface BadgeRequest {
  type: 'leave' | 'permission' | 'shift_change' | 'device_change';
  /** Request-level status as sent by the server (`undefined` for leave requests, which only have per-date statuses). */
  status?: string;
  dateStatuses: Record<string, { status: string }>;
}

export function countPendingRequests(requests: BadgeRequest[]): number {
  return requests.filter((r) => {
    const dates = Object.values(r.dateStatuses);
    if ((r.type === 'leave' || r.type === 'permission') && dates.length > 0) return dates.some((d) => d.status === 'pending');
    return (r.status ?? '').toLowerCase() === 'pending';
  }).length;
}

/** `99+` cap of count badges. */
export function badgeLabel(count: number): string {
  return count > 99 ? '99+' : String(count);
}
