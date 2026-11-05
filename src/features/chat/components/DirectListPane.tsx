import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Avatar, Badge, Card, EmptyState, ErrorState, ListItem, RefreshableList, SearchBar, SkeletonList } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { useUserId } from '@/store/auth';
import { spacing } from '@/theme';
import type { ChatSearchResult } from '@/types/api/chat';
import { useChatSearch } from '../hooks/useChatSearch';
import { useDirectChatList } from '../hooks/useDirectChatList';
import { rememberPeer } from '../hooks/useDirectConversation';
import type { ChatVariant } from '../types';
import { chatContactFromSearch, filterChatContacts } from '../utils/chatLists';
import { directListTime, joinParts, lastMessagePreview } from '../utils/format';
import { ConversationRow } from './ConversationRow';

/** The 1:1 conversation list with the staff search (admin: backend search, staff: local search, admin pinned first). */
export function DirectListPane({ variant, activeId, onOpen }: { variant: ChatVariant; activeId?: string; onOpen: (userId: string) => void }) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { contacts, serverList, adminOnly, isLoading, isRefreshing, error, refetch } = useDirectChatList(variant);
  const [search, setSearch] = useState('');
  const { results } = useChatSearch(variant, search);

  const filtered = useMemo(
    () => filterChatContacts(contacts, { query: search, adminOnly, matchBranch: variant === 'admin' }),
    [contacts, search, adminOnly, variant],
  );
  const searching = search.trim() !== '';
  const showResults = searching && results.length > 0;

  const openFromSearch = useCallback(
    (r: ChatSearchResult) => {
      rememberPeer(queryClient, userId, chatContactFromSearch(r));
      setSearch('');
      onOpen(r.userId);
    },
    [queryClient, userId, onOpen],
  );

  const hint = variant === 'admin' ? 'Search for a staff member to start chatting' : 'Search for someone to start chatting';

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, branch, department…" testID="chat-search" />
        {showResults ? (
          <Card padding={0} testID="chat-search-results">
            <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {results.map((r, i) => (
                <ListItem
                  key={r.userId}
                  testID={`search-result-${r.userId}`}
                  title={r.name}
                  subtitle={joinParts(r.roleName, r.deptName, r.branchName)}
                  left={<Avatar uri={r.photoUrl} name={r.name} size={40} />}
                  right={serverList.some((c) => c.userId === r.userId) ? undefined : <Badge label="New" tone="info" size="sm" />}
                  divider={i < results.length - 1}
                  onPress={() => openFromSearch(r)}
                />
              ))}
            </ScrollView>
          </Card>
        ) : null}
      </View>

      {isLoading && contacts.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonList count={6} />
        </View>
      ) : error && contacts.length === 0 ? (
        <ErrorState message={getErrorMessage(error, 'Could not load your chats')} onRetry={() => void refetch()} />
      ) : (
        <RefreshableList
          testID="chat-list"
          data={filtered}
          keyExtractor={(c) => c.userId}
          refreshing={isRefreshing}
          onRefresh={() => void refetch()}
          contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              icon="chat"
              title={searching ? 'No matching chats' : 'No chats yet'}
              message={hint}
            />
          }
          renderItem={({ item }) => (
            <ConversationRow
              testID={`chat-row-${item.userId}`}
              name={item.name}
              photoUrl={item.photoUrl}
              time={directListTime(item.lastMessageAt)}
              subtitle={item.roleName || item.deptName}
              preview={lastMessagePreview(item.lastMessage, item.lastMessageType)}
              emptyPreview="Tap to start chatting"
              unread={item.unreadCount}
              active={item.userId === activeId}
              onPress={() => onOpen(item.userId)}
            />
          )}
        />
      )}
    </View>
  );
}
