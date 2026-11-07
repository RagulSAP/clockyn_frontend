import React from 'react';
import { View } from 'react-native';

import { Screen, variantForRole } from '@/components/layout';
import { Badge, Card, ListItem, Reveal, useToast } from '@/components/ui';
import { routes, useAppRouter } from '@/lib/navigation';
import { useRole } from '@/store/auth';
import { radii } from '@/theme';

/** "Support" tab root: FAQ and WhatsApp chat (coming soon) and the Video Hub of guide videos. */
export default function SupportHubScreen() {
  const router = useAppRouter();
  const toast = useToast();
  const videosRoute = variantForRole(useRole()) === 'admin' ? routes.admin.helpVideos : routes.staff.helpVideos;

  return (
    <Screen title="Support" subtitle="How can we help you?" hideBack edges={['top']} testID="support-hub-screen">
      <Reveal>
        <Card padding={0}>
          <View style={{ borderRadius: radii.lg, overflow: 'hidden' }}>
            <ListItem
              icon="help-circle"
              title="FAQ"
              subtitle="Answers to common questions"
              right={<Badge label="Soon" tone="info" size="sm" />}
              onPress={() => toast.info('FAQ is coming soon')}
              divider
              testID="support-faq"
            />
            <ListItem
              icon="chat"
              title="WhatsApp Chat"
              subtitle="Chat with our support team"
              right={<Badge label="Soon" tone="info" size="sm" />}
              onPress={() => toast.info('WhatsApp chat is coming soon')}
              divider
              testID="support-whatsapp"
            />
            <ListItem
              icon="play"
              title="Video Hub"
              subtitle="Watch step-by-step guides"
              onPress={() => router.push(videosRoute)}
              testID="support-video-hub"
            />
          </View>
        </Card>
      </Reveal>
    </Screen>
  );
}
