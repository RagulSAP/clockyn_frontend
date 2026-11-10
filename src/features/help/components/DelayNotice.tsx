import React from 'react';
import { View } from 'react-native';

import { Icon, IconButton, Text } from '@/components/ui';
import { elevation, radii, spacing, useTheme } from '@/theme';

export interface DelayNoticeProps {
  onDismiss: () => void;
}

/**
 * The calm "we are busy" note (like a status message in Teams) shown when support has not replied within the promised time.
 * A small card that floats above the composer; the close button dismisses it until the next unanswered message.
 */
export function DelayNotice({ onDismiss }: DelayNoticeProps) {
  const { colors } = useTheme();
  return (
    <View
      testID="support-delay-notice"
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        bottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingLeft: spacing.md,
        paddingRight: spacing.xs,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        ...elevation.md(colors.shadow),
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warningSoft }}>
        <Icon name="coffee" size={18} color={colors.warning} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">We&apos;re handling a lot of requests</Text>
        <Text variant="caption" color="textSecondary">
          Thank you for your patience. Our team has your message and will respond as soon as possible.
        </Text>
      </View>
      <IconButton icon="x" size="sm" variant="plain" accessibilityLabel="Dismiss notice" onPress={onDismiss} testID="support-delay-dismiss" />
    </View>
  );
}
