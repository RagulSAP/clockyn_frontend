import React from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, Icon, Modal, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

import type { AssignmentConflict } from '../utils/managerAssign';

export function ConflictModal({ conflicts, onClose }: { conflicts: AssignmentConflict[] | null; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={!!conflicts}
      onClose={onClose}
      title="Assignment Conflict"
      footer={<Button title="OK" fullWidth onPress={onClose} testID="conflict-ok" />}
      testID="conflict-modal"
    >
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="alert" size={20} color={colors.warning} />
          <Text variant="callout" color="textSecondary" style={{ flex: 1 }}>
            The following branch/department combinations are already assigned:
          </Text>
        </View>
        {(conflicts ?? []).map((c, i) => (
          <Card key={`${c.managerName}-${c.branchName}-${c.deptName}-${i}`} variant="muted" padding={spacing.md}>
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyStrong">
                {c.managerName}
                {c.empId ? ` (${c.empId})` : ''}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                <Badge label={c.branchName} tone="primary" size="sm" icon="building" />
                <Badge label={c.deptName} tone="warning" size="sm" />
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Modal>
  );
}
