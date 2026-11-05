import React from 'react';
import { Pressable, View } from 'react-native';

import { BottomSheet, Icon, ListItem, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import type { TimeSlot } from '../utils/requestRules';

export type TimeSlotSheetProps = {
  visible: boolean;
  title: string;
  slots: readonly TimeSlot[];
  value: string;
  emptyMessage: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

/** Half-hour slot picker (bottom sheet on phones, dialog on wide screens). */
export function TimeSlotSheet({ visible, title, slots, value, emptyMessage, onSelect, onClose }: TimeSlotSheetProps) {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} snap="half" flush testID="time-slot-sheet">
      {slots.length === 0 ? (
        <View style={{ padding: spacing.xl }}>
          <Text color="textSecondary" align="center">
            {emptyMessage}
          </Text>
        </View>
      ) : (
        slots.map((s) => (
          <ListItem
            key={s.value}
            title={s.label}
            onPress={() => onSelect(s.value)}
            right={s.value === value ? <Icon name="check" size={20} color="primary" /> : undefined}
            divider
            style={s.value === value ? { backgroundColor: colors.primarySoft } : undefined}
            testID={`slot-${s.value}`}
          />
        ))
      )}
    </BottomSheet>
  );
}

export type SlotButtonProps = {
  label: string;
  value: string;
  placeholder?: string;
  onPress: () => void;
  testID?: string;
};

/** Field-looking button showing the chosen time ("Select" when empty). */
export function SlotButton({ label, value, placeholder = 'Select', onPress, testID }: SlotButtonProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <Text variant="callout" weight="semibold" color="textSecondary">
        {label}
      </Text>
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || 'not set'}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 48,
          paddingHorizontal: spacing.md,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Icon name="clock" size={18} color={value ? 'primary' : 'textMuted'} />
        <Text variant="body" color={value ? 'text' : 'textMuted'} style={{ flex: 1 }}>
          {value || placeholder}
        </Text>
        <Icon name="chevron-down" size={18} color="textMuted" />
      </Pressable>
    </View>
  );
}
