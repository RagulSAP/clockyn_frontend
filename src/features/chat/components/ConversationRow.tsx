import React from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, CountBadge, Icon, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';
import type { MessagePreview } from '../utils/format';

export interface ConversationRowProps {
  name: string;
  photoUrl?: string | null;
  /** Relative time of the last message. */
  time: string;
  /** Muted line under the name (role / department). */
  subtitle?: string;
  preview: MessagePreview;
  /** Shown when the conversation has no message yet. */
  emptyPreview: string;
  /** Group chats: "Name: " in front of the preview. */
  previewPrefix?: string;
  unread: number;
  /** Extra line (e.g. member count). */
  meta?: React.ReactNode;
  active?: boolean;
  onPress: () => void;
  testID?: string;
}

/** One row of the 1:1 / group conversation list. */
export function ConversationRow({ name, photoUrl, time, subtitle, preview, emptyPreview, previewPrefix, unread, meta, active, onPress, testID }: ConversationRowProps) {
  const { colors } = useTheme();
  const hasMessage = preview.kind !== 'none';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${name}${unread > 0 ? `, ${unread} unread` : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.md,
        backgroundColor: active ? colors.primarySoft : pressed ? colors.surfaceMuted : 'transparent',
      })}
    >
      <Avatar uri={photoUrl} name={name} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {name || 'Unknown'}
          </Text>
          {time ? (
            <Text variant="caption" color={unread > 0 ? 'primary' : 'textMuted'}>
              {time}
            </Text>
          ) : null}
        </View>
        {subtitle ? (
          <Text variant="caption" color="primary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {hasMessage && preview.icon ? <Icon name={preview.icon} size={14} color="textMuted" /> : null}
            <Text variant="callout" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {hasMessage ? `${previewPrefix ?? ''}${preview.text}` : emptyPreview}
            </Text>
          </View>
          {unread > 0 ? <CountBadge count={unread} /> : null}
        </View>
        {meta}
      </View>
    </Pressable>
  );
}
