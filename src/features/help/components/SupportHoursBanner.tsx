import React from 'react';
import { View } from 'react-native';

import { Badge, Icon, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import { REPLY_TARGET_MINUTES, SUPPORT_HOURS_LABEL } from '../utils/supportHours';

export interface SupportHoursBannerProps {
  open: boolean;
  /** "Monday at 10 AM" while the team is out. */
  nextOpening: string | null;
}

/** Support hours and the promised reply time, with a live Online / Offline pill. Sits under the chat header. */
export function SupportHoursBanner({ open, nextOpening }: SupportHoursBannerProps) {
  const { colors } = useTheme();
  return (
    <View
      testID="support-hours-banner"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: open ? colors.successSoft : colors.surfaceMuted,
        }}
      >
        <Icon name="clock" size={18} color={open ? colors.success : colors.textSecondary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text variant="bodyStrong" style={{ flexShrink: 1 }}>
            Support hours
          </Text>
          <Badge label={open ? 'Online' : 'Offline'} tone={open ? 'success' : 'neutral'} size="sm" dot testID="support-status" />
        </View>
        <Text variant="caption" color="textSecondary">
          {SUPPORT_HOURS_LABEL}
        </Text>
        <Text variant="caption" color={open ? 'success' : 'textSecondary'} testID="support-hours-note">
          {open ? `We usually reply within ${REPLY_TARGET_MINUTES} minutes.` : `We're offline right now. We'll reply ${nextOpening ?? 'when we are back'}.`}
        </Text>
      </View>
    </View>
  );
}
