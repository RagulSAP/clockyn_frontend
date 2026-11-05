import React from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Badge, Card, Icon, Switch, Text } from '@/components/ui';
import { spacing } from '@/theme';
import type { StaffMember } from '@/types/api/staff';

import { statusDisplay, type RosterFilter } from '../utils/rosterFilters';

export interface StaffRosterRowProps {
  member: StaffMember;
  filter: RosterFilter;
  toggling: boolean;
  onOpen: (member: StaffMember) => void;
  onToggleActive: (member: StaffMember, active: boolean) => void;
  /** Called only for members that have a photo. */
  onPhotoPress: (member: StaffMember) => void;
}

/** One roster row: avatar (photo opens a lightbox), name + live status, branch / department tags, active switch. */
export const StaffRosterRow = React.memo(function StaffRosterRow({ member, filter, toggling, onOpen, onToggleActive, onPhotoPress }: StaffRosterRowProps) {
  const status = statusDisplay(member.status);
  const avatar = <Avatar uri={member.photoUrl} name={member.name} size={48} />;

  return (
    <Card padding={spacing.md} onPress={() => onOpen(member)} accessibilityLabel={`Open ${member.name}`} testID={`staff-row-${member.userId}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {member.photoUrl ? (
          <Pressable accessibilityRole="imagebutton" accessibilityLabel={`View photo of ${member.name}`} onPress={() => onPhotoPress(member)} hitSlop={6}>
            {avatar}
          </Pressable>
        ) : (
          avatar
        )}

        <View style={{ flex: 1, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
              {member.name || 'Unnamed'}
            </Text>
            {filter === 'late' ? (
              <Badge label="LATE" tone="warning" size="sm" />
            ) : status ? (
              <Badge label={status.label} tone={status.tone} size="sm" dot />
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
            <Badge label={member.branch || 'N/A'} tone="neutral" size="sm" icon="building" />
            <Badge label={member.department || 'N/A'} tone="primary" size="sm" icon="briefcase" />
          </View>
        </View>

        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text variant="micro" color="textMuted">
            STAFF STATUS
          </Text>
          <Switch
            value={member.isActive}
            disabled={toggling}
            onValueChange={(v) => onToggleActive(member, v)}
            accessibilityLabel={`${member.name} is ${member.isActive ? 'active' : 'inactive'}`}
            testID={`staff-switch-${member.userId}`}
          />
        </View>
        <Icon name="chevron-right" size={18} color="textMuted" />
      </View>
    </Card>
  );
});
