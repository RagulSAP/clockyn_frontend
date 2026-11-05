import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { BottomSheet } from '../BottomSheet';
import { Button } from '../Button';
import { CheckboxMark } from '../Checkbox';
import { Icon } from '../Icon';
import { SearchBar } from '../SearchBar';
import { Text } from '../Text';
import { Touchable } from './Touchable';
import { haptic } from './haptics';

export type SelectOption<T> = { label: string; value: T; subtitle?: string; disabled?: boolean };

export type PickerSheetProps<T> = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  options: SelectOption<T>[];
  selected: T[];
  multiple?: boolean;
  searchable?: boolean;
  selectAll?: boolean;
  onToggle: (value: T) => void;
  onSelectAll?: (all: boolean) => void;
  emptyText?: string;
  testID?: string;
};

/** The list-in-a-sheet used by Select and MultiSelect (search, selection ticks, select-all). */
export function PickerSheet<T>({
  visible,
  onClose,
  title,
  options,
  selected,
  multiple,
  searchable,
  selectAll,
  onToggle,
  onSelectAll,
  emptyText = 'No matches',
  testID,
}: PickerSheetProps<T>) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) setQuery('');
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || (o.subtitle ?? '').toLowerCase().includes(q));
  }, [options, query]);

  const enabled = options.filter((o) => !o.disabled);
  const allSelected = enabled.length > 0 && enabled.every((o) => selected.includes(o.value));
  const tall = searchable || options.length > 7;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      scrollable={false}
      flush
      snap={tall ? 'tall' : 'auto'}
      testID={testID}
      footer={multiple ? <Button title="Done" onPress={onClose} fullWidth /> : undefined}
    >
      <View style={{ flexShrink: 1, flexGrow: tall ? 1 : 0 }}>
        {searchable ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search" />
          </View>
        ) : null}
        {multiple && selectAll && !query ? (
          <Touchable
            onPress={() => onSelectAll?.(!allSelected)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allSelected }}
            accessibilityLabel="Select all"
            hoverStyle={{ backgroundColor: colors.surfaceMuted }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 52 }}
          >
            <CheckboxMark checked={allSelected} indeterminate={!allSelected && enabled.some((o) => selected.includes(o.value))} />
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              Select all
            </Text>
          </Touchable>
        ) : null}
        <FlatList
          data={filtered}
          keyExtractor={(o, i) => `${String(o.value)}-${i}`}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: tall ? 1 : 0 }}
          ListEmptyComponent={
            <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
              <Text color="textMuted">{emptyText}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSel = selected.includes(item.value);
            return (
              <Touchable
                onPress={() => {
                  if (item.disabled) return;
                  haptic('selection');
                  onToggle(item.value);
                }}
                disabled={item.disabled}
                accessibilityRole={multiple ? 'checkbox' : 'radio'}
                accessibilityState={{ selected: isSel, checked: isSel, disabled: !!item.disabled }}
                accessibilityLabel={item.subtitle ? `${item.label}, ${item.subtitle}` : item.label}
                hoverStyle={{ backgroundColor: colors.surfaceMuted }}
                pressedStyle={{ backgroundColor: colors.surfaceMuted }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  minHeight: 52,
                  marginHorizontal: spacing.sm,
                  borderRadius: radii.md,
                  backgroundColor: isSel && !multiple ? colors.primarySoft : 'transparent',
                  opacity: item.disabled ? 0.45 : 1,
                }}
              >
                {multiple ? <CheckboxMark checked={isSel} disabled={item.disabled} /> : null}
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight={isSel ? 'semibold' : 'regular'} color={isSel && !multiple ? 'primary' : 'text'}>
                    {item.label}
                  </Text>
                  {item.subtitle ? (
                    <Text variant="caption" color="textMuted">
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
                {!multiple && isSel ? <Icon name="check" size={20} color="primary" /> : null}
              </Touchable>
            );
          }}
        />
      </View>
    </BottomSheet>
  );
}
