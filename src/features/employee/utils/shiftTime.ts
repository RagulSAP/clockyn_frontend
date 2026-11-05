/**
 * Shift / working-hours maths of the employee home (pure, unit-tested).
 *
 * All times are IST wall-clock strings (`HH:mm`, `HH:mm:ss` or 12 h). "Now" is the IST second of the day.
 * Differences from v1 (fixes):
 *  - a session that crosses midnight keeps its real length (v1 clamped it to 0);
 *  - the shift length uses `shiftSpanMinutes` everywhere, so a `00:00` shift end is handled consistently;
 *  - a tiny negative open-session duration (device clock slightly behind the server) is treated as 0, not 24 h.
 */
import { shiftSpanMinutes, timeToMinutes, toISTParts } from '@/lib/datetime';
import type { PunchSession } from '@/types/api/attendance';

export const SECONDS_PER_DAY = 86_400;
/** An open session may appear to start "in the future" when the device clock lags the server by a little. */
export const CLOCK_SKEW_TOLERANCE_S = 300;

/** Seconds since IST midnight of an instant. */
export function istSecondsOfDay(now: Date | number): number {
  const p = toISTParts(now);
  return p.hour * 3600 + p.minute * 60 + p.second;
}

/** Time-of-day string -> seconds since midnight (`null` when empty / invalid). */
export function timeOfDaySeconds(value: string | null | undefined): number | null {
  const m = timeToMinutes(value);
  return m === null ? null : Math.round(m * 60);
}

export interface WorkedInput {
  /** First punch-in of the day (used only when `sessions` is empty). */
  punchIn?: string;
  /** Last punch-out of the day (used only when `sessions` is empty). */
  punchOut?: string;
  sessions: Pick<PunchSession, 'punchIn' | 'punchOut'>[];
  isPunchedIn: boolean;
  /** IST seconds since midnight right now. */
  nowS: number;
}

/** Worked seconds of one session. `open` = no punch-out yet and the employee is still punched in. */
export function sessionSeconds(punchIn: string | undefined, punchOut: string | undefined, isPunchedIn: boolean, nowS: number): number {
  const inS = timeOfDaySeconds(punchIn);
  if (inS === null) return 0;
  const outRaw = timeOfDaySeconds(punchOut);
  const open = outRaw === null;
  if (open && !isPunchedIn) return 0; // an unclosed session of someone who is not punched in counts nothing (v1)
  let outS = open ? nowS : outRaw;
  if (outS < inS) {
    // Crossing midnight (the server stores an earlier punch-out as the next day). Only an open session can be
    // "negative" because of clock skew.
    outS = open && inS - outS <= CLOCK_SKEW_TOLERANCE_S ? inS : outS + SECONDS_PER_DAY;
  }
  return Math.min(Math.max(0, outS - inS), SECONDS_PER_DAY);
}

/** Σ worked seconds over today's sessions (or the single first-in / last-out pair when there are none). */
export function workedSeconds(input: WorkedInput): number {
  const { sessions, isPunchedIn, nowS } = input;
  if (sessions.length > 0) {
    return sessions.reduce((sum, s) => sum + sessionSeconds(s.punchIn, s.punchOut, isPunchedIn && !s.punchOut, nowS), 0);
  }
  if (!input.punchIn) return 0;
  return sessionSeconds(input.punchIn, input.punchOut, isPunchedIn, nowS);
}

export interface Clock {
  hh: string;
  mm: string;
  ss: string;
}

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Seconds -> zero-padded clock parts (hours may exceed two digits). */
export function toClock(totalSeconds: number): Clock {
  const s = Math.floor(Math.abs(totalSeconds));
  return { hh: pad(Math.floor(s / 3600)), mm: pad(Math.floor((s % 3600) / 60)), ss: pad(s % 60) };
}

export const EMPTY_CLOCK: Clock = { hh: '--', mm: '--', ss: '--' };

export type RemainState = 'idle' | 'working' | 'overtime' | 'done';

export interface RemainResult extends Clock {
  state: RemainState;
  /** `done` and the clock reads 00:00:00. */
  shiftComplete: boolean;
}

export interface RemainInput {
  nowS: number;
  punchIn?: string;
  punchOut?: string;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  isDone: boolean;
  isPunchedIn: boolean;
  sessions: Pick<PunchSession, 'punchIn' | 'punchOut'>[];
}

