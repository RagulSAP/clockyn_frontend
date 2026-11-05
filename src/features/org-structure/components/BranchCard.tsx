import React from 'react';
import { View } from 'react-native';

import { Badge, Card, Icon, IconButton, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';
import type { Branch } from '@/types/api/branches';

import { formatGps, formatRadius, hasGps } from '../utils/branchForm';

type Props = {
  branch: Branch;
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
  disabled?: boolean;
};

/** One branch: name, address, GPS / "No GPS" pill, radius pill and edit / delete actions. */
export function BranchCard({ branch, onEdit, onDelete, disabled }: Props) {
  const { colors } = useTheme();
  const gps = hasGps(branch.latitude, branch.longitude);
  return (
    <Card padding={spacing.lg} testID={`branch-card-${branch.id}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{ width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="map-pin" size={22} color="primary" />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {branch.name}
          </Text>
          {branch.address ? (
            <Text variant="callout" color="textSecondary" numberOfLines={1}>
              {branch.address}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}>
            {gps ? (
              <Badge label={formatGps(branch.latitude, branch.longitude, 4)} tone="primary" icon="crosshair" size="sm" />
            ) : (
              <Badge label="No GPS" tone="danger" icon="alert-circle" size="sm" />
            )}
            <Badge label={formatRadius(branch.radius)} tone="neutral" size="sm" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <IconButton icon="edit" variant="tonal" accessibilityLabel={`Edit ${branch.name}`} onPress={() => onEdit(branch)} disabled={disabled} />
          <IconButton icon="trash" variant="tonal" accessibilityLabel={`Delete ${branch.name}`} onPress={() => onDelete(branch)} disabled={disabled} />
        </View>
      </View>
    </Card>
  );
}
