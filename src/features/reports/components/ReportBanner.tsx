import React from 'react';
import { View } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { Icon, Text } from '@/components/ui';

/** Inline notice for partial failures / data limitations (never blocks the report). */
export function ReportBanner({ message, tone = 'warning', testID }: { message: string; tone?: 'warning' | 'info'; testID?: string }) {
  const { colors } = useTheme();
  const bg = tone === 'warning' ? colors.warningSoft : colors.infoSoft;
  const fg = tone === 'warning' ? colors.warning : colors.info;
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: bg, alignItems: 'flex-start' }}
    >
      <Icon name={tone === 'warning' ? 'alert' : 'info'} size={18} color={fg} />
      <Text variant="callout" color="text" style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}

export function ReportBanners({ messages }: { messages: readonly string[] }) {
  if (messages.length === 0) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      {messages.map((m) => (
        <ReportBanner key={m} message={m} />
      ))}
    </View>
  );
}
