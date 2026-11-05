import React, { forwardRef, useState } from 'react';
import { TextInput, View, type TextInputInstance, type KeyboardTypeOptions, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { fontFamily, spacing, typography, useTheme } from '@/theme';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';
import { FieldFrame, useFieldBoxStyle } from './internal/Field';
import { Touchable } from './internal/Touchable';
import { noOutline } from './internal/web';

export type TextFieldProps = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Error message (string) or a bare error state (true). */
  error?: string | boolean | null;
  hint?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  rightIconLabel?: string;
  /** Password mode: hides the text and shows a reveal toggle. */
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
  required?: boolean;
  editable?: boolean;
  /** Static text before the input, e.g. `+91`. */
  prefix?: string;
  onSubmitEditing?: () => void;
  onBlur?: () => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCorrect?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  inputMode?: TextInputProps['inputMode'];
  textContentType?: TextInputProps['textContentType'];
  /** Show `n/max` below the field when `maxLength` is set. */
  showCounter?: boolean;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField(
  {
    label,
    value,
    onChangeText,
    placeholder,
    error,
    hint,
    leftIcon,
    rightIcon,
    onRightIconPress,
    rightIconLabel,
    secure,
    keyboardType,
    maxLength,
    multiline,
    numberOfLines,
    required,
    editable = true,
    prefix,
    onSubmitEditing,
    onBlur,
    onFocus,
    autoFocus,
    autoCapitalize,
    autoComplete,
    autoCorrect,
    returnKeyType,
    inputMode,
    textContentType,
    showCounter,
    style,
    inputStyle,
    testID,
    accessibilityLabel,
  },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hasError = !!error;
  const box = useFieldBoxStyle({ focused, error: hasError, disabled: !editable });
  const hidden = !!secure && !revealed;

  return (
    <FieldFrame label={label} required={required} error={error} hint={hint} style={style}>
      <View
        style={[
          box,
          multiline ? { alignItems: 'flex-start', paddingVertical: spacing.md, minHeight: 48 + (numberOfLines ? (numberOfLines - 1) * 22 : 48) } : null,
          focused ? { backgroundColor: colors.surface } : null,
        ]}
      >
        {leftIcon ? <Icon name={leftIcon} size={18} color={focused ? 'primary' : 'textMuted'} style={multiline ? { marginTop: 2 } : undefined} /> : null}
        {prefix ? (
          <Text variant="body" color="textSecondary" weight="medium">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          editable={editable}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize ?? (secure ? 'none' : undefined)}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect ?? (secure ? false : undefined)}
          returnKeyType={returnKeyType}
          inputMode={inputMode}
          textContentType={textContentType}
          onSubmitEditing={onSubmitEditing}
          selectionColor={colors.primary}
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          accessibilityState={{ disabled: !editable }}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          style={[
            {
              flex: 1,
              color: colors.text,
              fontFamily: fontFamily.regular,
              fontSize: typography.body.fontSize,
              paddingVertical: multiline ? 0 : 10,
              minHeight: multiline ? 72 : undefined,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            noOutline,
            inputStyle,
          ]}
        />
        {secure ? (
          <Touchable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={8}
            radius={12}
          >
            <Icon name={revealed ? 'eye-off' : 'eye'} size={18} color="textMuted" />
          </Touchable>
        ) : rightIcon ? (
          onRightIconPress ? (
            <Touchable onPress={onRightIconPress} accessibilityRole="button" accessibilityLabel={rightIconLabel ?? rightIcon} hitSlop={8} radius={12}>
              <Icon name={rightIcon} size={18} color="textMuted" />
            </Touchable>
          ) : (
            <Icon name={rightIcon} size={18} color="textMuted" />
          )
        ) : null}
      </View>
      {showCounter && maxLength ? (
        <Text variant="caption" color="textMuted" align="right" style={{ marginTop: 2 }}>
          {`${value.length}/${maxLength}`}
        </Text>
      ) : null}
    </FieldFrame>
  );
});
