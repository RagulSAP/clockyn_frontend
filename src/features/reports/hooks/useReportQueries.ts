/** Query hooks of the report screens. Keys are scoped by org id and period, so a late response for another month can never
 * overwrite the visible one and a failed reload never leaves stale rows from the previous period on screen. */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId } from '@/store/auth';
import {
  loadLateReport,
  loadOvertimeReport,
  loadPaySheet,
  loadSalarySheet,
  loadShiftReport,
  loadStaffDetailedReport,
} from '../services/reportLoaders';

const INITIAL_CAPTION = 'Loading report...';

/** The N+1 reports must not re-run every time the browser window regains focus (e.g. after the print dialog closes). */
const HEAVY_REPORT = { refetchOnWindowFocus: false } as const;

export function useStaffDetailedReport(year: number, month: number) {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(INITIAL_CAPTION);
  const query = useQuery({
    queryKey: queryKeys.reports.run(orgId, 'staff-detailed', { year, month }),
    ...HEAVY_REPORT,
    enabled: orgId !== '',
    queryFn: () => loadStaffDetailedReport({ orgId, year, month, queryClient, onProgress: setProgress }),
  });
  return { ...query, progress, orgId };
}

export function useLateReport(year: number, month: number) {
  const orgId = useOrgId();
  const [progress, setProgress] = useState(INITIAL_CAPTION);
  const query = useQuery({
    queryKey: queryKeys.reports.run(orgId, 'late', { year, month }),
    ...HEAVY_REPORT,
    enabled: orgId !== '',
    queryFn: () => loadLateReport({ orgId, year, month, onProgress: setProgress }),
  });
  return { ...query, progress, orgId };
}

export function useOvertimeReport(year: number, month: number) {
  const orgId = useOrgId();
  const query = useQuery({
    queryKey: queryKeys.reports.run(orgId, 'overtime', { year, month }),
    enabled: orgId !== '',
    queryFn: () => loadOvertimeReport({ orgId, year, month }),
  });
  return { ...query, orgId };
}

export function useShiftReport() {
  const orgId = useOrgId();
  const query = useQuery({
    queryKey: queryKeys.reports.run(orgId, 'employee-shifts'),
    ...HEAVY_REPORT,
    enabled: orgId !== '',
    queryFn: () => loadShiftReport(orgId),
  });
  return { ...query, orgId };
}

export function usePaySheet(year: number, month: number) {
  const orgId = useOrgId();
  const query = useQuery({
    queryKey: queryKeys.salaryReports.monthly(orgId, year, month),
    enabled: orgId !== '',
    queryFn: () => loadPaySheet(orgId, month, year),
  });
  return { ...query, orgId };
}

export function useSalarySheet(year: number, month: number) {
  const orgId = useOrgId();
  const query = useQuery({
    queryKey: queryKeys.salaryReports.breakdown(orgId, year, month),
    enabled: orgId !== '',
    queryFn: () => loadSalarySheet(orgId, month, year),
  });
  return { ...query, orgId };
}
