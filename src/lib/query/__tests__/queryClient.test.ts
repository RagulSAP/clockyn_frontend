import { Platform } from 'react-native';

import { ApiError, networkError, timeoutError } from '@/lib/api/errors';

import {
  DEFAULT_STALE_TIME_MS,
  PLAN_STALE_TIME_MS,
  createQueryClient,
  queryClient,
  resetQueryCache,
  shouldRetryQuery,
} from '../queryClient';

describe('shouldRetryQuery', () => {
  it('retries a network failure exactly once', () => {
    expect(shouldRetryQuery(0, networkError())).toBe(true);
    expect(shouldRetryQuery(1, networkError())).toBe(false);
    expect(shouldRetryQuery(0, timeoutError())).toBe(true);
  });
  it('never retries HTTP errors, aborts or unknown errors', () => {
    expect(shouldRetryQuery(0, new ApiError({ status: 500, message: 'x' }))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError({ status: 404, message: 'x' }))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError({ status: 0, isAborted: true, isNetwork: true }))).toBe(false);
    expect(shouldRetryQuery(0, new Error('bug'))).toBe(false);
    expect(shouldRetryQuery(0, undefined)).toBe(false);
  });
});

describe('createQueryClient defaults', () => {
  it('uses a 30s stale time, reconnect refetch and no mutation retries', () => {
    const d = createQueryClient().getDefaultOptions();
    expect(d.queries?.staleTime).toBe(30_000);
    expect(DEFAULT_STALE_TIME_MS).toBe(30_000);
    expect(d.queries?.refetchOnReconnect).toBe(true);
    expect(d.queries?.retry).toBe(shouldRetryQuery);
    expect(d.mutations?.retry).toBe(0);
  });
  it('refetches on window focus on web only', () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false); // jest-expo default platform is native
    const spy = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      expect(createQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(true);
    } finally {
      spy.restore();
    }
  });
  it('plan status stays fresh for 5 minutes', () => {
    expect(PLAN_STALE_TIME_MS).toBe(5 * 60_000);
  });
});

describe('resetQueryCache', () => {
  it('empties the cache synchronously', async () => {
    queryClient.setQueryData(['a', 'x'], 1);
    queryClient.setQueryData(['b', 'y'], 2);
    const p = resetQueryCache();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    await p;
  });
  it('cancels in-flight queries so they cannot repopulate the cache', async () => {
    let resolve: (v: string) => void = () => undefined;
    const fetching = queryClient.fetchQuery({ queryKey: ['slow', 'x'], queryFn: () => new Promise<string>((r) => { resolve = r; }) }).catch(() => undefined);
    await resetQueryCache();
    resolve('late data');
    await fetching;
    expect(queryClient.getQueryData(['slow', 'x'])).toBeUndefined();
  });
  it('works on a custom client', async () => {
    const c = createQueryClient();
    c.setQueryData(['k'], 1);
    await resetQueryCache(c);
    expect(c.getQueryData(['k'])).toBeUndefined();
  });
});
