'use strict';
/** IST (UTC+05:30) helpers. The mock clock can be offset/frozen through `/__test/state { clock }`. */

const IST_MS = 330 * 60_000;
const pad = (n) => String(n).padStart(2, '0');

const clock = { offsetMs: 0 };

function now() {
  return new Date(Date.now() + clock.offsetMs);
}

function setClock(iso) {
  clock.offsetMs = iso ? new Date(iso).getTime() - Date.now() : 0;
}

/** Broken-down IST time for a Date (default: mock now). */
function ist(d = now()) {
  const x = new Date(d.getTime() + IST_MS);
  return {
    year: x.getUTCFullYear(),
    month: x.getUTCMonth() + 1,
    day: x.getUTCDate(),
    hour: x.getUTCHours(),
    minute: x.getUTCMinutes(),
    second: x.getUTCSeconds(),
    weekday: x.getUTCDay(),
    date: `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`,
    hhmm: `${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`,
    hhmmss: `${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}:${pad(x.getUTCSeconds())}`,
  };
}

const today = () => ist().date;

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}

function addDays(dateStr, n) {
  const p = parseDate(dateStr);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function weekdayOf(dateStr) {
  const p = parseDate(dateStr);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // 0 = Sunday
}

/** Python weekday (Mon = 0 … Sun = 6) used by the weekly-off endpoints. */
const pyWeekday = (dateStr) => (weekdayOf(dateStr) + 6) % 7;

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const monthPrefix = (year, month) => `${year}-${pad(month)}`;

/** 'HH:mm' -> minutes. */
function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

/** Any wire time ('09:05 AM', '09:05AM', '14:05', '14:05:30') -> 'HH:mm', or null. */
function toHHmm(v) {
  const s = String(v == null ? '' : v).trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const mer = m[3] ? m[3].toUpperCase() : null;
  if (mer) h = (h % 12) + (mer === 'PM' ? 12 : 0);
  return `${pad(h)}:${m[2]}`;
}

/** 'HH:mm' -> '09:05 AM'. */
function fmt12(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return `${pad(h % 12 === 0 ? 12 : h % 12)}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** 'HH:mm' -> '09:05AM' (shift endpoints). */
const fmtCompact12 = (hhmm) => (hhmm ? fmt12(hhmm).replace(' ', '') : null);

/** Hours between two 'HH:mm' (overnight aware), 2 decimals. */
function hoursBetween(a, b) {
  let diff = toMinutes(b) - toMinutes(a);
  if (diff < 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

const isoNow = () => now().toISOString();

module.exports = { clock, now, setClock, ist, today, parseDate, addDays, weekdayOf, pyWeekday, daysInMonth, monthPrefix, toMinutes, toHHmm, fmt12, fmtCompact12, hoursBetween, isoNow, pad };
