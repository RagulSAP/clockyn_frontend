import React from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, Icon, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import type { PermissionAction, PermissionMeta } from '../utils/permissionsLogic';

export type PermissionCardProps = {
  meta: PermissionMeta;
  granted: boolean;
  action: PermissionAction;
  busy?: boolean;
  onPress: () => void;
};

const ACTION_LABEL: Record<Exclude<PermissionAction, 'none'>, string> = {
  request: 'Allow',
  'open-settings': 'Open settings',
  'browser-instructions': 'How to enable',
};

/** One device permission: status (ON / OFF) and the button that grants it or sends the user to settings. */
export function PermissionCard({ meta, granted, action, busy, onPress }: PermissionCardProps) {
  const { colors } = useTheme();
  return (
    <Card padding={0} testID={`permission-${meta.kind}`} style={{ overflow: 'hidden' }}>
      <View style={{ height: 4, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, backgroundColor: granted ? colors.success : colors.borderStrong }} />
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: granted ? colors.successSoft : colors.surfaceMuted,
            }}
          >
            <Icon name={meta.icon} size={22} color={granted ? colors.success : colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{meta.label}</Text>
            <Text variant="caption" color="textMuted">
              {meta.description}
            </Text>
          </View>
          <Badge label={granted ? 'ON' : 'OFF'} tone={granted ? 'success' : 'neutral'} testID={`permission-state-${meta.kind}`} />
        </View>
        {action !== 'none' ? (
          <Button
            title={ACTION_LABEL[action]}
            size="sm"
            variant={action === 'request' ? 'primary' : 'secondary'}
            loading={busy}
            onPress={onPress}
            testID={`permission-action-${meta.kind}`}
            accessibilityLabel={`${ACTION_LABEL[action]}: ${meta.label}`}
          />
        ) : null}
      </View>
    </Card>
  );
}
