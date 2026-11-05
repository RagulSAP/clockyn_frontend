import { useCallback, useMemo, useState } from 'react';

import { todayIST } from '@/lib/datetime';

import { clampToToday } from '../utils/dashboardLogic';

type FilterState = {
  /** Organisation the branch / department filters belong to. */
  orgId: string;
  /** '' = ALL branches. Branches are identified by id (v1 used the name, which collides). */
  branchId: string;
  deptOn: boolean;
  /** `YYYY-MM-DD` (IST business date). */
  date: string;
};

export type DashboardFilters = {
  branchId: string;
  deptOn: boolean;
  date: string;
  /** Today (IST) — upper bound of the date picker. */
  today: string;
  setBranchId: (id: string) => void;
  setDeptOn: (on: boolean) => void;
  setDate: (date: string) => void;
  /** Pull-to-refresh: the date goes back to today. */
  resetDate: () => void;
};

/**
 * Branch / department-mode / date filters of the dashboard. The branch and department-mode filters are bound to
 * the organisation: when the organisation changes they read as reset (ALL / off) while the date is kept (v1
 * company-switch behaviour) — derived, so there is no render with a stale branch id of another company.
 */
export function useDashboardFilters(orgId: string): DashboardFilters {
  const [state, setState] = useState<FilterState>(() => ({ orgId, branchId: '', deptOn: false, date: todayIST() }));
  const today = todayIST();

  const effective = useMemo<FilterState>(
    () => (state.orgId === orgId ? state : { orgId, branchId: '', deptOn: false, date: state.date }),
    [state, orgId],
  );

  const update = useCallback(
    (patch: Partial<Omit<FilterState, 'orgId'>>) => {
      setState((prev) => {
        const base: FilterState = prev.orgId === orgId ? prev : { orgId, branchId: '', deptOn: false, date: prev.date };
        return { ...base, ...patch };
      });
    },
    [orgId],
  );

  const setBranchId = useCallback((id: string) => update({ branchId: id }), [update]);
  const setDeptOn = useCallback((on: boolean) => update({ deptOn: on }), [update]);
  const setDate = useCallback((date: string) => update({ date: clampToToday(date, todayIST()) }), [update]);
  const resetDate = useCallback(() => update({ date: todayIST() }), [update]);

  return {
    branchId: effective.branchId,
    deptOn: effective.deptOn,
    date: clampToToday(effective.date, today),
    today,
    setBranchId,
    setDeptOn,
    setDate,
    resetDate,
  };
}
