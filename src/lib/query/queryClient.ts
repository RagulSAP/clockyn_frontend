import { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { ApiError } from '@/lib/api/errors';

export const DEFAULT_STALE_TIME_MS = 30_000;
/** How long plan status stays fresh (v1: 5 minutes). */
export const PLAN_STALE_TIME_MS = 5 * 60_000;

/**
 * Retry policy: a failed query is retried ONCE, and only for network-level failures
 * (offline, timeout, DNS). HTTP errors (4xx/5xx) and programming errors are not retried.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  return error instanceof ApiError && error.isNetwork && !error.isAborted;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        retry: shouldRetryQuery,
        refetchOnReconnect: true,
        // Native has no window focus; screens refresh on focus via `useRefreshOnFocus`.
        refetchOnWindowFocus: Platform.OS === 'web',
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/** The app-wide client (also used by non-React code such as sign-out and realtime handlers). */
export const queryClient: QueryClient = createQueryClient();

/**
 * Drop every cached query/mutation — called on sign-out (so the next user never sees the previous user's data)
 * and when the account/organisation context is replaced. In-flight requests are cancelled first so they cannot
 * repopulate the cache afterwards.
 */
export function resetQueryCache(client: QueryClient = queryClient): Promise<void> {
  // `clear()` destroys every query (which also cancels in-flight fetches) synchronously, so the cache is empty
  // the moment this returns; the promise only waits for cancellations to settle.
  const cancelled = client.cancelQueries().catch(() => undefined);
  client.clear();
  return cancelled.then(() => undefined);
}
