import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout';
import { Icon, LoadingOverlay, Reveal, Text, type IconName } from '@/components/ui';
import { todayIST } from '@/lib/datetime';
import { routes, useAppRouter, type AppRoute } from '@/lib/navigation';
import { useSession } from '@/store/auth';
import { spacing, useTheme, type ColorTokens } from '@/theme';

import { HubStack } from '../components/HubStack';
import { expenseListOptions, odometerOptions } from '../hooks/useExpenseData';
import { settleWithin } from '../utils/prefetch';

type CardKey = 'odo' | 'travel' | 'bills';

const CARDS: { key: CardKey; title: string; description: string; icon: IconName; route: AppRoute }[] = [
  { key: 'odo', title: 'ODO Meter Reading', description: 'Log daily vehicle odometer readings', icon: 'route', route: routes.staff.expenses.odometer },
  { key: 'travel', title: 'Travel Tickets', description: 'Upload travel tickets & transport bills', icon: 'bus', route: routes.staff.expenses.travel },
  { key: 'bills', title: 'Other Bills', description: 'Submit invoices & miscellaneous expenses', icon: 'receipt', route: routes.staff.expenses.bills },
];

/** Glow colour of each stacked card (a meaning colour per expense type, never decoration). */
const ACCENT: Record<CardKey, (c: ColorTokens) => string> = {
  odo: (c) => c.info,
  travel: (c) => c.warning,
  bills: (c) => c.statusHoliday,
};

/** Expenses hub: three expense types; each card pre-loads today's records, then opens (always opens, even offline). */
export default function ExpensesHubScreen() {
  const router = useAppRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const userId = useSession()?.userId ?? '';
  const [loading, setLoading] = useState(false);

  const open = useCallback(
    async (card: (typeof CARDS)[number]) => {
      if (loading) return;
      if (userId) {
        setLoading(true);
        try {
          const today = todayIST();
          const work =
            card.key === 'odo'
              ? queryClient.prefetchQuery(odometerOptions(userId, today))
              : queryClient.prefetchQuery(expenseListOptions(userId, card.key === 'travel' ? 'travel' : 'bill', today));
          await settleWithin(work);
        } finally {
          setLoading(false);
        }
      }
      router.push(card.route);
    },
    [loading, queryClient, router, userId],
  );

  return (
    <Screen title="Expenses" subtitle="Track & submit your expenses" large maxWidth={880} testID="expenses-hub">
      <View style={{ gap: spacing.xl }}>
        <Reveal index={0}>
          <HubStack
            items={CARDS.map((c) => ({
              key: c.key,
              testID: `expense-card-${c.key}`,
              icon: c.icon,
              title: c.title,
              description: c.description,
              accent: ACCENT[c.key](colors),
              onPress: () => void open(c),
            }))}
          />
        </Reveal>
        <Reveal index={1}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' }}>
            <Icon name="info" size={16} color="textMuted" />
            <Text variant="caption" color="textMuted">
              Expenses are submitted for manager approval
            </Text>
          </View>
        </Reveal>
      </View>
      <LoadingOverlay visible={loading} message="Loading..." />
    </Screen>
  );
}
