import React from 'react';
import { View } from 'react-native';

import { Reveal, Skeleton, Text } from '@/components/ui';
import { ResponsiveRow, Screen } from '@/components/layout';
import { useAnnouncementUnreadSync } from '@/features/announcements';
import { useAppRouter } from '@/lib/navigation';
import { radii, spacing } from '@/theme';
import { ChatGatePanel } from './components/ChatGatePanel';
import { HubHeader } from './components/HubHeader';
import { HubMenuCard } from './components/HubMenuCard';
import { useChatGate, useChatUnreadSync, useHubCounts, useStaffOrgLogo } from './hooks/useChatHub';
import { badgeFor, STAFF_HUB_ITEMS } from './hubLogic';

/**
 * Staff / manager chat hub (tab root): Individual, Group, Broadcast, Targeted with unread badges.
 * Plan-gated (chat): when blocked the employee is told to contact their admin (no purchase action).
 */
export default function StaffChatHubScreen() {
  const router = useAppRouter();
  const gate = useChatGate('staff');
  const open = gate.kind === 'open';
  useChatUnreadSync(open);
  useAnnouncementUnreadSync(); // keeps the Broadcast / Targeted counters current (the app bootstrap mounts it too)
  const counts = useHubCounts();
  const logoUrl = useStaffOrgLogo();

  return (
    <Screen hideBack edges={['top']} header={<HubHeader title="Chat" subtitle="Team Communication" logoUrl={logoUrl} />} testID="staff-chat-hub">
      {gate.kind === 'checking' ? (
        <View style={{ gap: spacing.md }} testID="hub-checking">
          <Skeleton height={84} radius={radii.lg} />
          <Skeleton height={84} radius={radii.lg} />
          <Skeleton height={84} radius={radii.lg} />
          <Skeleton height={84} radius={radii.lg} />
        </View>
      ) : null}

      {gate.kind === 'blocked' ? <ChatGatePanel title={gate.title} message={gate.message} cta={null} /> : null}

      {open ? (
        <Reveal style={{ gap: spacing.lg }}>
          <Text variant="micro" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Choose a channel
          </Text>
          <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }} gap={spacing.md}>
            {STAFF_HUB_ITEMS.map((item) => (
              <HubMenuCard key={item.key} item={item} count={badgeFor(item, counts)} onPress={() => router.push(item.route)} />
            ))}
          </ResponsiveRow>
        </Reveal>
      ) : null}
    </Screen>
  );
}
