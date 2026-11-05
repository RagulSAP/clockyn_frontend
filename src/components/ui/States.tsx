import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing, useTheme } from '@/theme';
import { Button } from './Button';
import { GradientView } from './GradientView';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';

export type EmptyStateProps = {
  icon?: IconName;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
  /** Smaller paddings, for use inside cards and sheets. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function EmptyState({ icon = 'inbox', title, message, action, compact, style, testID }: EmptyStateProps) {
  const { colors } = useTheme();
  const size = compact ? 56 : 76;
  return (
    <View
      testID={testID}
      style={[{ alignItems: 'center', justifyContent: 'center', padding: compact ? spacing.xl : spacing.xxxl, gap: spacing.md }, style]}
    >
      <View style={{ width: size + 24, height: size + 24, borderRadius: (size + 24) / 2, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <GradientView style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={size * 0.42} color="onGradient" />
        </GradientView>
      </View>
      <Text variant={compact ? 'title3' : 'title2'} align="center" accessibilityRole="header">
        {title}
      </Text>
      {message ? (
        <Text variant="body" color="textSecondary" align="center" style={{ maxWidth: 360 }}>
          {message}
        </Text>
      ) : null}
      {action ? (
        <View style={{ marginTop: spacing.sm }}>
          <Button title={action.label} onPress={action.onPress} icon={action.icon} />
        </View>
      ) : null}
    </View>
  );
}

export type ErrorStateProps = {
  message: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ErrorState({ message, title = 'Something went wrong', onRetry, retryLabel = 'Try again', compact, style, testID }: ErrorStateProps) {
  const { colors } = useTheme();
  const size = compact ? 56 : 72;
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[{ alignItems: 'center', justifyContent: 'center', padding: compact ? spacing.xl : spacing.xxxl, gap: spacing.md }, style]}
    >
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="alert-circle" size={size * 0.46} color="danger" />
      </View>
      <Text variant={compact ? 'title3' : 'title2'} align="center">
        {title}
      </Text>
      <Text variant="body" color="textSecondary" align="center" style={{ maxWidth: 360 }}>
        {message}
      </Text>
      {onRetry ? (
        <View style={{ marginTop: spacing.sm }}>
          <Button title={retryLabel} onPress={onRetry} variant="secondary" icon="refresh" />
        </View>
      ) : null}
    </View>
  );
}
