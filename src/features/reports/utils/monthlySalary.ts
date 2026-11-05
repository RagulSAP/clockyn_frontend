/** Monthly salary ("mark as paid") list model: merging the server sources, selection and totals. */
import type { MonthlySalaryEntry, StaffSalaryBreakdown } from '@/types/api/salaryReports';
import type { StaffMember } from '@/types/api/staff';

export interface PayRow {
  userId: string;
  name: string;
  empId: string;
  dept: string;
  photoUrl?: string;
  isActive: boolean;
  /** Net salary of the month, `null` when no source could provide it. */
  net: number | null;
  /** Paid state reported by the server (`false` when the server list is unavailable). */
  serverPaid: boolean;
}

/** Result of loading the sheet for one month. */
export interface PaySheet {
  rows: PayRow[];
  /** True when the paid state comes from `GET /salary/monthly-list` (survives reopening the screen). */
  paidFromServer: boolean;
  /** True when net amounts are available for the totals. */
  amountsAvailable: boolean;
}

/** First occurrence of each user id wins (v1 rendered a de-duplicated list but counted the raw one). */
export function dedupeByUserId<T extends { userId: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.userId)) continue;
    seen.add(item.userId);
    out.push(item);
  }
  return out;
}

/** Rows from the server's monthly list (paid state + amounts included). */
export function rowsFromMonthlyList(list: readonly MonthlySalaryEntry[]): PayRow[] {
  return dedupeByUserId(list).map((e) => ({
    userId: e.userId,
    name: e.name,
    empId: e.empId,
    dept: e.deptName,
    isActive: true,
    net: e.netSalary,
    serverPaid: e.paid,
  }));
}

/**
 * Fallback rows: the staff list (every role 2/3 user, inactive included — v1 behaviour) with net salaries taken from the
 * salary breakdown when it loaded. Paid state is then local to the session.
 */
export function rowsFromStaff(staff: readonly StaffMember[], breakdown: readonly StaffSalaryBreakdown[] | null): PayRow[] {
  const net = new Map<string, number>();
  for (const b of breakdown ?? []) net.set(b.userId, b.netSalary);
  return dedupeByUserId(staff).map((s) => ({
    userId: s.userId,
    name: s.name,
    empId: s.empId,
    dept: s.department,
    photoUrl: s.photoUrl,
    isActive: s.isActive,
    net: breakdown ? (net.get(s.userId) ?? null) : null,
    serverPaid: false,
  }));
}

/** Effective paid flag: the server's, or marked paid in this session. */
export function isPaid(row: PayRow, localPaid: ReadonlySet<string>): boolean {
  return row.serverPaid || localPaid.has(row.userId);
}

export interface PayTotals {
  total: number;
  paid: number;
  unpaid: number;
  paidPct: number;
  /** Σ net of all rows, `null` when amounts are unavailable. */
  totalAmount: number | null;
  /** Σ net of unpaid rows, `null` when amounts are unavailable. */
  unpaidAmount: number | null;
}

/** Counts/percent over the de-duplicated rows; amounts are summed only when computable (rows with a net figure). */
export function computePayTotals(rows: readonly PayRow[], localPaid: ReadonlySet<string>, amountsAvailable: boolean): PayTotals {
  const total = rows.length;
  const paid = rows.filter((r) => isPaid(r, localPaid)).length;
  const sum = (list: readonly PayRow[]) => list.reduce((s, r) => s + (r.net ?? 0), 0);
  return {
    total,
    paid,
    unpaid: total - paid,
    paidPct: total === 0 ? 0 : Math.round((paid / total) * 100),
    totalAmount: amountsAvailable ? sum(rows) : null,
    unpaidAmount: amountsAvailable ? sum(rows.filter((r) => !isPaid(r, localPaid))) : null,
  };
}

/** Ids of every unpaid row, in list order (the "Pay All" payload — never contains duplicates or paid ids). */
export function unpaidIds(rows: readonly PayRow[], localPaid: ReadonlySet<string>): string[] {
  return rows.filter((r) => !isPaid(r, localPaid)).map((r) => r.userId);
}

/** Keeps only selected ids that are still unpaid (a row paid via its own button leaves the selection). */
export function pruneSelection(selected: ReadonlySet<string>, rows: readonly PayRow[], localPaid: ReadonlySet<string>): Set<string> {
  const unpaid = new Set(unpaidIds(rows, localPaid));
  return new Set([...selected].filter((id) => unpaid.has(id)));
}

/** True when every unpaid row is selected (and there is at least one). */
export function allUnpaidSelected(rows: readonly PayRow[], localPaid: ReadonlySet<string>, selected: ReadonlySet<string>): boolean {
  const unpaid = unpaidIds(rows, localPaid);
  return unpaid.length > 0 && unpaid.every((id) => selected.has(id));
}
