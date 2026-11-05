/**
 * State machine of "delete a branch": check staff -> (plain confirm | reassign sheet) -> delete.
 *
 *   idle --start--> checking --staffLoaded(0 staff)--> confirm --deleted--> idle
 *                            \-staffLoaded(n staff)--> reassign --reassigned(all moved)--> (caller deletes) --deleted--> idle
 *                                                                \-reassigned(some)--> reassign (remaining staff)
 *   any step --cancel--> idle;  staffFailed --> idle (the caller shows the error)
 *   deleteFailed --> confirm (the branch is empty, the user can retry the delete)
 *
 * Pure and synchronous; the hook performs the API calls and dispatches the outcomes. Every action resets `error`
 * (v1 left stale messages around) and actions that do not fit the current step are ignored, so a late response after
 * "cancel" cannot reopen anything.
 */
import type { Branch, BranchStaffMember } from '@/types/api/branches';

export type DeleteFlowState =
  | { step: 'idle' }
  | { step: 'checking'; branch: Branch }
  | { step: 'confirm'; branch: Branch; deleting: boolean; error: string | null }
  | {
      step: 'reassign';
      branch: Branch;
      staff: BranchStaffMember[];
      selectedIds: string[];
      targetId: string;
      busy: boolean;
      error: string | null;
    };

export type DeleteFlowAction =
  | { type: 'start'; branch: Branch }
  | { type: 'staffLoaded'; staff: BranchStaffMember[] }
  | { type: 'staffFailed' }
  | { type: 'cancel' }
  | { type: 'toggleStaff'; userId: string }
  | { type: 'toggleAll' }
  | { type: 'setTarget'; branchId: string }
  | { type: 'busy' }
  | { type: 'failed'; message: string }
  /** Selected staff were moved; `movedIds` leave the list, selection and target reset. */
  | { type: 'reassigned'; movedIds: string[] }
  | { type: 'deleteStarted' }
  | { type: 'deleteFailed'; message: string }
  | { type: 'deleted' };

export const INITIAL_DELETE_FLOW: DeleteFlowState = { step: 'idle' };

export function deleteFlowReducer(state: DeleteFlowState, action: DeleteFlowAction): DeleteFlowState {
  switch (action.type) {
    case 'start':
      return state.step === 'idle' ? { step: 'checking', branch: action.branch } : state;
    case 'staffLoaded':
      if (state.step !== 'checking') return state;
      return action.staff.length === 0
        ? { step: 'confirm', branch: state.branch, deleting: false, error: null }
        : {
            step: 'reassign',
            branch: state.branch,
            staff: action.staff,
            selectedIds: [],
            targetId: '',
            busy: false,
            error: null,
          };
    case 'staffFailed':
    case 'cancel':
    case 'deleted':
      return INITIAL_DELETE_FLOW;
    case 'toggleStaff':
      if (state.step !== 'reassign' || state.busy) return state;
      return {
        ...state,
        error: null,
        selectedIds: state.selectedIds.includes(action.userId)
          ? state.selectedIds.filter((id) => id !== action.userId)
          : [...state.selectedIds, action.userId],
      };
    case 'toggleAll':
      if (state.step !== 'reassign' || state.busy) return state;
      return {
        ...state,
        error: null,
        selectedIds: state.selectedIds.length === state.staff.length ? [] : state.staff.map((s) => s.userId),
      };
    case 'setTarget':
      if (state.step !== 'reassign' || state.busy) return state;
      return { ...state, error: null, targetId: action.branchId };
    case 'busy':
      return state.step === 'reassign' ? { ...state, busy: true, error: null } : state;
    case 'failed':
      return state.step === 'reassign' ? { ...state, busy: false, error: action.message } : state;
    case 'reassigned': {
      if (state.step !== 'reassign') return state;
      const moved = new Set(action.movedIds);
      return {
        ...state,
        staff: state.staff.filter((s) => !moved.has(s.userId)),
        selectedIds: [],
        targetId: '',
        busy: false,
        error: null,
      };
    }
    case 'deleteStarted':
      return state.step === 'confirm' ? { ...state, deleting: true, error: null } : state;
    case 'deleteFailed': {
      // Works from the reassign step too (all staff moved, then the delete failed): fall back to the plain confirm.
      if (state.step === 'confirm') return { ...state, deleting: false, error: action.message };
      if (state.step === 'reassign') return { step: 'confirm', branch: state.branch, deleting: false, error: action.message };
      return state;
    }
    default:
      return state;
  }
}

/** The reassign button is enabled only with at least one staff member and a target branch. */
export function canReassign(state: DeleteFlowState): boolean {
  return state.step === 'reassign' && !state.busy && state.selectedIds.length > 0 && state.targetId !== '';
}

export function allSelected(state: DeleteFlowState): boolean {
  return state.step === 'reassign' && state.staff.length > 0 && state.selectedIds.length === state.staff.length;
}

/** "Reassign All & Delete Branch" when everything is selected, otherwise "Reassign {k} Staff" ("Reassign Staff" for 0). */
export function reassignLabel(state: DeleteFlowState): string {
  if (state.step !== 'reassign') return 'Reassign Staff';
  if (allSelected(state)) return 'Reassign All & Delete Branch';
  return state.selectedIds.length > 0 ? `Reassign ${state.selectedIds.length} Staff` : 'Reassign Staff';
}

/** Targets = every other branch (the branch being deleted is never offered). */
export function targetBranches(branches: readonly Branch[], deleting: Branch | null | undefined): Branch[] {
  return branches.filter((b) => b.id !== deleting?.id);
}

/** Staff left after moving `movedIds` (the branch is deleted once this is empty). */
export function remainingAfter(staff: readonly BranchStaffMember[], movedIds: readonly string[]): BranchStaffMember[] {
  return staff.filter((s) => !movedIds.includes(s.userId));
}
