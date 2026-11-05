import React, { useEffect, useState } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing, useTheme } from '@/theme';
import { Text } from './Text';
import { haptic } from './internal/haptics';
import { Touchable } from './internal/Touchable';

export type SwitchProps = {
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  /** Aliases of `value` / `onValueChange` for symmetry with Checkbox. */
  checked?: boolean;
  onChange?: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

const W = 50;
const H = 30;
const KNOB = 24;

/** Cross-platform toggle (custom-drawn so it looks identical on iOS, Android and web). */
export function Switch({ value, onValueChange, checked, onChange, label, description, disabled, style, testID, accessibilityLabel }: SwitchProps) {
  const { colors } = useTheme();
  const on = value ?? checked ?? false;
  const [anim] = useState(() => new Animated.Value(on ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, { toValue: on ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [on, anim]);

  const toggle = () => {
    if (disabled) return;
    haptic('selection');
    (onValueChange ?? onChange)?.(!on);
  };

  const track = (
    <Animated.View
      style={{
        width: W,
        height: H,
        borderRadius: H / 2,
        justifyContent: 'center',
        backgroundColor: anim.interpolate({ inputRange: [0, 1], outputRange: [colors.borderStrong, colors.primary] }),
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Animated.View
        style={{
          width: KNOB,
          height: KNOB,
          borderRadius: KNOB / 2,
          backgroundColor: on ? colors.onPrimary : colors.surface,
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [3, W - KNOB - 3] }) }],
          shadowColor: colors.shadow,
          shadowOpacity: 0.25,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </Animated.View>
  );

  return (
    <Touchable
      testID={testID}
      onPress={toggle}
      disabled={disabled}
      activateOnSpace
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: on, disabled: !!disabled }}
      radius={H / 2}
      pressedStyle={{ opacity: 0.85 }}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: label ? 'stretch' : 'flex-start', minHeight: 44 }, style]}
    >
      {label ? (
        <View style={{ flex: 1 }}>
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
      {track}
    </Touchable>
  );
}
