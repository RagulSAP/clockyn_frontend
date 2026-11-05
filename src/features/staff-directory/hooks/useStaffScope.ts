import { useSession } from '@/store/auth';

/**
 * The id the staff endpoints are scoped by: the organisation id for admins and the manager's OWN user id for
 * managers (the server then limits lists to the manager's branches / departments). Empty string when signed out.
 */
export function useStaffScopeId(): string {
  const session = useSession();
  if (!session) return '';
  return session.roleId === 2 ? session.userId : session.orgId;
}
