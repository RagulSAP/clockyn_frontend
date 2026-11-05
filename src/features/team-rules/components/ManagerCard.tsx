import React from 'react';
import { View } from 'react-native';

import { Avatar, Badge, Button, Card, CountBadge, IconButton, Text } from '@/components/ui';
import { radii, spacing, useTheme, type ColorTokens } from '@/theme';
import type { Manager } from '@/types/api/managers';

const STRIP_COLORS: (keyof ColorTokens)[] = ['primary', 'textSecondary', 'textMuted'];

export type ManagerCardProps = {
  manager: Manager;
  index: number;
  onViewBranches: () => void;
  onViewStaff: () => void;
  onPermissions: () => void;
  onEdit: () => void;
  onRemove: () => void;
};

/** One manager: avatar, name, employee id and the four actions (staff, permissions, edit, remove). */
export function ManagerCard({ manager, index, onViewBranches, onViewStaff, onPermissions, onEdit, onRemove }: ManagerCardProps) {
  const { colors } = useTheme();
  const strip = colors[STRIP_COLORS[index % STRIP_COLORS.length]];
  const count = manager.assignments.length;
  return (
    <Card padding={0} testID={`manager-card-${manager.userId}`}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 5, backgroundColor: strip, borderTopLeftRadius: radii.lg, borderBottomLeftRadius: radii.lg }} />
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar name={manager.name || '??'} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {manager.name || 'Unnamed'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Badge label="Manager" tone="primary" size="sm" />
                {manager.empId ? (
                  <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {manager.empId}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Button title="View Branch" size="sm" variant="secondary" icon="building" onPress={onViewBranches} testID={`manager-branches-${manager.userId}`} />
              {count > 0 ? <CountBadge count={count} tone="solid" /> : null}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <IconButton icon="users" variant="tonal" color="success" accessibilityLabel={`Staff under ${manager.name}`} onPress={onViewStaff} testID={`manager-staff-${manager.userId}`} />
              <IconButton icon="shield-check" variant="tonal" color="primary" accessibilityLabel={`Permissions of ${manager.name}`} onPress={onPermissions} testID={`manager-perms-${manager.userId}`} />
              <IconButton icon="edit" variant="tonal" color="warning" accessibilityLabel={`Edit ${manager.name}`} onPress={onEdit} testID={`manager-edit-${manager.userId}`} />
              <IconButton icon="trash" variant="tonal" color="danger" accessibilityLabel={`Remove ${manager.name}`} onPress={onRemove} testID={`manager-remove-${manager.userId}`} />
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}