/** Length of the assigned shift in seconds; `null` when the shift is missing / invalid / zero-length. */
export function shiftTotalSeconds(shiftStart?: string | null, shiftEnd?: string | null): number | null {
  if (!shiftStart || !shiftEnd) return null;
  const span = shiftSpanMinutes(shiftStart, shiftEnd);
  return span === null || span <= 0 ? null : Math.round(span * 60);
}

/** Remaining-time / overtime state machine of the RemainCard. */
export function calcRemaining(input: RemainInput): RemainResult {
  const totalS = shiftTotalSeconds(input.shiftStart, input.shiftEnd);
  if (totalS === null) return { state: 'idle', ...EMPTY_CLOCK, shiftComplete: false };
  const hasPunch = !!input.punchIn || input.sessions.some((s) => !!s.punchIn);
  if (!hasPunch) return { state: 'idle', ...toClock(totalS), shiftComplete: false };

  const worked = workedSeconds({
    punchIn: input.punchIn,
    punchOut: input.punchOut,
    sessions: input.sessions,
    isPunchedIn: input.isPunchedIn,
    nowS: input.nowS,
  });
  const remain = totalS - worked;
  if (input.isDone) {
    const clock = toClock(Math.max(remain, 0));
    return { state: 'done', ...clock, shiftComplete: clock.hh === '00' && clock.mm === '00' && clock.ss === '00' };
  }
  if (remain > 0) return { state: 'working', ...toClock(remain), shiftComplete: false };
  return { state: 'overtime', ...toClock(Math.abs(remain)), shiftComplete: false };
}

/** `8:05 hrs` (negative / NaN -> 0). */
export function fmtMins(minutes: number): string {
  const safe = Number.isNaN(minutes) || minutes < 0 ? 0 : Math.floor(minutes);
  return `${Math.floor(safe / 60)}:${pad(safe % 60)} hrs`;
}

export interface WorkingHours {
  /** `h:mm hrs` worked, or `--` before the first punch-in. */
  label: string;
  /** `h:mm hrs` of the shift, or `--` without a valid shift. */
  totalLabel: string;
  /** 0..1 */
  pct: number;
}

export interface WorkingHoursInput {
  punchIn?: string;
  punchOut?: string;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  isPunchedIn: boolean;
  sessions: Pick<PunchSession, 'punchIn' | 'punchOut'>[];
  nowS: number;
}

/** Data of the WorkHoursCard. */
export function calcWorkingHours(input: WorkingHoursInput): WorkingHours {
  const totalS = shiftTotalSeconds(input.shiftStart, input.shiftEnd);
  const totalLabel = totalS === null ? '--' : fmtMins(Math.floor(totalS / 60));
  const hasPunch = !!input.punchIn || input.sessions.some((s) => !!s.punchIn);
  if (!hasPunch) return { label: '--', totalLabel, pct: 0 };
  const worked = workedSeconds({
    punchIn: input.punchIn,
    punchOut: input.punchOut,
    sessions: input.sessions,
    isPunchedIn: input.isPunchedIn,
    nowS: input.nowS,
  });
  const pct = totalS !== null && totalS > 0 ? Math.min(worked / totalS, 1) : 0;
  return { label: fmtMins(Math.floor(worked / 60)), totalLabel, pct };
}

export type ProgressTone = 'warning' | 'info' | 'success';

/** Working-hours bar colour: amber < 50 %, blue >= 50 %, green at 100 %. */
export function progressTone(pct: number): ProgressTone {
  return pct >= 1 ? 'success' : pct >= 0.5 ? 'info' : 'warning';
}

export interface RemainDisplay {
  title: string;
  label: string;
  tone: 'neutral' | 'info' | 'warning' | 'success';
  /** Prefix of the clock (`+` for overtime). */
  prefix: string;
}

/** Texts / colour semantics of the RemainCard (verbatim v1 copy). */
export function remainDisplay(r: RemainResult): RemainDisplay {
  if (r.shiftComplete) return { title: 'SHIFT COMPLETE', label: 'Shift Complete', tone: 'success', prefix: '' };
  switch (r.state) {
    case 'idle':
      return { title: 'SHIFT DURATION', label: 'Total Shift Time', tone: 'neutral', prefix: '' };
    case 'working':
      return { title: 'REMAINING TIME', label: 'Time Remaining', tone: 'info', prefix: '' };
    case 'overtime':
      return { title: 'OVERTIME', label: 'Overtime', tone: 'warning', prefix: '+' };
    default:
      return { title: 'SHIFT DURATION', label: 'Time Remaining', tone: 'success', prefix: '' };
  }
}
