import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing, useTheme } from '@/theme';
import { IconButton, Text } from '@/components/ui';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Shows a back button when provided. */
  onBack?: () => void;
  /** Trailing actions (IconButtons, Buttons…). */
  right?: React.ReactNode;
  /** Large left-aligned title under the action row (tab roots / dashboards). */
  large?: boolean;
  /** Hairline under the header. */
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ScreenHeader({ title, subtitle, onBack, right, large, bordered, style, testID }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const back = onBack ? <IconButton icon="arrow-left" variant="tonal" accessibilityLabel="Go back" onPress={onBack} testID={testID ? `${testID}-back` : undefined} /> : null;

  if (large) {
    return (
      <View
        testID={testID}
        style={[{ paddingTop: spacing.sm, paddingBottom: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.sm }, bordered ? { borderBottomWidth: 1, borderBottomColor: colors.border } : null, style]}
      >
        {back || right ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            <View>{back}</View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>{right}</View>
          </View>
        ) : null}
        <View>
          <Text variant="title1" numberOfLines={2} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" color="textSecondary" numberOfLines={2} style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View
      testID={testID}
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
        bordered ? { borderBottomWidth: 1, borderBottomColor: colors.border } : null,
        style,
      ]}
    >
      {back}
      <View style={{ flex: 1 }}>
        <Text variant="title3" numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>{right}</View> : null}
    </View>
  );
}
