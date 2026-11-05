import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { chatApi } from '@/api';
import { useDebounce } from '@/hooks';
import { queryKeys } from '@/lib/query/queryKeys';
import { useRole, useUserId } from '@/store/auth';
import type { ChatSearchResult } from '@/types/api/chat';
import type { StaffMember } from '@/types/api/staff';
import type { ChatVariant } from '../types';
import { filterSearchResults, searchStaffLocally } from '../utils/chatLists';
import { useOrgAdminContact, useStaffDirectory } from './useStaffDirectory';

export const SEARCH_DEBOUNCE_MS = 300;

export interface ChatSearchState {
  results: ChatSearchResult[];
  isSearching: boolean;
}

/**
 * Staff search that starts a new conversation.
 *  - admin screens: backend search (`/chat/search`, 300 ms debounce); when it fails the staff directory is searched
 *    locally instead (v1 fallback, now also role-gated);
 *  - staff / manager screens: local search over the organisation's staff (+ the admin, who is not in that list).
 * Managers / staff using the admin screens only ever see admin results.
 */
export function useChatSearch(variant: ChatVariant, query: string): ChatSearchState {
  const userId = useUserId();
  const role = useRole();
  const adminOnly = variant === 'admin' && role !== 1;
  const debounced = useDebounce(query.trim(), variant === 'admin' ? SEARCH_DEBOUNCE_MS : 0);
  const active = debounced !== '' && query.trim() !== '';

  const remote = useQuery({
    queryKey: queryKeys.chat.search(userId, debounced),
    queryFn: () => chatApi.searchChatStaff(userId, debounced),
    enabled: variant === 'admin' && active && userId !== '',
    retry: false,
    staleTime: 30_000,
  });

  const needLocal = active && (variant === 'staff' || remote.isError);
  const staff = useStaffDirectory(needLocal);
  const admin = useOrgAdminContact(needLocal && role !== 1);

  return useMemo(() => {
    if (!active) return { results: [], isSearching: false };
    if (variant === 'admin' && !remote.isError) {
      return { results: filterSearchResults(remote.data ?? [], adminOnly), isSearching: remote.isFetching };
    }
    const pool: StaffMember[] = [...(admin.data ? [admin.data] : []), ...(staff.data ?? [])];
    const unique = pool.filter((s, i) => pool.findIndex((o) => o.userId === s.userId) === i);
    return {
      results: searchStaffLocally(unique, debounced, { selfId: userId, adminOnly }),
      isSearching: staff.isLoading,
    };
  }, [active, variant, remote.isError, remote.data, remote.isFetching, adminOnly, admin.data, staff.data, staff.isLoading, debounced, userId]);
}
