import React from 'react';
import { View } from 'react-native';

import { Screen, useBreakpoint } from '@/components/layout';
import { Text } from '@/components/ui';
import { ChatHeader } from '@/features/chat/components/ChatHeader';
import { Composer } from '@/features/chat/components/Composer';
import { MessageList } from '@/features/chat/components/MessageList';
import { routes, useAppRouter } from '@/lib/navigation';
import { spacing, useTheme } from '@/theme';

import { AdminOnly } from '../components/AdminOnly';
import { DelayNotice } from '../components/DelayNotice';
import { SupportHoursBanner } from '../components/SupportHoursBanner';
import { useLiveChat } from '../hooks/useLiveChat';
import { useSupportStatus } from '../hooks/useSupportStatus';

export const LIVE_CHAT_TITLE = 'Live Chat';
export const LIVE_CHAT_SUBTITLE = 'Clockyn Support';
export const LIVE_CHAT_EMPTY_TITLE = 'Start a conversation';
export const LIVE_CHAT_EMPTY_MESSAGE = 'Our support team will reply here.';
export const LIVE_CHAT_CLOSED_BANNER = 'This conversation was closed by support. Send a message to reopen it.';

/**
 * Live Chat (admins only): the organisation's conversation with Clockyn support. Phone: full screen with its own
 * header and back button; wide web: the same pane inside the standard page frame. Uses the individual chat's message
 * list, bubbles and composer.
 */
export default function LiveChatScreen() {
  return (
    <AdminOnly>
      <LiveChat />
    </AdminOnly>
  );
}

function LiveChat() {
  const { colors } = useTheme();
  const router = useAppRouter();
  const { isDesktop } = useBreakpoint();
  const leave = () => router.backOr(routes.admin.help);

  if (isDesktop) {
    return (
      <Screen scroll={false} padded={false} title={LIVE_CHAT_TITLE} subtitle={LIVE_CHAT_SUBTITLE} maxWidth={860} keyboardAware={false} testID="live-chat-screen">
        <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: colors.border }}>
          <LiveChatPane />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false} header={null} edges={['top']} backgroundColor={colors.surface} testID="live-chat-screen">
      <ChatHeader title={LIVE_CHAT_TITLE} subtitle={LIVE_CHAT_SUBTITLE} onBack={leave} />
      <LiveChatPane />
    </Screen>
  );
}

function LiveChatPane() {
  const { colors } = useTheme();
  const convo = useLiveChat();
  const support = useSupportStatus(convo.items);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SupportHoursBanner open={support.open} nextOpening={support.nextOpening} />
      <View style={{ flex: 1 }}>
        <MessageList
          items={convo.items}
          isLoading={convo.isLoading}
          error={convo.error}
          onReload={() => void convo.refetch()}
          showSender
          onRetry={(id) => void convo.retry(id)}
          onDiscard={convo.discard}
          emptyTitle={LIVE_CHAT_EMPTY_TITLE}
          emptyMessage={LIVE_CHAT_EMPTY_MESSAGE}
        />
        {support.showDelayNotice ? <DelayNotice onDismiss={support.dismissDelayNotice} /> : null}
      </View>
      {convo.status === 'closed' ? (
        <View
          testID="live-chat-closed-banner"
          style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.warningSoft, borderTopWidth: 1, borderTopColor: colors.border }}
        >
          <Text variant="caption" color="warning" align="center">
            {LIVE_CHAT_CLOSED_BANNER}
          </Text>
        </View>
      ) : null}
      <Composer
        onSend={(t) => void convo.sendText(t)}
        onAttach={(a) => void convo.sendAttachment(a)}
        uploading={convo.uploading}
        autoFocus
      />
    </View>
  );
}
