import React from 'react';
import { View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';
import type { ChatItem } from '../types';

/** Which glyph an own message shows: pending clock, failed alert, single tick (sent) or double tick (read). */
export function statusIconFor(item: Pick<ChatItem, 'state' | 'isRead'>): 'clock' | 'alert-circle' | 'check' | 'check-check' {
  if (item.state === 'sending') return 'clock';
  if (item.state === 'failed') return 'alert-circle';
  return item.isRead ? 'check-check' : 'check';
}

/** Time + delivery state of a bubble (ticks only on own messages). `meta` is the muted colour of the bubble; `readColor` overrides the mint read ticks where mint would not contrast (light bubbles). */
export function MessageStatus({ item, time, meta, readColor }: { item: ChatItem; time: string; meta: string; readColor?: string }) {
  const { colors } = useTheme();
  const icon = item.fromMe ? statusIconFor(item) : null;
  const iconColor = icon === 'check-check' ? (readColor ?? colors.accent) : icon === 'alert-circle' ? colors.danger : meta;
  const label =
    item.state === 'sending' ? 'Sending' : item.state === 'failed' ? 'Failed to send' : item.fromMe ? (item.isRead ? 'Read' : 'Sent') : undefined;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-end' }}>
      {time ? (
        <Text variant="micro" color={meta}>
          {time}
        </Text>
      ) : null}
      {icon ? (
        <View accessible accessibilityLabel={label}>
          <Icon name={icon} size={14} color={iconColor} />
        </View>
      ) : null}
    </View>
  );
}
