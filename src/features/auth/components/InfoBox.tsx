import React from 'react';
import { View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

export type InfoTone = 'info' | 'warning' | 'success';

export type InfoBoxProps = {
  tone?: InfoTone;
  icon?: IconName;
  message: string;
  testID?: string;
};

const DEFAULT_ICON: Record<InfoTone, IconName> = { info: 'info', warning: 'alert', success: 'check-circle' };

/** Tinted inline notice (device mismatch, account state, sign-out reason). */
export function InfoBox({ tone = 'info', icon, message, testID }: InfoBoxProps) {
  const { colors } = useTheme();
  const bg = tone === 'warning' ? colors.warningSoft : tone === 'success' ? colors.successSoft : colors.infoSoft;
  const fg = tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : colors.info;
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: bg }}
    >
      <Icon name={icon ?? DEFAULT_ICON[tone]} size={18} color={fg} />
      <Text variant="callout" color="text" style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}
