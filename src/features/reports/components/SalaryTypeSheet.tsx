import React from 'react';
import { BottomSheet, Icon, ListItem } from '@/components/ui';
import { SALARY_TYPES, type SalaryTypeKey } from '../utils/salarySheet';

/** Pick a salary type (local view/export override only — amounts are not recomputed). */
export function SalaryTypeSheet({
  visible,
  title,
  subtitle,
  current,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  current: string | null;
  onClose: () => void;
  onPick: (key: SalaryTypeKey) => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} size="sm">
      {subtitle ? <ListItem title={subtitle} /> : null}
      {SALARY_TYPES.map((t, i) => (
        <ListItem
          key={t.key}
          icon="wallet"
          iconTone="primary"
          title={t.label}
          right={current === t.key ? <Icon name="check" size={20} color="primary" /> : undefined}
          divider={i < SALARY_TYPES.length - 1}
          onPress={() => {
            onPick(t.key);
            onClose();
          }}
          testID={`salary-type-${t.key}`}
        />
      ))}
    </BottomSheet>
  );
}
