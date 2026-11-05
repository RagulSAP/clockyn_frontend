import React, { useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { chatApi } from '@/api';
import { IconButton, SearchBar, useConfirm, useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useUserId } from '@/store/auth';
import { spacing, useTheme } from '@/theme';
import type { ChatContact } from '@/types/api/chat';
import { useDirectConversation, usePeerInfo } from '../hooks/useDirectConversation';
import type { ChatVariant } from '../types';
import { joinParts } from '../utils/format';
import { ChatActionSheet, type ChatAction } from './ChatActionSheet';
import { ChatHeader } from './ChatHeader';
import { Composer } from './Composer';
import { ContactSheet } from './ContactSheet';
import { MessageList } from './MessageList';

/**
 * One 1:1 conversation. Admin: contact info, in-chat search and delete chat in the header menu; staff / manager:
 * the plain conversation (back only), as in the product.
 */
export function DirectConversationPane({ peerId, variant, onBack, onLeave }: { peerId: string; variant: ChatVariant; onBack?: () => void; onLeave: () => void }) {
  const { colors } = useTheme();
  const userId = useUserId();
  const orgId = useOrgId();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const peer = usePeerInfo(peerId, variant === 'admin');
  const convo = useDirectConversation(peerId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const full = variant === 'admin';

  const deleteChat = async () => {
    const ok = await confirm({
      title: 'Delete Chat',
      message: `Are you sure you want to delete this chat with ${peer.name || 'this person'}? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    try {
      await chatApi.deleteConversation(userId, peerId);
      queryClient.setQueryData<ChatContact[]>(queryKeys.chat.list(userId, orgId), (old) => (old ? old.filter((c) => c.userId !== peerId) : old));
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.list(userId, orgId) });
      queryClient.removeQueries({ queryKey: queryKeys.chat.messages(userId, peerId) });
      onLeave();
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to delete the chat'));
    }
  };

  const actions: ChatAction[] = [
    { key: 'contact', label: 'View Contact', icon: 'user', onPress: () => setContactOpen(true) },
    { key: 'search', label: 'Search', icon: 'search', onPress: () => setSearchOpen(true) },
    { key: 'delete', label: 'Delete Chat', icon: 'trash', destructive: true, onPress: () => void deleteChat() },
  ];

  const closeSearch = () => {
    setSearchOpen(false);
    setSearch('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ChatHeader
        title={peer.name}
        subtitle={joinParts(peer.roleName, peer.deptName)}
        photoUrl={peer.photoUrl}
        onBack={onBack}
        onPressTitle={full ? () => setContactOpen(true) : undefined}
        right={full ? <IconButton icon="more-vertical" variant="plain" accessibilityLabel="Conversation menu" onPress={() => setMenuOpen(true)} testID="chat-menu" /> : undefined}
      />
      {searchOpen ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface }}>
          <View style={{ flex: 1 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search in chat..." autoFocus />
          </View>
          <IconButton icon="x" variant="plain" accessibilityLabel="Close search" onPress={closeSearch} />
        </View>
      ) : null}

      <MessageList
        items={convo.items}
        isLoading={convo.isLoading}
        error={convo.error}
        onReload={() => void convo.refetch()}
        search={search}
        onRetry={(id) => void convo.retry(id)}
        onDiscard={convo.discard}
      />
      <Composer
        onSend={(t) => void convo.sendText(t)}
        onPhoto={(s) => void convo.sendPhoto(s)}
        onFile={() => void convo.sendFile()}
        uploading={convo.uploading}
        autoFocus={full}
      />

      {full ? <ChatActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} actions={actions} /> : null}
      {full ? <ContactSheet visible={contactOpen} onClose={() => setContactOpen(false)} peer={peer} /> : null}
    </View>
  );
}
