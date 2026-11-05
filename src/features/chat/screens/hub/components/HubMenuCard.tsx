import React from 'react';
import { View } from 'react-native';

import { Card, CountBadge, Icon, Text, toneColors } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';
import type { HubItem } from '../hubLogic';

export type HubMenuCardProps = {
  item: HubItem;
  /** Unread count (0 hides the badge; > 99 reads "99+"). */
  count: number;
  onPress: () => void;
};

/** One channel card of the hub: tinted icon tile, title, description, unread badge and a chevron. */
export function HubMenuCard({ item, count, onPress }: HubMenuCardProps) {
  const { colors } = useTheme();
  const tone = toneColors(item.tone, colors);
  const label = count > 0 ? `${item.title}, ${count > 99 ? '99+' : count} unread` : item.title;

  return (
    <Card onPress={onPress} accessibilityLabel={label} testID={`hub-card-${item.key}`} padding={spacing.lg}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <View style={{ width: 52, height: 52, borderRadius: radii.md, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={item.icon} size={26} color={tone.fg} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title3" numberOfLines={2}>
            {item.title}
          </Text>
          <Text variant="callout" color="textSecondary" numberOfLines={2}>
            {item.description}
          </Text>
        </View>
        <CountBadge count={count} testID={`hub-badge-${item.key}`} />
        <Icon name="chevron-right" size={20} color="textMuted" />
      </View>
    </Card>
  );
}
