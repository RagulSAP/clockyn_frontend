import React from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout';
import { Card, CountBadge, ListItem, Reveal } from '@/components/ui';
import { routes, useAppRouter } from '@/lib/navigation';
import { useLiveChatBadge } from '@/store/badges';
import { radii } from '@/theme';

import { AdminOnly } from '../components/AdminOnly';

/** "Support" tab root (admins only): FAQ, Live Chat with Clockyn support, and the Video Hub of guide videos. */
export default function SupportHubScreen() {
  return (
    <AdminOnly>
      <SupportHub />
    </AdminOnly>
  );
}

function SupportHub() {
  const router = useAppRouter();
  const unread = useLiveChatBadge();

  return (
    <Screen title="Support" subtitle="How can we help you?" hideBack edges={['top']} testID="support-hub-screen">
      <Reveal>
        <Card padding={0}>
          <View style={{ borderRadius: radii.lg, overflow: 'hidden' }}>
            <ListItem
              icon="help-circle"
              title="FAQ"
              subtitle="Answers to common questions"
              onPress={() => router.push(routes.admin.helpFaq)}
              divider
              testID="support-faq"
            />
            <ListItem
              icon="chat"
              title="Live Chat"
              subtitle="Chat with our support team"
              right={unread > 0 ? <CountBadge count={unread} testID="support-live-chat-badge" /> : undefined}
              onPress={() => router.push(routes.admin.helpLiveChat)}
              divider
              testID="support-live-chat"
            />
            <ListItem
              icon="play"
              title="Video Hub"
              subtitle="Watch step-by-step guides"
              onPress={() => router.push(routes.admin.helpVideos)}
              testID="support-video-hub"
            />
          </View>
        </Card>
      </Reveal>
    </Screen>
  );
}
