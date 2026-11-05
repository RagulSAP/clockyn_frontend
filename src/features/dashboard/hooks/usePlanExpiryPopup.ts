import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { plansApi } from '@/api';
import { useMounted } from '@/hooks/useMounted';
import { todayIST } from '@/lib/datetime';
import { queryKeys } from '@/lib/query/queryKeys';
import { getString, setString } from '@/lib/storage';
import { useOrgId, useSession } from '@/store/auth';
import type { Subscription } from '@/types/api/plans';

import {
  decidePlanPopup,
  isPlanPopupPlatform,
  planPopupShownKey,
  shouldShowPlanPopup,
  type PlanPopupDecision,
} from '../utils/planPopup';

export type PlanPopupState = PlanPopupDecision & { subscription: Subscription | null; orgId: string };

export type PlanExpiryPopup = {
  popup: PlanPopupState | null;
  dismiss: () => void;
};

/**
 * Plan-expiry popup of the admin home: decided once per organisation per mount from the subscription, shown at
 * most once per day per organisation (storage flag, written when it is actually shown), never on iOS. A failed
 * subscription request simply skips the popup (it is a background nicety, as in v1).
 */
export function usePlanExpiryPopup(platform: string = Platform.OS): PlanExpiryPopup {
  const orgId = useOrgId();
  const session = useSession();
  const isMounted = useMounted();
  const enabled = orgId !== '' && session?.roleId === 1 && isPlanPopupPlatform(platform);
  const query = useQuery({
    queryKey: queryKeys.plans.subscription(orgId),
    queryFn: () => plansApi.getSubscription(orgId),
    enabled,
    staleTime: 5 * 60_000,
  });
  const [shown, setShown] = useState<PlanPopupState | null>(null);
  const evaluatedFor = useRef<string | null>(null);
  const currentOrg = useRef(orgId);
  useEffect(() => {
    currentOrg.current = orgId;
  }, [orgId]);
  const sub = query.data ?? null;
  const sessionTrialEnd = session?.freeTrialEnd ?? null;

  useEffect(() => {
    if (!enabled || !sub || evaluatedFor.current === orgId) return;
    evaluatedFor.current = orgId;
    const today = todayIST();
    const decision = decidePlanPopup({
      isFreeTrial: sub.isFreeTrial,
      freeTrialEnd: sub.freeTrialEnd ?? (sub.isFreeTrial ? sessionTrialEnd : null),
      subscriptionEnd: sub.endDate,
      today,
    });
    if (!decision) return;
    const forOrg = orgId;
    void (async () => {
      const key = planPopupShownKey(forOrg, today);
      const already = (await getString(key)) === 'true';
      if (!isMounted() || currentOrg.current !== forOrg) return;
      if (!shouldShowPlanPopup({ platform, decision, alreadyShownToday: already })) return;
      void setString(key, 'true');
      setShown({ ...decision, subscription: sub, orgId: forOrg });
    })();
  }, [enabled, sub, orgId, platform, sessionTrialEnd, isMounted]);

  // A popup belongs to the organisation it was decided for; another organisation starts with a clean slate.
  const popup = shown && shown.orgId === orgId ? shown : null;
  const dismiss = useCallback(() => setShown(null), []);
  return { popup, dismiss };
}
