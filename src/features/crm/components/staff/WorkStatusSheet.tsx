import React from 'react';
import { Pressable, View } from 'react-native';

import { BottomSheet, Icon, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import type { LeadWorkStatus } from '../../types';
import { EMPLOYEE_STATUS_ORDER, WORK_STATUS_LABEL } from '../../utils/workStatus';
import { workStatusColor } from '../StatusBadge';

export interface WorkStatusSheetProps {
  visible: boolean;
  leadName: string;
  current: LeadWorkStatus;
  onPick: (status: LeadWorkStatus) => void;
  onClose: () => void;
}

const ICONS: Record<LeadWorkStatus, 'clock' | 'play' | 'check-circle' | 'calendar-clock'> = {
  pending: 'clock',
  working: 'play',
  completed: 'check-circle',
  carry_forward: 'calendar-clock',
};

/**
 * Work-status picker (replaces v1's absolutely positioned dropdown with a click-away hack). Pending / Working /
 * Completed update the lead; Carry Forward opens the carry-forward request instead of changing the status.
 */
export function WorkStatusSheet({ visible, leadName, current, onPick, onClose }: WorkStatusSheetProps) {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Work Status" testID="crm-status-sheet">
      <View style={{ gap: spacing.sm }}>
        <Text variant="callout" color="textSecondary" numberOfLines={1}>
          {leadName}
        </Text>
        {EMPLOYEE_STATUS_ORDER.map((status) => {
          const active = status === current;
          const color = workStatusColor(colors, status);
          return (
            <Pressable
              key={status}
              accessibilityRole="button"
              accessibilityLabel={WORK_STATUS_LABEL[status]}
              accessibilityState={{ selected: active }}
              onPress={() => onPick(status)}
              testID={`crm-status-option-${status}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderRadius: radii.md,
                borderWidth: 1.5,
                borderColor: active ? color : colors.border,
                backgroundColor: active ? colors.surfaceMuted : colors.surface,
              }}
            >
              <Icon name={ICONS[status]} size={20} color={color} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {WORK_STATUS_LABEL[status]}
              </Text>
              {active ? <Icon name="check" size={18} color={color} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
