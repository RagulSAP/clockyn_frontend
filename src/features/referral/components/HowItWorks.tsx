import React from 'react';
import { View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import { howItWorks } from '../utils/status';

/** Three numbered steps: share, they sign up, you both save. */
export function HowItWorks({ percent }: { percent: number }) {
  const { colors } = useTheme();
  const steps = howItWorks(percent);
  return (
    <Card testID="referral-how-it-works" style={{ gap: spacing.lg }}>
      {steps.map((step, i) => (
        <View key={step.title} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }} testID={`referral-step-${i + 1}`}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: radii.pill,
              backgroundColor: colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="callout" weight="bold" color="primary">
              {String(i + 1)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{step.title}</Text>
            <Text variant="callout" color="textSecondary">
              {step.body}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}
