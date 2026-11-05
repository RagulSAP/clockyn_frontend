/**
 * Number / currency / phone / name formatting and safe numeric parsing.
 * Standard locale is en-IN (lakh/crore grouping) implemented by hand so output is identical on every engine.
 */

export type NumericInput = number | string | null | undefined;

/** Lenient numeric conversion: strips grouping commas / currency symbols / spaces. Returns `null` when not a finite number. */
export function toNumber(value: NumericInput): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[₹,\s]/g, '');
  if (cleaned === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Group the integer digits Indian style: 1234567 -> '12,34,567'. */
function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  const rest = intDigits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

export interface FormatNumberOptions {
  /** Fixed number of decimals. When omitted: up to 2 decimals, trailing zeros trimmed (integers show none). */
  decimals?: number;
  /** Text returned for null / NaN / non-numeric input. Default '0'. */
  fallback?: string;
}

/** 1234567.5 -> '12,34,567.5'. */
export function formatNumber(value: NumericInput, opts: FormatNumberOptions = {}): string {
  const n = toNumber(value);
  if (n === null) return opts.fallback ?? '0';
  const negative = n < 0;
  const abs = Math.abs(n);
  let fixed: string;
  if (opts.decimals !== undefined) {
    fixed = abs.toFixed(Math.max(0, Math.min(8, opts.decimals)));
  } else {
    fixed = abs.toFixed(2);
    fixed = fixed.replace(/\.?0+$/, '');
  }
  const [int, frac] = fixed.split('.');
  const body = groupIndian(int) + (frac ? `.${frac}` : '');
  const isZero = Number(fixed) === 0;
  return negative && !isZero ? `-${body}` : body;
}

export interface FormatINROptions extends FormatNumberOptions {
  /** Currency symbol, default '₹'. */
  symbol?: string;
}

/** 123456 -> '₹1,23,456'; 1234.5 -> '₹1,234.5'; `{ decimals: 2 }` -> '₹1,234.50'; -50 -> '-₹50'. */
export function formatINR(value: NumericInput, opts: FormatINROptions = {}): string {
  const symbol = opts.symbol ?? '₹';
  const n = toNumber(value);
  if (n === null) return opts.fallback ?? `${symbol}0`;
  const body = formatNumber(Math.abs(n), { decimals: opts.decimals });
  const isZero = Number(body.replace(/,/g, '')) === 0;
  return n < 0 && !isZero ? `-${symbol}${body}` : `${symbol}${body}`;
}

// ─── money / number input validation ────────────────────────────────────────────────────────

export interface ParseMoneyOptions {
  /** Accept 0 (default false: "rates / advances must be greater than zero"). */
  allowZero?: boolean;
  /** Maximum decimals accepted (default 2). Extra digits => rejected. */
  maxDecimals?: number;
  /** Inclusive upper bound. */
  max?: number;
  /** Inclusive lower bound (default: > 0, or >= 0 with allowZero). */
  min?: number;
}

/**
 * Parse user-entered money. Returns a finite, non-negative number or `null` (empty, NaN, negative, zero unless
 * `allowZero`, too many decimals, out of bounds). Accepts '1,500.50' and '₹1500'.
 */
export function parseMoney(input: NumericInput, opts: ParseMoneyOptions = {}): number | null {
  const n = toNumber(input);
  if (n === null || n < 0) return null;
  if (n === 0 && !opts.allowZero) return null;
  if (typeof input === 'string') {
    const frac = input.replace(/[₹,\s]/g, '').split('.')[1];
    if (frac !== undefined && frac.length > (opts.maxDecimals ?? 2)) return null;
  } else if (typeof input === 'number') {
    const scaled = n * 10 ** (opts.maxDecimals ?? 2);
    if (Math.abs(scaled - Math.round(scaled)) > 1e-6) return null;
  }
  if (opts.min !== undefined && n < opts.min) return null;
  if (opts.max !== undefined && n > opts.max) return null;
  return n;
}

/** Same rules as `parseMoney` but returns a user-facing error message (or `null` when valid). */
export function validateMoney(input: NumericInput, label = 'Amount', opts: ParseMoneyOptions = {}): string | null {
  const raw = typeof input === 'string' ? input.trim() : input;
  if (raw === '' || raw === null || raw === undefined) return `${label} is required`;
  const n = toNumber(raw);
  if (n === null) return `${label} must be a number`;
  if (n < 0) return `${label} cannot be negative`;
  if (n === 0 && !opts.allowZero) return `${label} must be greater than zero`;
  if (parseMoney(raw, opts) === null) {
    if (opts.max !== undefined && n > opts.max) return `${label} cannot exceed ${formatNumber(opts.max)}`;
    if (opts.min !== undefined && n < opts.min) return `${label} must be at least ${formatNumber(opts.min)}`;
    return `${label} can have at most ${opts.maxDecimals ?? 2} decimal places`;
  }
  return null;
}

/** Integer parse that rejects NaN / decimals / negatives (unless allowed). `null` when invalid. */
export function parseIntSafe(input: NumericInput, opts: { min?: number; max?: number; allowNegative?: boolean } = {}): number | null {
  const n = toNumber(input);
  if (n === null || !Number.isInteger(n)) return null;
  if (n < 0 && !opts.allowNegative) return null;
  if (opts.min !== undefined && n < opts.min) return null;
  if (opts.max !== undefined && n > opts.max) return null;
  return n;
}

/** Number or fallback (never NaN). */
export function numberOr(value: NumericInput, fallback = 0): number {
  const n = toNumber(value);
  return n === null ? fallback : n;
}

/** Round to `decimals` places, avoiding binary float artefacts (1.005 -> 1.01). */
export function roundTo(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * f) / f;
}

