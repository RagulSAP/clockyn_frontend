import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { haptic } from './internal/haptics';
import { Touchable } from './internal/Touchable';

/** Purely visual checkbox glyph (no press handling) — for rows that are themselves pressable. */
export function CheckboxMark({ checked, indeterminate, disabled, size = 22 }: { checked: boolean; indeterminate?: boolean; disabled?: boolean; size?: number }) {
  const { colors } = useTheme();
  const on = checked || !!indeterminate;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.xs,
        borderWidth: 2,
        borderColor: on ? colors.primary : colors.borderStrong,
        backgroundColor: on ? colors.primary : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {on ? <Icon name={indeterminate && !checked ? 'minus' : 'check'} size={size - 8} strokeWidth={3} color="onPrimary" /> : null}
    </View>
  );
}

export type CheckboxProps = {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Alias of `checked` / `onChange` for symmetry with Switch. */
  value?: boolean;
  onValueChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
  indeterminate?: boolean;
  disabled?: boolean;
  error?: string | boolean | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

export function Checkbox({
  checked,
  onChange,
  value,
  onValueChange,
  label,
  description,
  indeterminate,
  disabled,
  error,
  style,
  testID,
  accessibilityLabel,
}: CheckboxProps) {
  const isChecked = checked ?? value ?? false;
  const toggle = () => {
    if (disabled) return;
    haptic('selection');
    (onChange ?? onValueChange)?.(!isChecked);
  };
  return (
    <View style={style}>
      <Touchable
        testID={testID}
        onPress={toggle}
        disabled={disabled}
        activateOnSpace
        accessibilityRole="checkbox"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ checked: indeterminate ? 'mixed' : isChecked, disabled: !!disabled }}
        radius={radii.sm}
        hitSlop={label ? undefined : 10}
        style={{ flexDirection: 'row', alignItems: description ? 'flex-start' : 'center', gap: spacing.md, minHeight: label ? 44 : undefined, alignSelf: 'flex-start' }}
      >
        <View style={description ? { marginTop: 2 } : undefined}>
          <CheckboxMark checked={isChecked} indeterminate={indeterminate} disabled={disabled} />
        </View>
        {label ? (
          <View style={{ flexShrink: 1 }}>
            <Text variant="body" color={disabled ? 'textMuted' : 'text'}>
              {label}
            </Text>
            {description ? (
              <Text variant="caption" color="textMuted">
                {description}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Touchable>
      {typeof error === 'string' && error ? (
        <Text variant="caption" color="danger" style={{ marginTop: 2 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
