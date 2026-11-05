import React from 'react';
import { View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { Screen } from '@/components/layout';
import { formatDate } from '@/lib/datetime';
import { spacing } from '@/theme';
import type { Subscription } from '@/types/api/plans';

import { capitalize } from '../utils/planState';

import { SupportNote } from './SupportNote';

/**
 * Read-only replacement of the purchase screens on iOS (store policy: no purchase UI in the native iOS app).
 * Only reachable by deep link; the subscription overview never links here on iOS.
 */
export function PurchaseUnavailable({ title, subscription }: { title: string; subscription?: Subscription | null }) {
  return (
    <Screen title={title} testID="purchase-unavailable">
      <View style={{ gap: spacing.lg }}>
        <Card>
          <Text variant="caption" color="textMuted">
            Current Plan
          </Text>
          <Text variant="title2">{capitalize(subscription?.planName ?? '') || 'No active plan'}</Text>
          {subscription?.endDate ? <Text color="textSecondary">{`Valid till ${formatDate(subscription.endDate)}`}</Text> : null}
        </Card>
        <SupportNote />
      </View>
    </Screen>
  );
}
