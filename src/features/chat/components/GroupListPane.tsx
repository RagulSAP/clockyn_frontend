import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState, ErrorState, Icon, RefreshableList, SearchBar, SkeletonList, Text } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { spacing } from '@/theme';
import { useGroupChatList } from '../hooks/useGroupChatList';
import type { ChatVariant } from '../types';
import { filterGroups } from '../utils/chatLists';
import { groupListTime, lastMessagePreview } from '../utils/format';
import { ConversationRow } from './ConversationRow';

/** The groups the user belongs to, with search. Admin gets the "Create Group" action; staff see a hint instead. */
export function GroupListPane({ variant, activeId, onOpen, onCreate }: { variant: ChatVariant; activeId?: string; onOpen: (groupId: string) => void; onCreate?: () => void }) {
  const { groups, isLoading, isRefreshing, error, refetch } = useGroupChatList();
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => filterGroups(groups, search), [groups, search]);
  const admin = variant === 'admin';

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search groups…" testID="group-search" />
      </View>
      {isLoading && groups.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonList count={6} />
        </View>
      ) : error && groups.length === 0 ? (
        <ErrorState message={getErrorMessage(error, 'Could not load your groups')} onRetry={() => void refetch()} />
      ) : (
        <RefreshableList
          testID="group-list"
          data={filtered}
          keyExtractor={(g) => g.groupId}
          refreshing={isRefreshing}
          onRefresh={() => void refetch()}
          contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title="No groups yet"
              message={admin ? 'Create a group to chat with your team' : "You'll see groups here when added by admin"}
              action={admin && onCreate ? { label: 'Create Group', onPress: onCreate, icon: 'plus' } : undefined}
            />
          }
          renderItem={({ item }) => (
            <ConversationRow
              testID={`group-row-${item.groupId}`}
              name={item.name}
              time={groupListTime(item.lastMessageAt)}
              preview={lastMessagePreview(item.lastMessage)}
              previewPrefix={item.lastMessageSender ? `${item.lastMessageSender}: ` : undefined}
              emptyPreview="Tap to start chatting"
              unread={item.unreadCount}
              active={item.groupId === activeId}
              onPress={() => onOpen(item.groupId)}
              meta={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="users" size={12} color="textMuted" />
                  <Text variant="caption" color="textMuted">
                    {`${item.memberCount} members`}
                  </Text>
                </View>
              }
            />
          )}
        />
      )}
    </View>
  );
}
