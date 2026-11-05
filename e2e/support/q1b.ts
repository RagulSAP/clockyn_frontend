/**
 * Q1b helpers (billing / settings): plan catalogues for the pricing worked examples, date helpers that mirror the app's
 * `dd MMM yyyy` format and a few mock readers. Imported directly by `q1b-*.spec.ts`.
 */
import type { MockClient } from './mock';
import { mockGet } from './q1';

export interface PlanRow {
  plan_id: number;
  plan_name: string;
  plan_amount: number;
  plan_month: number;
}

/**
 * Catalogue of the pricing worked examples (spec upgrade_plan §7.10 / payment_summary §7). Ids 1/2/3 are the ids the mock maps
 * to its `core` / `prime` / `elite` plan states, so `mock.setPlan('core')` means "Core 6 months @ INR 25 per staff".
 */
export const WORKED_CATALOGUE: PlanRow[] = [
  { plan_id: 1, plan_name: 'Core', plan_amount: 25, plan_month: 6 },
  { plan_id: 2, plan_name: 'Prime', plan_amount: 40, plan_month: 12 },
  { plan_id: 3, plan_name: 'Elite', plan_amount: 60, plan_month: 12 },
];

/** Full 3 x 3 catalogue: core 11/1/12, prime 21/2/22, elite 31/32/3 (1 / 6 / 12 months). `prime` state = Prime 6 months. */
export const FULL_CATALOGUE: PlanRow[] = [
  { plan_id: 11, plan_name: 'Core', plan_amount: 30, plan_month: 1 },
  { plan_id: 1, plan_name: 'Core', plan_amount: 25, plan_month: 6 },
  { plan_id: 12, plan_name: 'Core', plan_amount: 20, plan_month: 12 },
  { plan_id: 21, plan_name: 'Prime', plan_amount: 50, plan_month: 1 },
  { plan_id: 2, plan_name: 'Prime', plan_amount: 45, plan_month: 6 },
  { plan_id: 22, plan_name: 'Prime', plan_amount: 40, plan_month: 12 },
  { plan_id: 31, plan_name: 'Elite', plan_amount: 80, plan_month: 1 },
  { plan_id: 32, plan_name: 'Elite', plan_amount: 70, plan_month: 6 },
  { plan_id: 3, plan_name: 'Elite', plan_amount: 60, plan_month: 12 },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-10-05` -> `05 Oct 2026` (the app's default date format). */
export function fmtDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '--';
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Calendar-month addition that clamps month ends (31 Jan + 1 month = 28/29 Feb), like the app. */
export function addMonths(iso: string, months: number): string {
  const [y, mo, d] = iso.split('-').map(Number);
  const total = y * 12 + (mo - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(d, last))}`;
}

/** The same day-of-month `months` calendar months from `iso`, but pinned to the 15th so the month difference is exact. */
export function monthsAheadOn15th(iso: string, months: number): string {
  const [y, mo] = iso.split('-').map(Number);
  const total = y * 12 + (mo - 1) + months;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-15`;
}

/** The mock's "today" (IST date). */
export async function mockToday(mock: MockClient): Promise<string> {
  return (await mock.state()).today as string;
}

/** What the overview shows as "Used Staff": every manager / staff user of the organisation (active or not). */
export async function usedStaffOf(mock: MockClient): Promise<number> {
  const rows = await mockGet<unknown[]>(mock.tenant, '/home/all-staff?user_id=adm-0001');
  return rows.length;
}
