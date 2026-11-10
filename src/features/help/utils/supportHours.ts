import { IST_OFFSET_MS, toISTParts, WEEKDAY_NAMES } from '@/lib/datetime';
import type { ChatItem } from '@/features/chat/types';

/**
 * When the Clockyn support team answers Live Chat, and how long a reply normally takes. India time (no daylight saving),
 * Monday to Friday. Public holidays are not modelled: the team simply answers late on those days.
 */
export const SUPPORT_OPEN_HOUR = 10; // 10:00
export const SUPPORT_CLOSE_HOUR = 18; // 18:00
export const SUPPORT_WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5]; // Monday..Friday (Date weekday numbers)
export const REPLY_TARGET_MINUTES = 5;

export const SUPPORT_HOURS_LABEL = 'Mon – Fri, 10 AM – 6 PM IST';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
export const REPLY_TARGET_MS = REPLY_TARGET_MINUTES * MINUTE;
/** The scan of working time stops after this many days (a conversation left for a month is simply "waiting"). */
const MAX_SCAN_DAYS = 31;

const OPEN_MINUTES = SUPPORT_OPEN_HOUR * 60;
const CLOSE_MINUTES = SUPPORT_CLOSE_HOUR * 60;

/** True while the support team is at work (Mon–Fri, 10:00 to 18:00 India time). */
export function isSupportOpen(now: number = Date.now()): boolean {
  const p = toISTParts(now);
  return SUPPORT_WEEKDAYS.includes(p.weekday) && p.minutes >= OPEN_MINUTES && p.minutes < CLOSE_MINUTES;
}

/** "today at 10 AM", "tomorrow at 10 AM" or "Monday at 10 AM": when the team is next in, for a closed moment. */
export function nextOpeningLabel(now: number = Date.now()): string {
  const p = toISTParts(now);
  if (SUPPORT_WEEKDAYS.includes(p.weekday) && p.minutes < OPEN_MINUTES) return `today at ${SUPPORT_OPEN_HOUR} AM`;
  for (let i = 1; i <= 7; i++) {
    const day = (p.weekday + i) % 7;
    if (SUPPORT_WEEKDAYS.includes(day)) return i === 1 ? `tomorrow at ${SUPPORT_OPEN_HOUR} AM` : `${WEEKDAY_NAMES[day]} at ${SUPPORT_OPEN_HOUR} AM`;
  }
  return `Monday at ${SUPPORT_OPEN_HOUR} AM`;
}

/** Working time (ms) between two instants: only the Mon–Fri 10:00–18:00 India-time windows count. */
export function supportMsBetween(from: number, to: number): number {
  if (!(to > from)) return 0;
  let total = 0;
  let dayStart = Math.floor((from + IST_OFFSET_MS) / DAY) * DAY - IST_OFFSET_MS; // India midnight of the first day
  for (let i = 0; i < MAX_SCAN_DAYS && dayStart < to; i++, dayStart += DAY) {
    const weekday = new Date(dayStart + IST_OFFSET_MS).getUTCDay();
    if (!SUPPORT_WEEKDAYS.includes(weekday)) continue;
    const open = dayStart + SUPPORT_OPEN_HOUR * 60 * MINUTE;
    const close = dayStart + SUPPORT_CLOSE_HOUR * 60 * MINUTE;
    total += Math.max(0, Math.min(to, close) - Math.max(from, open));
  }
  return total;
}

export type DelayNoticeItem = Pick<ChatItem, 'id' | 'fromMe' | 'ts' | 'state'>;

/**
 * The message the team has not answered within the promised time: the LAST message is the organisation's own, delivered,
 * and at least REPLY_TARGET_MINUTES of working time have passed while the team is in. Null otherwise (a reply, a failed or
 * still-sending message, a team that is off for the day, or a message that is still within the five minutes).
 */
export function delayedMessage(items: readonly DelayNoticeItem[], now: number = Date.now()): { id: string } | null {
  const last = items[items.length - 1];
  if (!last || !last.fromMe || last.state !== 'sent' || !Number.isFinite(last.ts)) return null;
  if (!isSupportOpen(now)) return null;
  return supportMsBetween(last.ts, now) >= REPLY_TARGET_MS ? { id: last.id } : null;
}
