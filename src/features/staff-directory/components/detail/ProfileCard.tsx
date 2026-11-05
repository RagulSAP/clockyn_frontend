import React from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Button, Card, Icon, IconButton, StatusPill, Text } from '@/components/ui';
import { spacing } from '@/theme';
import type { StaffDetail } from '@/types/api/staff';

import { statusDisplay } from '../../utils/rosterFilters';

export interface ProfileCardProps {
  detail: StaffDetail;
  photoUrl: string | undefined;
  canDelete: boolean;
  onPhotoPress: () => void;
  onProfile: () => void;
  onAssign: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Identity card: photo, name, branch, mobile, live status and the primary actions. */
export function ProfileCard({ detail, photoUrl, canDelete, onPhotoPress, onProfile, onAssign, onEdit, onDelete }: ProfileCardProps) {
  const status = statusDisplay(detail.status);
  const avatar = <Avatar uri={photoUrl} name={detail.name} size={72} />;

  return (
    <Card testID="staff-profile-card" style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        {photoUrl ? (
          <Pressable accessibilityRole="imagebutton" accessibilityLabel="View profile photo" onPress={onPhotoPress}>
            {avatar}
          </Pressable>
        ) : (
          avatar
        )}
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="title2" numberOfLines={2} accessibilityRole="header">
            {detail.name || 'Unnamed'}
          </Text>
          {detail.branch ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Icon name="building" size={14} color="textMuted" />
              <Text variant="callout" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                {detail.branch}
              </Text>
            </View>
          ) : null}
          {detail.mobile ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Icon name="phone" size={14} color="textMuted" />
              <Text variant="callout" color="textSecondary">
                {detail.mobile}
              </Text>
            </View>
          ) : null}
          {status ? <StatusPill status={detail.status} label={status.label} tone={status.tone} size="sm" style={{ marginTop: spacing.xs }} /> : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
        <Button title="Profile" icon="user" size="sm" variant="secondary" onPress={onProfile} />
        <Button title="Assign" icon="wallet" size="sm" variant="secondary" onPress={onAssign} />
        <Button title="Edit" icon="edit" size="sm" variant="secondary" onPress={onEdit} />
        {canDelete ? <IconButton icon="trash" variant="tonal" accessibilityLabel="Delete staff permanently" onPress={onDelete} /> : null}
      </View>
    </Card>
  );
}