// ─── text ───────────────────────────────────────────────────────────────────────────────────

export const digitsOnly = (s: string | null | undefined): string => (s ?? '').replace(/\D/g, '');

/** Strip +91 / 0 prefixes, spaces and punctuation; returns the 10-digit national number if present. */
export function normalizeMobile(s: string | null | undefined): string {
  let d = digitsOnly(s);
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

/** Login ids are exactly 10 digits (v1 rule). */
export const isValidMobile = (s: string | null | undefined): boolean => /^\d{10}$/.test((s ?? '').trim());

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isValidEmail = (s: string | null | undefined): boolean => EMAIL_RE.test((s ?? '').trim());

/** '9876543210' -> '98******10' (first 2 and last 2 digits visible). Short inputs are fully masked. */
export function maskPhone(phone: string | null | undefined): string {
  const d = normalizeMobile(phone);
  if (d.length === 0) return '';
  if (d.length <= 4) return '*'.repeat(d.length);
  return `${d.slice(0, 2)}${'*'.repeat(d.length - 4)}${d.slice(-2)}`;
}

/** '9876543210' -> '98765 43210' (10-digit numbers only; otherwise returned as typed). */
export function formatPhone(phone: string | null | undefined): string {
  const d = normalizeMobile(phone);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : (phone ?? '').trim();
}

/** 'Ravi Kumar' -> 'RK'; 'madonna' -> 'M'; '' -> '?'. */
export function initials(name: string | null | undefined, max = 2): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.map((p) => Array.from(p)[0]?.toUpperCase() ?? '').filter(Boolean);
  return letters.slice(0, Math.max(1, max)).join('');
}

/** Word only: pluralWord(2, 'day') -> 'days'. */
export function pluralWord(count: number, singular: string, plural?: string): string {
  return Math.abs(count) === 1 ? singular : (plural ?? `${singular}s`);
}

/** Count + word: pluralize(1, 'day') -> '1 day', pluralize(3, 'day') -> '3 days', pluralize(2, 'person', 'people') -> '2 people'. */
export function pluralize(count: number, singular: string, plural?: string): string {
  return `${formatNumber(count)} ${pluralWord(count, singular, plural)}`;
}

/** Title-case a snake/kebab/space separated label: 'shift_change' -> 'Shift Change'. */
export function titleCase(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Truncate with an ellipsis. */
export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

// ─── durations ──────────────────────────────────────────────────────────────────────────────

export interface FormatDurationOptions {
  /** Text for a zero / invalid duration. Default '—'. */
  zero?: string;
}

/** (h, m) -> '1h 5m' | '2h' | '30m' | '—'. Minutes >= 60 are normalised into hours. */
export function formatDuration(hours: number, minutes = 0, opts: FormatDurationOptions = {}): string {
  const total = Math.round((Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0));
  return formatDurationMinutes(total, opts);
}

/** Total minutes -> '1h 5m' | '2h' | '30m' | '—'. */
export function formatDurationMinutes(totalMinutes: number, opts: FormatDurationOptions = {}): string {
  const total = Math.round(Number.isFinite(totalMinutes) ? totalMinutes : 0);
  if (total <= 0) return opts.zero ?? '—';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Decimal hours (8.5 or '8.5') -> { hours: 8, minutes: 30 }. */
export function decimalHoursToHM(value: NumericInput): { hours: number; minutes: number } {
  const n = toNumber(value);
  if (n === null || n <= 0) return { hours: 0, minutes: 0 };
  const total = Math.round(n * 60);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** Decimal hours -> 'HH:MM' ('8.5' -> '08:30'); values already containing ':' pass through. */
export function formatClockHours(value: NumericInput): string {
  if (typeof value === 'string' && value.includes(':')) return value;
  const { hours, minutes } = decimalHoursToHM(value);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Total minutes -> 'H:MM hrs' (home screen remaining / worked time). */
export function formatHoursMinutesLabel(totalMinutes: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(totalMinutes) ? totalMinutes : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} hrs`;
}

/** Bytes -> '1.2 MB'. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
