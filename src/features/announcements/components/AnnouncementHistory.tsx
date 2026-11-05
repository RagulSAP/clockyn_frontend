import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState, ErrorState, SearchBar, SkeletonList, useConfirm } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { spacing } from '@/theme';
import type { Announcement } from '@/types/api/announcements';
import { useDeleteAnnouncement } from '../hooks/useAdminAnnouncements';
import { audienceTag, filterAnnouncements } from '../targets';
import { AnnouncementCard } from './AnnouncementCard';

export type AnnouncementHistoryProps = {
  /** Announcements to list (already narrowed to the screen's targets). */
  items: Announcement[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  /** Search placeholder. */
  searchPlaceholder: string;
  /** Also match the branch / department name. */
  searchNames?: boolean;
  /** Empty-state hint shown when there are no announcements at all. */
  emptyHint: string;
  /** Body of the delete confirmation. */
  deleteMessage: string;
  onCompose: () => void;
};

/** History tab: search, cards with delete (confirm), skeleton / error / empty states. */
export function AnnouncementHistory({
  items,
  loading,
  error,
  onRetry,
  searchPlaceholder,
  searchNames,
  emptyHint,
  deleteMessage,
  onCompose,
}: AnnouncementHistoryProps) {
  const [search, setSearch] = useState('');
  const confirm = useConfirm();
  const del = useDeleteAnnouncement();
  const filtered = useMemo(() => filterAnnouncements(items, search, searchNames), [items, search, searchNames]);
  const searching = search.trim() !== '';

  const requestDelete = async (a: Announcement) => {
    const ok = await confirm({ title: 'Delete Announcement?', message: deleteMessage, confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
    if (!ok) return;
    try {
      await del.mutateAsync(a.id); // success toast + refresh handled by the mutation; failures already toasted
    } catch {
      /* error toast shown by useApiMutation */
    }
  };

  let body: React.ReactNode;
  if (loading && items.length === 0) {
    body = <SkeletonList count={4} variant="card" />;
  } else if (error && items.length === 0) {
    body = <ErrorState message={getErrorMessage(error, 'Failed to load announcements')} onRetry={onRetry} />;
  } else if (filtered.length === 0) {
    body = searching ? (
      <EmptyState icon="search" title="No results" message="Try a different search term" />
    ) : (
      <EmptyState icon="megaphone" title="No announcements yet" message={emptyHint} action={{ label: 'Compose', onPress: onCompose, icon: 'plus' }} />
    );
  } else {
    body = (
      <View style={{ gap: spacing.md }}>
        {filtered.map((a) => (
          <AnnouncementCard key={a.id} announcement={a} tag={audienceTag(a)} messageLines={4} onDelete={(item) => void requestDelete(item)} testID={`announcement-${a.id}`} />
        ))}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <SearchBar value={search} onChangeText={setSearch} placeholder={searchPlaceholder} testID="announcement-search" />
      {body}
    </View>
  );
}
