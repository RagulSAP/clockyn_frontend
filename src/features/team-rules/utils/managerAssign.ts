/**
 * Pure logic of the "assign / edit manager" form: assignment payload, edit pre-fill, overlap detection,
 * validation and the branch grouping used by the manager list popup.
 *
 * Backend contract (verified against the server): `POST /managers/assign` rejects any assignment without a
 * non-blank `dept_id` ("Department is required for each assignment"). The v1 "no department = all departments"
 * path therefore always failed. Here a department is REQUIRED in the form, and "all departments" is expressed by
 * sending EVERY department id explicitly.
 */
import type { AssignManagerInput, Manager, ManagerAssignment } from '@/types/api/managers';

export type AssignmentPair = { branchId: string; deptId: string };

export const MSG_SELECT_STAFF = 'Please select a staff member';
export const MSG_SELECT_BRANCH = 'Please select at least one branch to assign';
export const MSG_SELECT_DEPARTMENT = 'Please select at least one department to assign';

const clean = (ids: readonly string[]): string[] => [...new Set(ids.map((i) => String(i).trim()).filter((i) => i !== ''))];

/** Cross product branches x departments (branch order first, then department order). */
export function buildAssignmentPairs(branchIds: readonly string[], deptIds: readonly string[]): AssignmentPair[] {
  const branches = clean(branchIds);
  const depts = clean(deptIds);
  const pairs: AssignmentPair[] = [];
  for (const branchId of branches) {
    for (const deptId of depts) pairs.push({ branchId, deptId });
  }
  return pairs;
}

/** Number of branch x department combinations (the "Access Preview" counter). */
export function countCombinations(branchIds: readonly string[], deptIds: readonly string[]): number {
  return clean(branchIds).length * clean(deptIds).length;
}

/**
 * Body for `managersApi.assignManager`: one `{branchId, deptId}` per branch x department.
 * Throws when a branch or a department is missing, so an invalid request is never sent.
 */
export function buildAssignManagerInput(userId: string, branchIds: readonly string[], deptIds: readonly string[]): AssignManagerInput {
  if (!userId.trim()) throw new Error(MSG_SELECT_STAFF);
  if (clean(branchIds).length === 0) throw new Error(MSG_SELECT_BRANCH);
  if (clean(deptIds).length === 0) throw new Error(MSG_SELECT_DEPARTMENT);
  return {
    userId,
    assignments: buildAssignmentPairs(branchIds, deptIds).map((p) => ({ branchId: p.branchId, deptId: p.deptId })),
  };
}

export type ManagerFormInput = { isEdit: boolean; staffId: string; branchIds: readonly string[]; deptIds: readonly string[] };

/** First validation message in the v1 order (staff, branch) plus the new required-department rule; `null` when valid. */
export function validateManagerForm({ staffId, branchIds, deptIds }: ManagerFormInput): string | null {
  if (!staffId.trim()) return MSG_SELECT_STAFF;
  if (clean(branchIds).length === 0) return MSG_SELECT_BRANCH;
  if (clean(deptIds).length === 0) return MSG_SELECT_DEPARTMENT;
  return null;
}

/**
 * Edit-mode pre-fill from an existing manager. Does not depend on the org having branches/departments (v1 needed both
 * lists to be non-empty). A legacy "all departments" assignment (`deptId === null`) selects every department.
 */
export function prefillFromManager(manager: Manager | undefined, allDeptIds: readonly string[]): { branchIds: string[]; deptIds: string[] } {
  if (!manager) return { branchIds: [], deptIds: [] };
  const branchIds = clean(manager.assignments.map((a) => a.branchId));
  const hasAllDepts = manager.assignments.some((a) => !a.deptId);
  const named = clean(manager.assignments.map((a) => a.deptId ?? ''));
  const deptIds = hasAllDepts ? clean([...named, ...allDeptIds]) : named;
  return { branchIds, deptIds };
}

export type AssignmentConflict = { managerName: string; empId: string; branchName: string; deptName: string };

export const ALL_DEPARTMENTS_LABEL = 'All Departments';

export type ConflictContext = {
  managers: readonly Manager[];
  /** The manager being edited (their own assignments never conflict) or the staff member being promoted. */
  selfUserId?: string;
  branchIds: readonly string[];
  deptIds: readonly string[];
  branchNames: Readonly<Record<string, string>>;
  deptNames: Readonly<Record<string, string>>;
};

/**
 * Overlap detection against the OTHER managers: a (branch, department) pair is taken when another manager covers the
 * same branch and either has "all departments" there (legacy `deptId === null`) or the same department.
 * Results are de-duplicated by (manager, branch, department) names.
 */
export function detectConflicts(ctx: ConflictContext): AssignmentConflict[] {
  const branches = new Set(clean(ctx.branchIds));
  const depts = new Set(clean(ctx.deptIds));
  const newHasNoDept = depts.size === 0;
  const out: AssignmentConflict[] = [];
  const seen = new Set<string>();
  for (const m of ctx.managers) {
    if (ctx.selfUserId && m.userId === ctx.selfUserId) continue;
    for (const a of m.assignments) {
      if (!branches.has(String(a.branchId))) continue;
      const existingAllDepts = !a.deptId;
      const overlap = newHasNoDept || existingAllDepts || depts.has(String(a.deptId));
      if (!overlap) continue;
      const branchName = ctx.branchNames[String(a.branchId)] || a.branchName || String(a.branchId);
      const deptName = existingAllDepts ? ALL_DEPARTMENTS_LABEL : ctx.deptNames[String(a.deptId)] || a.deptName || String(a.deptId);
      const key = `${m.userId}|${branchName}|${deptName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ managerName: m.name, empId: m.empId, branchName, deptName });
    }
  }
  return out;
}

export type BranchAssignmentGroup = { key: string; branchLabel: string; departments: string[] };

/** Groups assignment rows by branch id (order of first appearance) for the manager's "Branches" popup. */
export function groupAssignmentsByBranch(assignments: readonly ManagerAssignment[]): BranchAssignmentGroup[] {
  const groups = new Map<string, BranchAssignmentGroup>();
  for (const a of assignments) {
    const key = String(a.branchId);
    let g = groups.get(key);
    if (!g) {
      g = { key, branchLabel: a.branchName || 'All Branches', departments: [] };
      groups.set(key, g);
    }
    g.departments.push(a.deptName || ALL_DEPARTMENTS_LABEL);
  }
  return [...groups.values()];
}

export type ManagerStats = { total: number; assigned: number; assignments: number };

export function managerStats(managers: readonly Manager[]): ManagerStats {
  return {
    total: managers.length,
    assigned: managers.filter((m) => m.assignments.length > 0).length,
    assignments: managers.reduce((n, m) => n + m.assignments.length, 0),
  };
}

export const pluralLabel = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
