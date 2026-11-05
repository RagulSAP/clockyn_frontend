import { QueryClient } from '@tanstack/react-query';

import { PLAN_STALE_TIME_MS } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/query/queryKeys';

import { refreshPlanStatusIfStale } from '../usePlanStatusRefresh';

const status = { plan_id: 3, is_free_trial: false, is_expired: false };

function clientWith(updatedAt: number | null): { client: QueryClient; spy: jest.SpyInstance } {
  const client = new QueryClient();
  if (updatedAt !== null) client.setQueryData(queryKeys.plans.status('org-1'), status, { updatedAt });
  return { client, spy: jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined) };
}

describe('refreshPlanStatusIfStale', () => {
  const now = 1_000_000_000;

  it('re-reads the status once it is older than the 5 minute cache lifetime', () => {
    const { client, spy } = clientWith(now - PLAN_STALE_TIME_MS - 1);
    expect(refreshPlanStatusIfStale(client, 'org-1', now)).toBe(true);
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.plans.status('org-1') });
  });

  it('leaves a fresh status alone', () => {
    const { client, spy } = clientWith(now - 60_000);
    expect(refreshPlanStatusIfStale(client, 'org-1', now)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('does nothing when the status was never requested or there is no organisation', () => {
    const { client, spy } = clientWith(null);
    expect(refreshPlanStatusIfStale(client, 'org-1', now)).toBe(false);
    expect(refreshPlanStatusIfStale(client, '', now)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('only touches the status of the given organisation', () => {
    const { client, spy } = clientWith(now - PLAN_STALE_TIME_MS - 1);
    expect(refreshPlanStatusIfStale(client, 'org-2', now)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
