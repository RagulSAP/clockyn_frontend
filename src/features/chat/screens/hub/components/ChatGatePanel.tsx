import React from 'react';
import { View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

export type ChatGatePanelProps = {
  title: string;
  message: string;
  /** Admin only: renew / view the plan. Staff are told to contact their admin (no action). */
  cta: { label: string; onPress: () => void } | null;
};

/** "Feature unavailable" panel shown instead of the menu when the plan blocks chat. */
export function ChatGatePanel({ title, message, cta }: ChatGatePanelProps) {
  const { colors } = useTheme();
  return (
    <Card testID="chat-gate-panel" padding={spacing.xxl}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 64, height: 64, borderRadius: radii.lg, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock" size={30} color="warning" />
        </View>
        <Text variant="title2" align="center" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="body" color="textSecondary" align="center" testID="chat-gate-message">
          {message}
        </Text>
        {cta ? <Button title={cta.label} onPress={cta.onPress} style={{ marginTop: spacing.sm, alignSelf: 'center' }} testID="chat-gate-cta" /> : null}
      </View>
    </Card>
  );
}
