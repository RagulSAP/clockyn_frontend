import { useQuery } from '@tanstack/react-query';

import { authApi } from '@/api';
import { queryKeys } from '@/lib/query/queryKeys';
import type { UserAuthMode } from '@/types/api/auth';

const AUTH_MODE_STALE_MS = 10 * 60_000;

export interface AuthModeState {
  /** `otp` = mobile number + SMS code, `email` = e-mail address + emailed code. `otp` until the server answers. */
  mode: UserAuthMode;
  /** The server has not answered yet (screens show a spinner instead of guessing the wrong form). */
  loading: boolean;
}

/** The sign-in mode of this deployment, set on the backend (`USER_AUTH`). Falls back to `otp` for older servers. */
export function useAuthMode(): AuthModeState {
  const q = useQuery({
    queryKey: queryKeys.system.authConfig(),
    queryFn: () => authApi.getAuthMode(),
    staleTime: AUTH_MODE_STALE_MS,
  });
  return { mode: q.data ?? 'otp', loading: q.isLoading };
}
