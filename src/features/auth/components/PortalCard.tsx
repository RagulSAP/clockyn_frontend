import React from 'react';
import { View } from 'react-native';

import { Card, Icon, Text, type IconName } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

export type PortalCardProps = {
  icon: IconName;
  title: string;
  description: string;
  /** `primary` = admin identity, `success` = employee identity (carried through to the login screens). */
  tone: 'primary' | 'success';
  onPress: () => void;
  testID?: string;
};

/** Large tappable role card of the welcome screen. */
export function PortalCard({ icon, title, description, tone, onPress, testID }: PortalCardProps) {
  const { colors } = useTheme();
  const accent = tone === 'primary' ? colors.primary : colors.success;
  const soft = tone === 'primary' ? colors.primarySoft : colors.successSoft;
  return (
    <Card variant="outlined" onPress={onPress} testID={testID} accessibilityLabel={`${title}. ${description}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <View style={{ width: 52, height: 52, borderRadius: radii.md, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={26} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title3">{title}</Text>
          <Text variant="callout" color="textSecondary">
            {description}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color="textMuted" />
      </View>
    </Card>
  );
}
