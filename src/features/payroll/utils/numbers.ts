import { parseIntSafe, toNumber } from '@/lib/format';

/** Strict number parse of a typed value ("12abc" is NOT 12 as in v1): `null` when blank or not a number. */
export function parseNumberInput(raw: string): number | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : toNumber(trimmed);
}

/** Number greater than zero, or `null`. */
export function parsePositive(raw: string): number | null {
  const n = parseNumberInput(raw);
  return n !== null && n > 0 ? n : null;
}

/** Whole number greater than zero (decimals are rejected, not truncated), or `null`. */
export function parsePositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : parseIntSafe(trimmed, { min: 1 });
}

/** Live (per keystroke) message for a typed amount: only a non-empty invalid value is flagged. */
export function liveAmountError(raw: string, message = 'Amount must be a valid number'): string {
  return raw.trim() !== '' && parsePositive(raw) === null ? message : '';
}

/** Live message for a typed whole-number field (count fields): decimals are flagged as soon as they are typed, as the save would reject them. */
export function liveWholeNumberError(raw: string, message = 'Must be a valid number'): string {
  return raw.trim() !== '' && parsePositiveInt(raw) === null ? message : '';
}
