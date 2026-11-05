import React from 'react';
import { View } from 'react-native';

import { BottomSheet, Card, ListItem, Text } from '@/components/ui';
import { spacing } from '@/theme';

import { ASSIGN_TARGETS, type AssignTarget } from '../../utils/staffActions';

export interface AssignSheetProps {
  visible: boolean;
  staffName: string;
  onClose: () => void;
  onSelect: (target: AssignTarget) => void;
}

function Group({ title, targets, onSelect }: { title: string; targets: readonly AssignTarget[]; onSelect: (t: AssignTarget) => void }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="micro" color="textMuted">
        {title.toUpperCase()}
      </Text>
      <Card padding={0}>
        {targets.map((t, i) => (
          <ListItem
            key={t.key}
            icon={t.icon}
            title={t.title}
            subtitle={t.description}
            onPress={() => onSelect(t)}
            divider={i < targets.length - 1}
            testID={`assign-${t.key}`}
          />
        ))}
      </Card>
    </View>
  );
}

/** "Assign" hub: manager, shift and the salary components. */
export function AssignSheet({ visible, staffName, onClose, onSelect }: AssignSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Assign" snap="tall">
      <View style={{ gap: spacing.lg }}>
        <Text variant="callout" color="textSecondary">
          {staffName}
        </Text>
        <Group title="Settings" targets={ASSIGN_TARGETS.filter((t) => t.section === 'settings')} onSelect={onSelect} />
        <Group title="Salary" targets={ASSIGN_TARGETS.filter((t) => t.section === 'salary')} onSelect={onSelect} />
      </View>
    </BottomSheet>
  );
}
