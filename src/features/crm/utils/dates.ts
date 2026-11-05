/** Date-filter helpers shared by the hub and the assign list. All business dates are IST (`@/lib/datetime`). */
import { addDaysStr, formatDate, parseDateParts, toDateStr, todayIST } from '@/lib/datetime';
import type { CarryForwardRequest, Lead } from '@/types/api/leads';

import type { CfrDateFilterKey } from '../types';

/**
 * The day a filter chip stands for. `custom` without a date returns '' (v1: no date filtering at all) and `all`
 * returns '' as well.
 */
export function resolveFilterDate(filter: CfrDateFilterKey, customDate: string, today: string = todayIST()): string {
  switch (filter) {
    case 'today':
      return today;
    case 'tomorrow':
      return addDaysStr(today, 1);
    case 'yesterday':
      return addDaysStr(today, -1);
    case 'custom':
      return customDate;
    default:
      return '';
  }
}

/**
 * A lead belongs to a day when its required date equals it, or - when it has no required date - its creation day
 * does (`Lead.effectiveDate`). An empty `selected` matches everything.
 */
export function matchesLeadDate(lead: Pick<Lead, 'effectiveDate'>, selected: string): boolean {
  return selected === '' || lead.effectiveDate === selected;
}

/** Carry-forward requests are filtered by the day they were SUBMITTED (not by the requested-for date), like v1. */
export function matchesSubmittedDate(request: Pick<CarryForwardRequest, 'createdAt'>, selected: string): boolean {
  return selected === '' || toDateStr(request.createdAt) === selected;
}

/** Chip label of a picked custom date: `dd/MM`. */
export function customChipLabel(customDate: string): string {
  const p = parseDateParts(customDate);
  return p ? formatDate(customDate, 'dd/MM') : 'Pick Date';
}

/** `05 Mar 2026`, or the fallback for missing / invalid dates. */
export function displayDate(value: string | null | undefined, fallback = 'N/A'): string {
  const out = formatDate(value ?? '');
  return out === '--' ? fallback : out;
}
