import React from 'react';
import { View } from 'react-native';

import { GradientView, Icon, Reveal, Skeleton, Text } from '@/components/ui';
import { ResponsiveRow, Screen } from '@/components/layout';
import { useAppRouter } from '@/lib/navigation';
import { useSession } from '@/store/auth';
import { radii, spacing, useTheme } from '@/theme';
import { ChatGatePanel } from './components/ChatGatePanel';
import { HubHeader } from './components/HubHeader';
import { HubMenuCard } from './components/HubMenuCard';
import { useChatGate, useChatUnreadSync, useCompanyLogo, useHubCounts } from './hooks/useChatHub';
import { ADMIN_HUB_ITEMS, badgeFor } from './hubLogic';

const HERO_TILES = [
  { icon: 'chat', label: 'Messages' },
  { icon: 'users', label: 'Groups' },
  { icon: 'megaphone', label: 'Announce' },
] as const;

/** Admin chat hub (tab root): Individual, Group, Announcement, Branch & Dept. Plan-gated (chat). */
export default function AdminChatHubScreen() {
  const router = useAppRouter();
  const { colors } = useTheme();
  const session = useSession();
  const gate = useChatGate('admin');
  const open = gate.kind === 'open';
  useChatUnreadSync(open);
  const counts = useHubCounts();
  const logoUrl = useCompanyLogo(true);

  return (
    <Screen
      hideBack
      edges={['top']}
      header={<HubHeader title={session?.orgName || 'Chat'} subtitle="Team Communication" logoUrl={logoUrl} />}
      testID="admin-chat-hub"
    >
      {gate.kind === 'checking' ? (
        <View style={{ gap: spacing.md }} testID="hub-checking">
          <Skeleton height={120} radius={radii.lg} />
          <Skeleton height={84} radius={radii.lg} />
          <Skeleton height={84} radius={radii.lg} />
        </View>
      ) : null}

      {gate.kind === 'blocked' ? (
        <ChatGatePanel
          title={gate.title}
          message={gate.message}
          cta={gate.cta ? { label: gate.cta.label, onPress: () => router.push(gate.cta!.route) } : null}
        />
      ) : null}

      {open ? (
        <View style={{ gap: spacing.lg }}>
          <Reveal index={0}>
          <GradientView style={{ borderRadius: radii.lg, padding: spacing.xl, gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="chats" size={28} color="onGradient" />
              <View style={{ flex: 1 }}>
                <Text variant="title2" color="onGradient">
                  Communicate
                </Text>
                <Text variant="callout" color="onGradient" style={{ opacity: 0.85 }}>
                  Stay connected with your team
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {HERO_TILES.map((t) => (
                <View key={t.label} style={{ flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface }}>
                  <Icon name={t.icon} size={20} color="primary" />
                  <Text variant="caption" weight="semibold">
                    {t.label}
                  </Text>
                </View>
              ))}
            </View>
          </GradientView>
          </Reveal>

          <Reveal index={1}>
          <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }} gap={spacing.md}>
            {ADMIN_HUB_ITEMS.map((item) => (
              <HubMenuCard key={item.key} item={item} count={badgeFor(item, counts)} onPress={() => router.push(item.route)} />
            ))}
          </ResponsiveRow>
          </Reveal>
        </View>
      ) : null}
    </Screen>
  );
}
