import React from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';
import { haptic } from './internal/haptics';
import { Touchable } from './internal/Touchable';

export type ChipOption<T> = { label: string; value: T; icon?: IconName; count?: number };

type Common<T> = {
  options: ChipOption<T>[];
  /** Horizontal scroll (default) or wrap onto multiple lines. */
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
type Single<T> = Common<T> & { multiple?: false; value: T | null | undefined; onChange: (value: T) => void };
type Multi<T> = Common<T> & { multiple: true; value: T[]; onChange: (value: T[]) => void };
export type FilterChipsProps<T> = Single<T> | Multi<T>;

/** Pill filter chips. Single-select by default; `multiple` toggles values in an array. */
export function FilterChips<T>(props: FilterChipsProps<T>) {
  const { colors } = useTheme();
  const { options, scroll = true, style, testID } = props;

  const isSelected = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);
  const press = (v: T) => {
    haptic('selection');
    if (props.multiple) props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    else props.onChange(v);
  };

  const chips = options.map((o, i) => {
    const selected = isSelected(o.value);
    return (
      <Touchable
        key={`${String(o.value)}-${i}`}
        onPress={() => press(o.value)}
        accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
        accessibilityLabel={o.count !== undefined ? `${o.label}, ${o.count}` : o.label}
        accessibilityState={{ selected, checked: selected }}
        radius={radii.pill}
        hoverStyle={{ borderColor: colors.primary }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 36,
          paddingHorizontal: spacing.md + 2,
          borderRadius: radii.pill,
          borderWidth: 1.5,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primarySoft : colors.surface,
        }}
      >
        {props.multiple && selected ? <Icon name="check" size={14} color="primary" strokeWidth={3} /> : null}
        {o.icon ? <Icon name={o.icon} size={14} color={selected ? 'primary' : 'textMuted'} /> : null}
        <Text variant="callout" weight={selected ? 'semibold' : 'medium'} color={selected ? 'primary' : 'textSecondary'}>
          {o.label}
        </Text>
        {o.count !== undefined ? (
          <Text variant="caption" weight="semibold" color={selected ? 'primary' : 'textMuted'}>
            {String(o.count)}
          </Text>
        ) : null}
      </Touchable>
    );
  });

  if (!scroll) {
    return (
      <View testID={testID} style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, style]}>
        {chips}
      </View>
    );
  }
  return (
    <ScrollView
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2, paddingHorizontal: 2 }}
      keyboardShouldPersistTaps="handled"
    >
      {chips}
    </ScrollView>
  );
}
