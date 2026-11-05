import React from 'react';
import { View } from 'react-native';

import { Avatar, ListItem, Text } from '@/components/ui';
import type { StaffMember } from '@/types/api/staff';

import { type PunchColumn } from '../../utils/overviewLogic';

const TONE_COLOR = { success: 'success', warning: 'warning', danger: 'danger' } as const;

export type StaffAttendanceRowProps = {
  staff: StaffMember;
  punch: PunchColumn;
  divider?: boolean;
  onPress: (staff: StaffMember) => void;
};

/** One staff row: avatar, name, `branch · department` and the punch column (time / label / hours). */
export function StaffAttendanceRow({ staff, punch, divider, onPress }: StaffAttendanceRowProps) {
  const color = TONE_COLOR[punch.tone];
  return (
    <ListItem
      testID={`staff-row-${staff.userId}`}
      title={staff.name || 'Unnamed'}
      subtitle={`${staff.branch || 'N/A'} · ${staff.department || 'N/A'}`}
      left={<Avatar uri={staff.photoUrl} name={staff.name} size={44} />}
      right={
        punch.time || punch.hours ? (
          <View style={{ alignItems: 'flex-end' }}>
            {punch.label ? (
              <Text variant="micro" color="textMuted">
                {punch.label}
              </Text>
            ) : null}
            {punch.time ? (
              <Text variant="bodyStrong" color={color}>
                {punch.time}
              </Text>
            ) : null}
            {punch.hours ? (
              <Text variant="caption" color="textMuted">
                {punch.hours}
              </Text>
            ) : null}
          </View>
        ) : undefined
      }
      chevron
      divider={divider}
      onPress={() => onPress(staff)}
    />
  );
}
