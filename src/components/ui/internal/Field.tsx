import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing, useTheme, type ColorTokens } from '@/theme';
import { Icon } from '../Icon';
import { Text } from '../Text';

export type FieldFrameProps = {
  label?: string;
  required?: boolean;
  error?: string | boolean | null;
  hint?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Label above, control in the middle, error/hint below. Shared by every form control. */
export function FieldFrame({ label, required, error, hint, children, style }: FieldFrameProps) {
  const errorText = typeof error === 'string' ? error : '';
  return (
    <View style={[{ alignSelf: 'stretch' }, style]}>
      {label ? (
        <Text variant="callout" weight="semibold" color="textSecondary" style={{ marginBottom: spacing.xs + 2 }}>
          {label}
          {required ? <Text variant="callout" color="danger">{' *'}</Text> : null}
        </Text>
      ) : null}
      {children}
      {errorText ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs + 1 }} accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={14} color="danger" />
          <Text variant="caption" color="danger" style={{ flexShrink: 1 }}>
            {errorText}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs + 1 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export type FieldBoxState = { focused?: boolean; error?: boolean; disabled?: boolean; hovered?: boolean };

/** Border/background style for the control container, driven by interaction state. */
export function fieldBoxStyle(colors: ColorTokens, { focused, error, disabled, hovered }: FieldBoxState): ViewStyle {
  return {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: error ? colors.danger : focused ? colors.primary : hovered ? colors.textMuted : colors.borderStrong,
    backgroundColor: disabled ? colors.surfaceMuted : colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md + 2,
    gap: spacing.sm,
    opacity: disabled ? 0.65 : 1,
  };
}

export function useFieldBoxStyle(state: FieldBoxState): ViewStyle {
  const { colors } = useTheme();
  return fieldBoxStyle(colors, state);
}
