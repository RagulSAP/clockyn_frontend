import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { EmptyState, IconButton } from '@/components/ui';
import { Screen, useBreakpoint } from '@/components/layout';
import { routes, useAppRouter } from '@/lib/navigation';
import { useTheme } from '@/theme';
import { CreateGroupSheet } from '../components/CreateGroupSheet';
import { GroupConversationPane } from '../components/GroupConversationPane';
import { GroupListPane } from '../components/GroupListPane';
import type { ChatVariant } from '../types';

const SPLIT_LIST_WIDTH = 380;

/**
 * Group chat for one role area. Phone / tablet: the group list and a conversation (route param `groupId`) on top of
 * it; desktop web: list left, conversation right. Admin can create groups; staff / manager only see their groups.
 */
export function GroupChatScreen({ variant }: { variant: ChatVariant }) {
  const { colors } = useTheme();
  const router = useAppRouter();
  const { isDesktop } = useBreakpoint();
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const raw = params.groupId;
  const groupId = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  const [createOpen, setCreateOpen] = useState(false);

  const admin = variant === 'admin';
  const route = admin ? routes.admin.comms.groups : routes.staff.comms.groups;
  const open = (id: string) => (isDesktop ? router.replace(route, { groupId: id }) : router.push(route, { groupId: id }));
  const closeConversation = () => (isDesktop ? router.replace(route) : router.backOr(route));

  const createButton = admin ? (
    <IconButton icon="plus" variant="tonal" accessibilityLabel="Create group" onPress={() => setCreateOpen(true)} testID="create-group" />
  ) : undefined;
  const sheet = admin ? <CreateGroupSheet visible={createOpen} onClose={() => setCreateOpen(false)} onCreated={(g) => open(g.groupId)} /> : null;

  if (isDesktop) {
    return (
      <Screen scroll={false} padded={false} title="Group Chat" right={createButton} maxWidth={1280} keyboardAware={false}>
        <View style={{ flex: 1, flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ width: SPLIT_LIST_WIDTH, borderRightWidth: 1, borderRightColor: colors.border, paddingTop: 12 }}>
            <GroupListPane variant={variant} activeId={groupId || undefined} onOpen={open} onCreate={() => setCreateOpen(true)} />
          </View>
          <View style={{ flex: 1 }}>
            {groupId ? (
              <GroupConversationPane key={groupId} groupId={groupId} variant={variant} />
            ) : (
              <EmptyState icon="users" title="Select a group" message="Pick a group on the left to read and send messages." />
            )}
          </View>
        </View>
        {sheet}
      </Screen>
    );
  }

  if (groupId) {
    return (
      <Screen scroll={false} padded={false} header={null} edges={['top']} backgroundColor={colors.surface}>
        <GroupConversationPane key={groupId} groupId={groupId} variant={variant} onBack={closeConversation} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false} title="Group Chat" right={createButton} keyboardAware={false}>
      <GroupListPane variant={variant} onOpen={open} onCreate={() => setCreateOpen(true)} />
      {sheet}
    </Screen>
  );
}
