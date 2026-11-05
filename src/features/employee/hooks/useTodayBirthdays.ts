import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { employeeApi } from '@/api';
import { useRefreshOnFocus } from '@/hooks';
import { todayIST } from '@/lib/datetime';
import { useSession } from '@/store/auth';

/** Birthday popups already dismissed in this app run (`userId:date`) — v1 re-opened the popup on every focus. */
const dismissed = new Set<string>();

/** Test helper. */
export function resetShownBirthdays(): void {
  dismissed.clear();
}

/** Names with a birthday today, plus whether the popup should open (until dismissed, once per day per app run). */
export function useTodayBirthdays(): { names: string[]; open: boolean; close: () => void } {
  const session = useSession();
  const userId = session?.userId ?? '';
  const orgId = session?.orgId ?? '';
  const date = todayIST();
  const query = useQuery({
    queryKey: ['home', userId, 'birthdays', orgId, date],
    queryFn: () => employeeApi.getTodayBirthdays(orgId, userId),
    enabled: userId !== '' && orgId !== '',
    staleTime: 60 * 60_000,
  });
  useRefreshOnFocus(query.refetch);
  const names = query.data ?? [];
  const key = `${userId}:${date}`;
  // Local state only re-renders after `close`; the module set remembers it for later mounts.
  const [, setTick] = useState(0);
  const open = names.length > 0 && !dismissed.has(key);
  const close = () => {
    dismissed.add(key);
    setTick((t) => t + 1);
  };
  return { names, open, close };
}
