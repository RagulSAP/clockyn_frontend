import React, { createElement, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { fontFamily, typography, useTheme } from '@/theme';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { FieldFrame, fieldBoxStyle } from './Field';

export type WebInputFieldProps = {
  type: 'date' | 'time';
  label?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  error?: string | boolean | null;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  leftIcon?: IconName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Web-only: native browser `<input type=date|time>` inside the Clockyn field chrome. */
export function WebInputField({ type, label, value, onChange, min, max, error, hint, required, disabled, leftIcon, style, testID }: WebInputFieldProps) {
  const { colors, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <FieldFrame label={label} required={required} error={error} hint={hint} style={style}>
      <View
        // react-native-web forwards these pointer handlers to the DOM node
        {...({ onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } as object)}
        style={fieldBoxStyle(colors, { focused, error: !!error, disabled, hovered })}
      >
        {leftIcon ? <Icon name={leftIcon} size={18} color={value ? 'primary' : 'textMuted'} /> : null}
        {createElement('input', {
          type,
          value,
          min,
          max,
          disabled,
          required,
          'aria-label': label ?? (type === 'date' ? 'Date' : 'Time'),
          'data-testid': testID,
          onChange: (e: { target: { value: string } }) => onChange(e.target.value),
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          style: {
            flex: 1,
            minWidth: 0,
            height: 44,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: value ? colors.text : colors.textMuted,
            fontFamily: fontFamily.regular,
            fontSize: typography.body.fontSize,
            colorScheme: isDark ? 'dark' : 'light',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: 0,
          },
        })}
      </View>
    </FieldFrame>
  );
}
