import React from 'react';
import { View } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { Button, Card, Divider, Icon, IconButton, Text, type IconName } from '@/components/ui';

export interface TemplateCardProps {
  testID?: string;
  icon: IconName;
  title: string;
  /** Chips / amount shown on the right of the header. */
  badges?: React.ReactNode;
  /** Detail lines under the header. */
  details?: React.ReactNode;
  assignedCount: number;
  menuOpen: boolean;
  confirmingDelete: boolean;
  deleting: boolean;
  /** Only the highest-numbered template offers Delete. */
  canDelete: boolean;
  deleteConfirmText: string;
  onToggleMenu: () => void;
  onEdit: () => void;
  onAssign: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

/** One template: icon tile, title, badges, "⋮" actions (inline, no overlay), inline delete confirmation, assigned-staff footer. */
export function TemplateCard({
  testID,
  icon,
  title,
  badges,
  details,
  assignedCount,
  menuOpen,
  confirmingDelete,
  deleting,
  canDelete,
  deleteConfirmText,
  onToggleMenu,
  onEdit,
  onAssign,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: TemplateCardProps) {
  const { colors } = useTheme();
  return (
    <Card testID={testID} padding={spacing.lg} style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{ width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={icon} size={22} color="primary" />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="title3" numberOfLines={2}>
            {title}
          </Text>
          {badges ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>{badges}</View> : null}
        </View>
        <IconButton
          icon="more-vertical"
          variant="plain"
          accessibilityLabel={`Actions for ${title}`}
          onPress={onToggleMenu}
          testID={testID ? `${testID}-menu` : undefined}
        />
      </View>

      {details ? <View style={{ gap: spacing.xs }}>{details}</View> : null}

      {menuOpen && !confirmingDelete ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button title="Edit" icon="edit" size="sm" variant="secondary" onPress={onEdit} testID={testID ? `${testID}-edit` : undefined} />
          <Button title="Assign Staff" icon="users" size="sm" variant="secondary" onPress={onAssign} testID={testID ? `${testID}-assign` : undefined} />
          {canDelete ? (
            <Button title="Delete" icon="trash" size="sm" variant="ghost" onPress={onAskDelete} testID={testID ? `${testID}-delete` : undefined} />
          ) : null}
        </View>
      ) : null}

      {confirmingDelete ? (
        <View
          style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.dangerSoft }}
          accessibilityRole="alert"
        >
          <Text variant="bodyStrong" color="danger">
            {deleteConfirmText}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Cancel" size="sm" variant="secondary" onPress={onCancelDelete} disabled={deleting} />
            <Button
              title={deleting ? 'Deleting...' : 'Delete'}
              size="sm"
              variant="danger"
              loading={deleting}
              onPress={onConfirmDelete}
              testID={testID ? `${testID}-confirm-delete` : undefined}
            />
          </View>
        </View>
      ) : null}

      <Divider />
      {assignedCount > 0 ? (
        <View style={{ flexDirection: 'row' }}>
          <Button
            title={`View ${assignedCount} Assigned Staff`}
            iconRight="chevron-right"
            icon="users"
            size="sm"
            variant="secondary"
            onPress={onAssign}
            testID={testID ? `${testID}-staff` : undefined}
          />
        </View>
      ) : (
        <Text variant="callout" color="textMuted">
          No staff assigned yet
        </Text>
      )}
    </Card>
  );
}
