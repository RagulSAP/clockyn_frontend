import React from 'react';

import { BottomSheet, ListItem, type IconName } from '@/components/ui';

export interface ChatAction {
  key: string;
  label: string;
  icon: IconName;
  destructive?: boolean;
  onPress: () => void;
}

/** The conversation's "more" menu as a bottom sheet (centred dialog on wide web). The sheet closes before the action runs. */
export function ChatActionSheet({ visible, onClose, actions, title }: { visible: boolean; onClose: () => void; actions: ChatAction[]; title?: string }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} snap="auto" size="sm">
      {actions.map((a) => (
        <ListItem
          key={a.key}
          testID={`chat-action-${a.key}`}
          title={a.label}
          icon={a.icon}
          destructive={a.destructive}
          chevron={false}
          onPress={() => {
            onClose();
            a.onPress();
          }}
        />
      ))}
    </BottomSheet>
  );
}
