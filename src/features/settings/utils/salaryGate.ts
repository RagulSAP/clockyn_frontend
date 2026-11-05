import { isFeatureBlocked, planBlockMessageFor, type OrgPlanStatus } from '@/config/plans';

export interface SalaryGate {
  blocked: boolean;
  subtitle: string;
  /** Info toast shown when a blocked row is tapped ('' when not blocked). */
  message: string;
}

/**
 * Plan gate of the "Salary Structure" row: blocked unless on a free trial or an active paid plan.
 * An unknown status (still loading, or the request failed) fails OPEN, like v1.
 */
export function salaryGate(status: OrgPlanStatus | null | undefined): SalaryGate {
  const blocked = isFeatureBlocked(status, 'salary_structure');
  return {
    blocked,
    subtitle: blocked ? 'Upgrade plan to access' : 'Pay templates & rules',
    message: blocked ? planBlockMessageFor(status, 'admin') : '',
  };
}
