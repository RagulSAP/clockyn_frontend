import React from 'react';
import { View } from 'react-native';

import { Button, Modal, Text } from '@/components/ui';
import { spacing } from '@/theme';

type Props = {
  visible: boolean;
  /** Dismissing (scrim / close) keeps editing. */
  onStay: () => void;
  /** Leave and discard the changes. */
  onExit: () => void;
  /** Save, then leave. */
  onSave: () => void;
};

/** "Unsaved Changes" prompt of the staff edit form. */
export function UnsavedChangesDialog({ visible, onStay, onExit, onSave }: Props) {
  return (
    <Modal
      visible={visible}
      onClose={onStay}
      title="Unsaved Changes"
      size="sm"
      testID="unsaved-dialog"
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Exit" variant="secondary" onPress={onExit} style={{ flex: 1 }} testID="unsaved-exit" />
          <Button title="Save" onPress={onSave} style={{ flex: 1 }} testID="unsaved-save" />
        </View>
      }
    >
      <Text color="textSecondary">You have unsaved changes. Do you want to save before leaving?</Text>
    </Modal>
  );
}
