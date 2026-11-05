import React, { forwardRef, useState } from 'react';
import { TextInput, View, type TextInputInstance, type StyleProp, type ViewStyle } from 'react-native';
import { fontFamily, radii, spacing, typography, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Touchable } from './internal/Touchable';
import { noOutline } from './internal/web';

export type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Called when the clear button is pressed (default: `onChangeText('')`). */
  onClear?: () => void;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

export const SearchBar = forwardRef<TextInputInstance, SearchBarProps>(function SearchBar(
  { value, onChangeText, placeholder = 'Search', onClear, onSubmitEditing, autoFocus, style, testID, accessibilityLabel },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      accessibilityRole="search"
      style={[
        {
          height: 46,
          borderRadius: radii.pill,
          paddingHorizontal: spacing.md + 2,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: focused ? colors.surface : colors.surfaceMuted,
          borderWidth: 1.5,
          borderColor: focused ? colors.primary : 'transparent',
        },
        style,
      ]}
    >
      <Icon name="search" size={18} color={focused ? 'primary' : 'textMuted'} />
      <TextInput
        ref={ref}
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={colors.primary}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[{ flex: 1, color: colors.text, fontFamily: fontFamily.regular, fontSize: typography.body.fontSize, paddingVertical: 0 }, noOutline]}
      />
      {value.length > 0 ? (
        <Touchable
          onPress={() => (onClear ? onClear() : onChangeText(''))}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
          radius={12}
        >
          <Icon name="x-circle" size={18} color="textMuted" />
        </Touchable>
      ) : null}
    </View>
  );
});
