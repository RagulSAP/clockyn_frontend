import { useQuery } from '@tanstack/react-query';

import { authApi, homeApi } from '@/api';
import { getErrorMessage } from '@/lib/api/errors';
import type { StaffDetail, StaffProfile } from '@/types/api/staff';

import { directoryKeys } from './keys';
import { useStaffScopeId } from './useStaffScope';

export interface StaffDetailData {
  scope: string;
  detail: StaffDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  refetch: () => void;
  /** Best known profile photo (admin-uploaded photo, face-enrolment photo, then the summary's photo). */
  photoUrl: string | undefined;
  profile: StaffProfile | undefined;
  profileLoading: boolean;
  profileError: boolean;
  /** True only while a refetch of an already-loaded profile runs (drives the "Refreshing profile..." strip). */
  profileRefreshing: boolean;
  refetchProfile: () => Promise<unknown>;
}

async function loadPhoto(staffId: string): Promise<string | null> {
  // Two legacy endpoints exist; the editable one wins. Failures only mean "no photo".
  const editable = await authApi.getEmployeePhotoUrl(staffId).catch(() => null);
  if (editable) return editable;
  return authApi.getProfilePhotoUrl(staffId).catch(() => null);
}

/** Summary card + photo of one staff member, and (lazily) the full profile. */
export function useStaffDetailData(staffId: string, opts: { profileEnabled: boolean }): StaffDetailData {
  const scope = useStaffScopeId();
  const enabled = !!scope && !!staffId;

  const detail = useQuery({
    queryKey: directoryKeys.detail(scope, staffId),
    queryFn: () => homeApi.getStaffDetail(staffId, scope),
    enabled,
  });
  const photo = useQuery({
    queryKey: directoryKeys.photo(scope, staffId),
    queryFn: () => loadPhoto(staffId),
    enabled,
    retry: false,
  });
  const profile = useQuery({
    queryKey: directoryKeys.profile(scope, staffId),
    queryFn: () => homeApi.getStaffProfile(staffId, scope),
    enabled: enabled && opts.profileEnabled,
  });

  return {
    scope,
    detail: detail.data,
    isLoading: enabled && detail.isLoading,
    isError: detail.isError,
    errorMessage: detail.isError ? getErrorMessage(detail.error, 'Failed to load staff details') : '',
    refetch: () => {
      void detail.refetch();
      void photo.refetch();
    },
    photoUrl: photo.data ?? detail.data?.photoUrl,
    profile: profile.data,
    profileLoading: profile.isLoading,
    profileError: profile.isError,
    profileRefreshing: profile.isFetching && profile.data !== undefined,
    refetchProfile: () => profile.refetch(),
  };
}
