import React from 'react';

import { BottomSheet, Card, ListItem, type IconName } from '@/components/ui';

export type ActionMenuItem = {
  key: string;
  label: string;
  icon: IconName;
  destructive?: boolean;
  onPress: () => void;
};

export type ActionMenuProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  items: ActionMenuItem[];
  testID?: string;
};

/** The "..." row menu: a bottom sheet on phones, a centred dialog on wide screens. Replaces v1's popover. */
export function ActionMenu({ visible, onClose, title, items, testID }: ActionMenuProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} size="sm" testID={testID}>
      <Card padding={0} variant="outlined">
        {items.map((item, i) => (
          <ListItem
            key={item.key}
            icon={item.icon}
            iconTone={item.destructive ? 'danger' : 'primary'}
            title={item.label}
            destructive={item.destructive}
            divider={i < items.length - 1}
            onPress={() => {
              onClose();
              item.onPress();
            }}
            testID={testID ? `${testID}-${item.key}` : undefined}
          />
        ))}
      </Card>
    </BottomSheet>
  );
}
