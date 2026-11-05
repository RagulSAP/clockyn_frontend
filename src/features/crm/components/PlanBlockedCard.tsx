import React from 'react';
import { Platform, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

export interface PlanBlockedCardProps {
  message: string;
  /** Admin: renew / view plan status. Managers and staff have no purchase action (they contact their admin). */
  onAction?: () => void;
}

/** "CRM Unavailable" lock card shown when the plan blocks the CRM feature. */
export function PlanBlockedCard({ message, onAction }: PlanBlockedCardProps) {
  const { colors } = useTheme();
  return (
    <Card testID="crm-plan-blocked">
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
        <View style={{ width: 64, height: 64, borderRadius: radii.lg, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock" size={30} color="danger" />
        </View>
        <Text variant="title2" align="center">
          CRM Unavailable
        </Text>
        <Text variant="body" color="textSecondary" align="center">
          {message}
        </Text>
        {onAction ? <Button title={Platform.OS === 'ios' ? 'View Plan Status' : 'Renew Plan'} onPress={onAction} style={{ alignSelf: 'center', marginTop: spacing.sm }} testID="crm-plan-blocked-action" /> : null}
      </View>
    </Card>
  );
}
