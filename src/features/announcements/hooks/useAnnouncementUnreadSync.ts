import { useEffect, useRef } from 'react';

import { realtimeBus } from '@/lib/realtime/events';
import { refreshUnread, resetUnread } from '../seenIds';
import { useAnnouncementViewer, useEmployeeAnnouncements } from './useEmployeeAnnouncements';

/**
 * Keeps the announcement unread counters (hub cards + Chat tab badge) exact:
 *  - loads the staff member's announcements as soon as a staff / manager session exists (admins: nothing),
 *  - recomputes unseen counts from the per-user seen ids after EVERY successful fetch (this heals the optimistic
 *    +1 the realtime layer applies for a push and/or socket event — no double counting),
 *  - refetches after the socket reconnected (events missed while offline),
 *  - resets the counters when the user signs out or changes.
 *
 * Mounted once by the app bootstrap (and harmlessly again by the staff hub: it never resets on unmount).
 */
export function useAnnouncementUnreadSync(): void {
  const { userId, enabled } = useAnnouncementViewer();
  const { data, dataUpdatedAt, refetch } = useEmployeeAnnouncements();
  const lastUser = useRef('');

  useEffect(() => {
    if (!enabled) {
      lastUser.current = '';
      resetUnread();
      return;
    }
    if (lastUser.current !== '' && lastUser.current !== userId) resetUnread();
    lastUser.current = userId;
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !data) return;
    void refreshUnread(userId, data);
    // `dataUpdatedAt` changes on every successful fetch, even when the list is structurally identical.
  }, [enabled, userId, data, dataUpdatedAt]);

  useEffect(() => {
    if (!enabled) return undefined;
    return realtimeBus.subscribe((event) => {
      if (event.type === 'socket_reconnected') void refetch().catch(() => undefined);
    });
  }, [enabled, refetch]);
}
