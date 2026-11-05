/**
 * Helpers of the clock-style punch-time editor. Values are 24-hour `HH:mm` strings; the grid works in 12-hour
 * hours + AM/PM (v1 mechanics).
 */
import { parseTime } from '@/lib/datetime';

export type Meridiem = 'AM' | 'PM';

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 12-hour hour (1-12) of an `HH:mm` value; an empty / invalid value reads 12. */
export function hour12Of(value: string): number {
  const t = parseTime(value);
  const h = t ? t.hour : 0;
  return h % 12 === 0 ? 12 : h % 12;
}

/** Minute (0-59) of an `HH:mm` value; 0 when empty / invalid. */
export function minuteOf(value: string): number {
  return parseTime(value)?.minute ?? 0;
}

/** AM/PM of an `HH:mm` value; an empty / invalid value is AM. */
export function meridiemOf(value: string): Meridiem {
  const t = parseTime(value);
  return t && t.hour >= 12 ? 'PM' : 'AM';
}

/** Compose `HH:mm` from a 12-hour hour, a minute and AM/PM. */
export function composeTime(hour12: number, minute: number, meridiem: Meridiem): string {
  const h24 = (hour12 % 12) + (meridiem === 'PM' ? 12 : 0);
  return `${pad2(h24)}:${pad2(minute)}`;
}

/** Display of a value in the editor header (`--:--` when empty). */
export function displayTime(value: string): string {
  const t = parseTime(value);
  if (!t) return '--:--';
  return `${pad2(hour12Of(value))}:${pad2(t.minute)} ${meridiemOf(value)}`;
}

export interface PunchEditValidation {
  ok: boolean;
  message?: string;
}

/**
 * At least one time is required. A punch-out earlier than the punch-in is allowed on purpose: the server treats it as
 * the next day (overnight shifts).
 */
export function validatePunchEdit(punchIn: string, punchOut: string): PunchEditValidation {
  if (!punchIn && !punchOut) return { ok: false, message: 'Select a punch-in or punch-out time' };
  return { ok: true };
}
