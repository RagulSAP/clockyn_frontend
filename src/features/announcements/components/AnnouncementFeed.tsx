import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState, ErrorState, SearchBar, SkeletonList } from '@/components/ui';
import { Screen } from '@/components/layout';
import { useRefreshOnFocus } from '@/hooks';
import { getErrorMessage } from '@/lib/api/errors';
import { spacing } from '@/theme';
import { useAnnouncementViewer, useEmployeeAnnouncements } from '../hooks/useEmployeeAnnouncements';
import { feedItems, markFeedRead, type AnnouncementFeedKind } from '../seenIds';
import { audienceTag, filterAnnouncements } from '../targets';
import { AnnouncementCard } from './AnnouncementCard';

const COPY: Record<AnnouncementFeedKind, { title: string; emptyHint: string }> = {
  broadcast: { title: 'Broadcast', emptyHint: 'Announcements from your admin will appear here' },
  targeted: { title: 'Targeted', emptyHint: 'Branch or department announcements will appear here' },
};

/**
 * Read-only staff feed (broadcast = all / selected staff, targeted = branch / department).
 * Opening it marks what is on screen as seen (per-user ids, merged) and refreshes the unread badges; it refetches on
 * focus, on pull-to-refresh and whenever a realtime announcement event invalidates the list.
 */
export function AnnouncementFeed({ feed }: { feed: AnnouncementFeedKind }) {
  const copy = COPY[feed];
  const { userId } = useAnnouncementViewer();
  const q = useEmployeeAnnouncements();
  const [search, setSearch] = useState('');

  useRefreshOnFocus(q.refetch);

  const items = useMemo(() => feedItems(q.data ?? [], feed), [q.data, feed]);
  const filtered = useMemo(() => filterAnnouncements(items, search, feed === 'targeted'), [items, search, feed]);
  const searching = search.trim() !== '';

  // Mark the displayed list as seen after every SUCCESSFUL load (also covers items that arrive while the feed is open).
  useEffect(() => {
    if (!q.data || userId === '') return;
    void markFeedRead(feed, userId, q.data).catch(() => undefined);
  }, [feed, userId, q.data, q.dataUpdatedAt]);

  let body: React.ReactNode;
  if (q.isLoading) {
    body = <SkeletonList count={4} variant="card" />;
  } else if (q.isError && !q.data) {
    body = <ErrorState message={getErrorMessage(q.error, 'Failed to load announcements')} onRetry={() => void q.refetch()} />;
  } else if (filtered.length === 0) {
    body = (
      <EmptyState
        icon={feed === 'broadcast' ? 'megaphone' : 'building'}
        title={searching ? 'No results' : 'No announcements yet'}
        message={searching ? 'Try a different search term' : copy.emptyHint}
      />
    );
  } else {
    body = (
      <View style={{ gap: spacing.md }}>
        {filtered.map((a) => {
          const tag = audienceTag(a, { feed });
          return (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              tag={tag}
              icon={feed === 'broadcast' ? 'megaphone' : tag.icon}
              testID={`announcement-${a.id}`}
            />
          );
        })}
      </View>
    );
  }

  return (
    <Screen title={copy.title} large refreshing={q.isRefetching} onRefresh={() => void q.refetch()} testID={`${feed}-feed`}>
      <View style={{ gap: spacing.lg }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search announcements…" testID="announcement-search" />
        {body}
      </View>
    </Screen>
  );
}
