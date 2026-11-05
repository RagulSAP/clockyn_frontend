/**
 * Odometer allowance maths and the per-km rate input rules (pure, unit tested).
 *
 * Amount = distance x CURRENT org rate (derived on every render, so a rate change re-prices every row, as in v1).
 * The backend stores the rate as an INTEGER number of rupees per km, so the editor accepts / rounds to whole rupees.
 */
import { roundTo } from '@/lib/format';
import type { OdometerReading } from '@/types/api/expenses';

/** Shown until the server returns a rate (v1 default). */
export const DEFAULT_RATE_PER_KM = 3;

/**
 * Distance of a reading in km: the server's `distance_km` when it is a positive number, else stop - start when both
 * are known and stop >= start, else 0. A start of 0 km is a valid reading (v1 treated it as missing).
 */
export function readingDistance(r: Pick<OdometerReading, 'distanceKm' | 'startKm' | 'stopKm'>): number {
  if (r.distanceKm !== undefined && Number.isFinite(r.distanceKm) && r.distanceKm > 0) return r.distanceKm;
  if (r.startKm !== undefined && r.stopKm !== undefined && r.stopKm >= r.startKm) return r.stopKm - r.startKm;
  return 0;
}

/** Allowance in INR, rounded to paise. */
export function readingAmount(r: Pick<OdometerReading, 'distanceKm' | 'startKm' | 'stopKm'>, ratePerKm: number): number {
  return roundTo(readingDistance(r) * ratePerKm, 2);
}

/** Rate shown in the UI: the server rate when positive, else the default. */
export function effectiveRate(serverRate: number | undefined | null): number {
  return serverRate !== undefined && serverRate !== null && Number.isFinite(serverRate) && serverRate > 0 ? serverRate : DEFAULT_RATE_PER_KM;
}

export type RateParse = { ok: true; value: number; rounded: boolean } | { ok: false; error: string };

export const INVALID_RATE_MESSAGE = 'Please enter a valid rate';

/** Validates the rate editor input: numeric and > 0; decimals are rounded to whole rupees (the backend takes an int). */
export function parseRate(input: string): RateParse {
  const trimmed = input.trim();
  if (trimmed === '' || !/^\d*\.?\d+$|^\d+\.$/.test(trimmed)) return { ok: false, error: INVALID_RATE_MESSAGE };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { ok: false, error: INVALID_RATE_MESSAGE };
  const value = Math.round(n);
  if (value < 1) return { ok: false, error: INVALID_RATE_MESSAGE };
  return { ok: true, value, rounded: value !== n };
}

export const formatKm = (km: number, decimals = 2): string => `${km.toFixed(decimals)} km`;
