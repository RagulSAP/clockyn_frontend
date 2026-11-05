import { create } from 'zustand';

import type { RequestType } from '@/types/api/requests';

import { sameIds, type SeenIds } from '../utils/badgeLogic';

/**
 * Which pending requests the admin has already seen, per (organisation, user) scope and request type.
 * In memory only (v1 kept it in memory too); scoping by org + user means a different account or company never
 * inherits another one's state, and nothing needs clearing on sign-out.
 */
interface SeenState {
  seen: Record<string, SeenIds>;
  /** Replace the seen ids of a type with the ids that are pending right now. */
  markSeen: (scope: string, type: RequestType, ids: readonly string[]) => void;
  reset: () => void;
}

export const useSeenStore = create<SeenState>()((set, get) => ({
  seen: {},
  markSeen: (scope, type, ids) => {
    const current = get().seen[scope];
    if (current && sameIds(current[type], ids)) return;
    set((s) => ({ seen: { ...s.seen, [scope]: { ...s.seen[scope], [type]: [...ids] } } }));
  },
  reset: () => set({ seen: {} }),
}));

export const seenScope = (orgId: string, userId: string): string => `${orgId}:${userId}`;
