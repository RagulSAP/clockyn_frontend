import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, TextInput, View, type TextInputInstance, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { Text } from './Text';
import { noOutline } from './internal/web';

export type OTPInputProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  /** Error message (string) or bare error state (true). Triggers a shake. */
  error?: string | boolean | null;
  /** Called once when `length` digits have been entered. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * One invisible input captures the code (so SMS autofill / paste / hardware keyboards just work);
 * the boxes are a visual projection of its value.
 */
export function OTPInput({ length = 6, value, onChange, autoFocus, error, onComplete, disabled, style, testID }: OTPInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const [shake] = useState(() => new Animated.Value(0));
  const prevError = useRef(false);
  const hasError = !!error;

  useEffect(() => {
    if (hasError && !prevError.current) {
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(shake, { toValue: -1, duration: 90, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(shake, { toValue: 1, duration: 90, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(shake, { toValue: 0, duration: 60, easing: Easing.linear, useNativeDriver: false }),
      ]).start();
    }
    prevError.current = hasError;
  }, [hasError, shake]);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length && value.length !== length) onComplete?.(digits);
  };

  const active = Math.min(value.length, length - 1);
  const translateX = shake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-8, 0, 8] });

  return (
    <View style={[{ alignSelf: 'stretch' }, style]}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }}>
          {Array.from({ length }, (_, i) => {
            const ch = value[i];
            const isActive = focused && i === active;
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  maxWidth: 52,
                  height: 56,
                  borderRadius: radii.md,
                  borderWidth: isActive ? 2 : 1.5,
                  borderColor: hasError ? colors.danger : isActive ? colors.primary : ch ? colors.borderStrong : colors.border,
                  backgroundColor: ch ? colors.primarySoft : colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="title2" color={hasError ? 'danger' : 'text'}>
                  {ch ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          testID={testID}
          value={value}
          onChangeText={handleChange}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={length}
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          caretHidden
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={`Enter ${length} digit code`}
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.02,
              color: 'transparent',
            },
            noOutline,
          ]}
        />
      </Animated.View>
      {typeof error === 'string' && error ? (
        <Text variant="caption" color="danger" align="center" style={{ marginTop: spacing.sm }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
