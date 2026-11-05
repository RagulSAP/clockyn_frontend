/**
 * Pure logic of the staff roster: route-filter normalisation, merging role/active info into live-status lists,
 * chip counts and the search / role / department / branch filters. No React, no network.
 */
import type { StaffStatusFilter } from '@/types/api/home';
import type { StaffLiveStatus, StaffMember } from '@/types/api/staff';

export type RosterFilter = 'total' | 'late' | 'punched_in' | 'working' | 'punched_out' | 'absent';
export type RoleChip = 'all' | 'staff' | 'manager' | 'inactive';

/**
 * Accepted `filter` route-param values. The department tiles of the dashboard emit `punch_in` / `punch_out`
 * (v1 did not recognise them and fell back to the whole roster) — they are aliases here.
 */
const FILTER_ALIASES: Record<string, RosterFilter> = {
  total: 'total',
  all: 'total',
  late: 'late',
  late_punched_in: 'late',
  punched_in: 'punched_in',
  punch_in: 'punched_in',
  working: 'working',
  punched_out: 'punched_out',
  punch_out: 'punched_out',
  absent: 'absent',
};

export function normalizeRosterFilter(raw: string | null | undefined): RosterFilter {
  const key = (raw ?? '').trim().toLowerCase();
  return FILTER_ALIASES[key] ?? 'total';
}

/** Header subtitle per filter (v1 copy). */
export const FILTER_TITLES: Record<RosterFilter, string> = {
  total: 'All Staff',
  absent: 'Absent Staff',
  late: 'Late Punched-In',
  punched_in: 'Punched-In',
  working: 'Working Staff',
  punched_out: 'Punched Out',
};

/** The live-status endpoint behind a filter (`null` for the whole roster). */
export function liveStatusFor(filter: RosterFilter): StaffStatusFilter | null {
  switch (filter) {
    case 'late':
      return 'late_punched_in';
    case 'punched_in':
    case 'working':
    case 'punched_out':
    case 'absent':
      return filter;
    default:
      return null;
  }
}

export interface RosterBanner {
  title: string;
  subtitle: string;
  tone: 'danger' | 'warning';
}

/** Banner above the list for the Absent / Late views (only when there is at least one row). */
export function bannerFor(filter: RosterFilter, count: number): RosterBanner | null {
  if (count <= 0) return null;
  const noun = count > 1 ? 'members' : 'member';
  if (filter === 'absent') return { title: 'Absent Today', subtitle: `${count} ${noun} absent`, tone: 'danger' };
  if (filter === 'late') return { title: 'Late Punch-In Today', subtitle: `${count} ${noun} punched in late`, tone: 'warning' };
  return null;
}

/** Keeps the first row of every `userId`. */
export function dedupeById<T extends { userId: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);
    out.push(r);
  }
  return out;
}

/**
 * The live-status endpoints return neither `role_id` nor a real `is_active` (v1: Staff / Manager / Inactive chips
 * were always 0 on tile-driven views). Fill them — and the photo — from the full roster when available. The live list
 * decides membership; the full roster only enriches.
 */
export function mergeRoleInfo(live: readonly StaffMember[], full: readonly StaffMember[] | undefined): StaffMember[] {
  if (!full || full.length === 0) return dedupeById(live);
  const byId = new Map(full.map((m) => [m.userId, m]));
  return dedupeById(live).map((m) => {
    const f = byId.get(m.userId);
    if (!f) return m;
    return {
      ...m,
      roleId: m.roleId ?? f.roleId,
      roleName: m.roleName ?? f.roleName,
      isActive: f.isActive,
      photoUrl: f.photoUrl || m.photoUrl,
      branch: m.branch || f.branch,
      department: m.department || f.department,
      empId: m.empId || f.empId,
    };
  });
}

export interface ChipCounts {
  all: number;
  staff: number;
  manager: number;
  inactive: number;
}

/** Counts shown on the role chips. Computed from the de-duplicated list, not from the searched list. */
export function chipCounts(members: readonly StaffMember[]): ChipCounts {
  const list = dedupeById(members);
  return {
    all: list.length,
    staff: list.filter((m) => m.roleId === 3).length,
    manager: list.filter((m) => m.roleId === 2).length,
    inactive: list.filter((m) => !m.isActive).length,
  };
}

const norm = (s: string | undefined | null): string => (s ?? '').trim().toLowerCase();

export interface RosterFilterOptions {
  role: RoleChip;
  search: string;
  /** Exact (case-insensitive) department name — set for department-tile views. */
  deptName?: string;
  /** Exact (case-insensitive) branch name — set when a branch filter applies to the whole roster. */
  branchName?: string;
}

/** Role chip + search + department / branch filters, sorted A-Z (case-insensitive), de-duplicated. */
export function filterRoster(members: readonly StaffMember[], opts: RosterFilterOptions): StaffMember[] {
  const q = norm(opts.search);
  const dept = opts.deptName === undefined ? null : norm(opts.deptName);
  const branch = opts.branchName === undefined ? null : norm(opts.branchName);
  const out = dedupeById(members).filter((m) => {
    if (opts.role === 'staff' && m.roleId !== 3) return false;
    if (opts.role === 'manager' && m.roleId !== 2) return false;
    if (opts.role === 'inactive' && m.isActive) return false;
    if (dept !== null && norm(m.department) !== dept) return false;
    if (branch !== null && norm(m.branch) !== branch) return false;
    if (q && !(norm(m.name).includes(q) || norm(m.branch).includes(q) || norm(m.department).includes(q))) return false;
    return true;
  });
  return out.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

export interface StatusDisplay {
  label: string;
  tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral';
}

/** Badge text/tone of a member's live status (`null` when the server sent none we recognise). */
export function statusDisplay(status: StaffLiveStatus): StatusDisplay | null {
  switch (status) {
    case 'working':
      return { label: 'Working', tone: 'success' };
    case 'punched_in':
      return { label: 'Punched In', tone: 'success' };
    case 'punched_out':
      return { label: 'Punched Out', tone: 'info' };
    case 'absent':
      return { label: 'Absent', tone: 'danger' };
    case 'late_punched_in':
      return { label: 'Late', tone: 'warning' };
    case 'inactive':
      return { label: 'Inactive', tone: 'neutral' };
    default:
      return null;
  }
}

/** Empty-state copy (v1 wording). */
export function emptyCopy(search: string): { title: string; message: string } {
  const q = search.trim();
  return q
    ? { title: 'No Results', message: `No staff matching "${q}"` }
    : { title: 'No Staff Found', message: 'There are no staff members in this category' };
}
