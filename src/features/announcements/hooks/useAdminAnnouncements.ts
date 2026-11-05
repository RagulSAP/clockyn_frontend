import { useQuery } from '@tanstack/react-query';

import { createAnnouncement, deleteAnnouncement, listAnnouncements } from '@/api/announcements';
import { listBranches } from '@/api/branches';
import { listDepartments } from '@/api/departments';
import { getAllStaff } from '@/api/home';
import { useApiMutation } from '@/lib/query';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useSession } from '@/store/auth';
import type { CreateAnnouncementInput } from '@/types/api/announcements';

/** Organisation id + sending admin id. */
export function useAnnouncementAdmin(): { orgId: string; userId: string } {
  const session = useSession();
  return { orgId: useOrgId(), userId: session?.userId ?? '' };
}

/** Admin history of every announcement of the organisation. */
export function useAnnouncementHistory() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.announcements.list(orgId),
    queryFn: () => listAnnouncements(orgId),
    enabled: orgId !== '',
  });
}

/** Sends an announcement; refreshes the history. Failures toast the server message ("Failed to send announcement"). */
export function useSendAnnouncement() {
  const orgId = useOrgId();
  return useApiMutation((input: CreateAnnouncementInput) => createAnnouncement(input), {
    invalidate: [queryKeys.announcements.all(orgId)],
    errorMessage: 'Failed to send announcement',
  });
}

/** Deletes an announcement (success toast "Announcement deleted"; a `success:false` reply surfaces as an error toast). */
export function useDeleteAnnouncement() {
  const orgId = useOrgId();
  return useApiMutation((id: string) => deleteAnnouncement(id), {
    invalidate: [queryKeys.announcements.all(orgId)],
    successMessage: 'Announcement deleted',
    errorMessage: 'Failed to delete',
  });
}

/** Staff of the organisation for the recipient picker (`/home/all-staff`). Enabled on demand. */
export function useAnnouncementStaff(enabled: boolean) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: queryKeys.home.allStaff(orgId),
    queryFn: () => getAllStaff(orgId),
    enabled: enabled && orgId !== '',
  });
}

/** Branches and departments of the organisation for the targeted composer. */
export function useBranchDeptOptions() {
  const orgId = useOrgId();
  const branches = useQuery({
    queryKey: queryKeys.home.branches(orgId),
    queryFn: () => listBranches(orgId),
    enabled: orgId !== '',
  });
  const departments = useQuery({
    queryKey: queryKeys.home.departments(orgId),
    queryFn: () => listDepartments(orgId),
    enabled: orgId !== '',
  });
  return { branches, departments };
}
