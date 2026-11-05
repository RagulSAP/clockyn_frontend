import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/ui';
import { Screen, useBreakpoint } from '@/components/layout';
import { useSession } from '@/store/auth';
import { useAppRouter, routes } from '@/lib/navigation';
import { useTheme } from '@/theme';
import { DirectConversationPane } from '../components/DirectConversationPane';
import { DirectListPane } from '../components/DirectListPane';
import type { ChatVariant } from '../types';

const SPLIT_LIST_WIDTH = 380;

/**
 * Individual chat for one role area. Phone / tablet: the list, and a conversation (route param `userId`) on top of
 * it. Desktop web: list on the left, conversation on the right (selecting replaces the param, no stack growth).
 */
export function DirectChatScreen({ variant }: { variant: ChatVariant }) {
  const { colors } = useTheme();
  const router = useAppRouter();
  const { isDesktop } = useBreakpoint();
  const session = useSession();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const raw = params.userId;
  const peerId = (Array.isArray(raw) ? raw[0] : raw) ?? '';

  const route = variant === 'admin' ? routes.admin.comms.direct : routes.staff.comms.direct;
  const open = (userId: string) => (isDesktop ? router.replace(route, { userId }) : router.push(route, { userId }));
  const closeConversation = () => (isDesktop ? router.replace(route) : router.backOr(route));

  if (isDesktop) {
    return (
      <Screen scroll={false} padded={false} title="Individual Chat" subtitle={session?.orgName} maxWidth={1280} keyboardAware={false}>
        <View style={{ flex: 1, flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ width: SPLIT_LIST_WIDTH, borderRightWidth: 1, borderRightColor: colors.border, paddingTop: 12 }}>
            <DirectListPane variant={variant} activeId={peerId || undefined} onOpen={open} />
          </View>
          <View style={{ flex: 1 }}>
            {peerId ? (
              <DirectConversationPane key={peerId} peerId={peerId} variant={variant} onLeave={closeConversation} />
            ) : (
              <EmptyState icon="chat" title="Select a conversation" message="Pick a chat on the left or search for someone to start one." />
            )}
          </View>
        </View>
      </Screen>
    );
  }

  if (peerId) {
    return (
      <Screen scroll={false} padded={false} header={null} edges={['top']} backgroundColor={colors.surface}>
        <DirectConversationPane key={peerId} peerId={peerId} variant={variant} onBack={closeConversation} onLeave={closeConversation} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false} title="Individual Chat" subtitle={variant === 'admin' ? session?.orgName : undefined} keyboardAware={false}>
      <DirectListPane variant={variant} onOpen={open} />
    </Screen>
  );
}
