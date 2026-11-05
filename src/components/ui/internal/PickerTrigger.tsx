import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Text } from '../Text';
import { FieldFrame, fieldBoxStyle } from './Field';
import { Touchable } from './Touchable';

export type PickerTriggerProps = {
  label?: string;
  required?: boolean;
  error?: string | boolean | null;
  hint?: string;
  disabled?: boolean;
  onPress: () => void;
  /** Currently displayed value; falls back to `placeholder` when empty. */
  text?: string;
  placeholder?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  open?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

/** A button that looks like a text field; opens a picker sheet / native dialog. */
export function PickerTrigger({
  label,
  required,
  error,
  hint,
  disabled,
  onPress,
  text,
  placeholder = 'Select',
  leftIcon,
  rightIcon = 'chevron-down',
  open,
  style,
  testID,
  accessibilityLabel,
}: PickerTriggerProps) {
  const { colors } = useTheme();
  const hasValue = !!text;
  return (
    <FieldFrame label={label} required={required} error={error} hint={hint} style={style}>
      <Touchable
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `${label ?? placeholder}: ${hasValue ? text : 'not set'}`}
        accessibilityState={{ disabled: !!disabled, expanded: !!open }}
        pressedStyle={{ opacity: 0.9 }}
        noFocusRing
        style={(s) => fieldBoxStyle(colors, { focused: !!open || s.keyboardFocused, error: !!error, disabled, hovered: s.hovered })}
      >
        {leftIcon ? <Icon name={leftIcon} size={18} color={hasValue ? 'primary' : 'textMuted'} /> : null}
        <Text variant="body" color={hasValue ? 'text' : 'textMuted'} numberOfLines={1} style={{ flex: 1 }}>
          {hasValue ? text : placeholder}
        </Text>
        <Icon name={rightIcon} size={18} color="textMuted" />
      </Touchable>
    </FieldFrame>
  );
}
