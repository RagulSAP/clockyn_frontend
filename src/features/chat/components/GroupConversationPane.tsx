import React, { useState } from 'react';
import { View } from 'react-native';

import { IconButton, SearchBar } from '@/components/ui';
import { spacing, useTheme } from '@/theme';
import { useGroupConversation } from '../hooks/useGroupConversation';
import { useGroupThemes } from '../hooks/useGroupThemes';
import type { ChatVariant } from '../types';
import { resolveChatTheme } from '../utils/chatThemes';
import { AddStaffSheet } from './AddStaffSheet';
import { ChatActionSheet, type ChatAction } from './ChatActionSheet';
import { ChatHeader } from './ChatHeader';
import { Composer } from './Composer';
import { MembersSheet } from './MembersSheet';
import { MessageList } from './MessageList';
import { ThemePickerSheet } from './ThemePickerSheet';

/**
 * One group conversation. Admin: members, add staff, in-chat search and per-group colour theme in the menu;
 * staff / manager: members and add staff. Toasts show here too (the global toast host sits above everything).
 */
export function GroupConversationPane({ groupId, variant, onBack }: { groupId: string; variant: ChatVariant; onBack?: () => void }) {
  const { colors } = useTheme();
  const convo = useGroupConversation(groupId);
  const { themeFor, setTheme } = useGroupThemes();
  const [menuOpen, setMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const admin = variant === 'admin';
  const themeIndex = admin ? themeFor(groupId) : 0;
  const theme = resolveChatTheme(themeIndex, colors);
  const name = convo.group?.name ?? '';
  const count = convo.members.length || convo.group?.memberCount || 0;

  const actions: ChatAction[] = [
    { key: 'members', label: 'View Members', icon: 'users', onPress: () => setMembersOpen(true) },
    { key: 'add', label: 'Add Staff', icon: 'user-plus', onPress: () => setAddOpen(true) },
    ...(admin
      ? ([
          { key: 'search', label: 'Search', icon: 'search', onPress: () => setSearchOpen(true) },
          { key: 'theme', label: 'Chat Theme', icon: 'palette', onPress: () => setThemeOpen(true) },
        ] satisfies ChatAction[])
      : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ChatHeader
        title={name}
        subtitle={admin ? `${count} members` : `${count} members · Tap to view`}
        onBack={onBack}
        onPressTitle={() => setMembersOpen(true)}
        right={<IconButton icon="more-vertical" variant="plain" accessibilityLabel="Group menu" onPress={() => setMenuOpen(true)} testID="chat-menu" />}
      />
      {searchOpen ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface }}>
          <View style={{ flex: 1 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search messages..." autoFocus />
          </View>
          <IconButton
            icon="x"
            variant="plain"
            accessibilityLabel="Close search"
            onPress={() => {
              setSearchOpen(false);
              setSearch('');
            }}
          />
        </View>
      ) : null}

      <MessageList
        items={convo.items}
        isLoading={convo.isLoading}
        error={convo.error}
        onReload={() => void convo.refetch()}
        search={search}
        showSender
        theme={theme}
        onRetry={(id) => void convo.retry(id)}
        onDiscard={convo.discard}
      />
      <Composer
        onSend={(t) => void convo.sendText(t)}
        onPhoto={(s) => void convo.sendPhoto(s)}
        onFile={() => void convo.sendFile()}
        uploading={convo.uploading}
        accent={theme.accent}
        inputBackground={theme.inputBackground}
      />

      <ChatActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} actions={actions} />
      <MembersSheet visible={membersOpen} onClose={() => setMembersOpen(false)} members={convo.members}
        loading={convo.membersLoading}
        error={convo.membersError}
        onRetry={() => void convo.refetchMembers()}
        groupName={name}
      />
      <AddStaffSheet visible={addOpen} onClose={() => setAddOpen(false)} members={convo.members} onAdd={convo.addMembers} />
      {admin ? (
        <ThemePickerSheet
          visible={themeOpen}
          onClose={() => setThemeOpen(false)}
          active={themeIndex}
          onPick={(i) => {
            setTheme(groupId, i);
            setThemeOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
