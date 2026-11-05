import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing, useTheme } from '@/theme';
import { Text } from './Text';
import { haptic } from './internal/haptics';
import { Touchable } from './internal/Touchable';

export type RadioOption<T> = { label: string; value: T; description?: string; disabled?: boolean };

export type RadioGroupProps<T> = {
  options: RadioOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  direction?: 'vertical' | 'horizontal';
  disabled?: boolean;
  error?: string | boolean | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function RadioMark({ selected, disabled }: { selected: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
    </View>
  );
}

export function RadioGroup<T>({ options, value, onChange, direction = 'vertical', disabled, error, style, testID }: RadioGroupProps<T>) {
  return (
    <View testID={testID} accessibilityRole="radiogroup" style={style}>
      <View style={{ flexDirection: direction === 'horizontal' ? 'row' : 'column', flexWrap: 'wrap', columnGap: spacing.xl, rowGap: spacing.xs }}>
        {options.map((o, i) => {
          const selected = o.value === value;
          const off = disabled || o.disabled;
          return (
            <Touchable
              key={`${String(o.value)}-${i}`}
              onPress={() => {
                if (off || selected) return;
                haptic('selection');
                onChange(o.value);
              }}
              disabled={off}
              activateOnSpace
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ checked: selected, selected, disabled: !!off }}
              radius={12}
              style={{ flexDirection: 'row', alignItems: o.description ? 'flex-start' : 'center', gap: spacing.md, minHeight: 44, alignSelf: 'flex-start' }}
            >
              <View style={o.description ? { marginTop: 11 } : undefined}>
                <RadioMark selected={selected} disabled={off} />
              </View>
              <View style={{ flexShrink: 1, paddingVertical: o.description ? 8 : 0 }}>
                <Text variant="body" color={off ? 'textMuted' : 'text'}>
                  {o.label}
                </Text>
                {o.description ? (
                  <Text variant="caption" color="textMuted">
                    {o.description}
                  </Text>
                ) : null}
              </View>
            </Touchable>
          );
        })}
      </View>
      {typeof error === 'string' && error ? (
        <Text variant="caption" color="danger" style={{ marginTop: spacing.xs }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
