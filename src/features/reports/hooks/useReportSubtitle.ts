import { useSession } from '@/store/auth';

/** Export subtitle `Company | October 2026` (company omitted when unknown). */
export function useReportSubtitle(periodLabel: string): string {
  const orgName = useSession()?.orgName?.trim();
  return orgName ? `${orgName} | ${periodLabel}` : periodLabel;
}
