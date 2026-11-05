import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import { Icon, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

export type HubHeaderProps = {
  title: string;
  subtitle: string;
  /** Company logo; a chat icon is shown when missing. */
  logoUrl?: string;
};

/** Tab-root header: logo (or icon tile), large title and subtitle. No back button (this is a tab root). */
export function HubHeader({ title, subtitle, logoUrl }: HubHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={{ width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }} contentFit="cover" accessibilityLabel="Company logo" />
      ) : (
        <View style={{ width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chats" size={24} color="primary" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text variant="title1" numberOfLines={1} accessibilityRole="header" testID="hub-title">
          {title}
        </Text>
        <Text variant="callout" color="textMuted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
