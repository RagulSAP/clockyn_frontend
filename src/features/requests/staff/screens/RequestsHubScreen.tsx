import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout';
import { Icon, LoadingOverlay, Reveal, Text, type IconName } from '@/components/ui';
import { useRefreshOnFocus } from '@/hooks';
import { currentMonthIST } from '@/lib/datetime';
import { routes, useAppRouter, type AppRoute } from '@/lib/navigation';
import { useOrgId, useSession } from '@/store/auth';
import { spacing, useTheme, type ColorTokens } from '@/theme';
import type { RequestType } from '@/types/api/requests';

import { HubStack } from '../components/HubStack';
import { orgShiftsOptions, requestCalendarOptions, usePendingByType } from '../hooks/useRequestData';
import { settleWithin } from '../utils/prefetch';

type CardKey = RequestType;

const CARDS: {
  key: CardKey;
  title: string;
  description: string;
  icon: IconName;
  route: AppRoute;
}[] = [
  { key: 'leave', title: 'Leave Request', description: 'Apply for casual, sick or earned leave', icon: 'plane', route: routes.staff.requests.leave },
  { key: 'permission', title: 'Permission', description: 'Request short time-off during work hours', icon: 'clock', route: routes.staff.requests.permission },
  { key: 'shift_change', title: 'Shift Change', description: 'Request to swap or change your shift', icon: 'arrow-up-down', route: routes.staff.requests.shiftChange },
  { key: 'device_change', title: 'Device Change', description: 'Request to register a new device for attendance', icon: 'smartphone', route: routes.staff.requests.deviceChange },
];

/** Glow colour of each stacked card (a meaning colour per request type, never decoration). */
const ACCENT: Record<CardKey, (c: ColorTokens) => string> = {
  leave: (c) => c.info,
  permission: (c) => c.warning,
  shift_change: (c) => c.success,
  device_change: (c) => c.statusHoliday,
};

/** Requests hub: four request types with pending badges. Leave / permission / shift change pre-load their data first. */
export default function RequestsHubScreen() {
  const router = useAppRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const session = useSession();
  const orgId = useOrgId();
  const userId = session?.userId ?? '';
  const { counts, query } = usePendingByType();
  const [loading, setLoading] = useState(false);

  // Badges stay current when returning from a child screen (v1 loaded them once on mount).
  useRefreshOnFocus(query.refetch);

  const open = useCallback(
    async (card: (typeof CARDS)[number]) => {
      if (loading) return;
      if (card.key === 'device_change' || !userId) {
        router.push(card.route);
        return;
      }
      setLoading(true);
      try {
        const { year, month } = currentMonthIST();
        if (card.key === 'leave' || card.key === 'permission') {
          await settleWithin(queryClient.prefetchQuery(requestCalendarOptions(userId, orgId, card.key, year, month)));
        } else {
          await settleWithin(queryClient.prefetchQuery(orgShiftsOptions(orgId)));
        }
      } finally {
        setLoading(false);
      }
      router.push(card.route);
    },
    [loading, orgId, queryClient, router, userId],
  );

  return (
    <Screen
      title="Requests"
      subtitle="Choose a request type"
      large
      maxWidth={880}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      testID="requests-hub"
    >
      <View style={{ gap: spacing.xl }}>
        <Reveal index={0}>
          <HubStack
            items={CARDS.map((c) => ({
              key: c.key,
              testID: `request-card-${c.key}`,
              icon: c.icon,
              title: c.title,
              description: c.description,
              accent: ACCENT[c.key](colors),
              badge: counts[c.key],
              onPress: () => void open(c),
            }))}
          />
        </Reveal>
        <Reveal index={1}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' }}>
            <Icon name="info" size={16} color="textMuted" />
            <Text variant="caption" color="textMuted">
              All requests are sent to your manager for approval
            </Text>
          </View>
        </Reveal>
      </View>
      <LoadingOverlay visible={loading} message="Loading..." />
    </Screen>
  );
}
