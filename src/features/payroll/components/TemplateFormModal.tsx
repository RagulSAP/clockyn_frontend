import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/theme';
import { Button, Modal } from '@/components/ui';

export interface TemplateFormModalProps {
  visible: boolean;
  title: string;
  saving: boolean;
  /** Scrim tap / hardware back closes the dialog (daily wages only); Cancel always works when not saving. */
  dismissible?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}

/** Add / edit dialog shell: title, fields, Cancel / SAVE (SAVE shows "Saving..." and double taps are ignored). */
export function TemplateFormModal({ visible, title, saving, dismissible = false, onCancel, onSubmit, children }: TemplateFormModalProps) {
  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      title={title}
      size="sm"
      dismissible={dismissible && !saving}
      testID="template-form-modal"
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} disabled={saving} style={{ flex: 1 }} testID="template-form-cancel" />
          <Button
            title={saving ? 'Saving...' : 'SAVE'}
            loading={saving}
            onPress={onSubmit}
            style={{ flex: 1 }}
            testID="template-form-save"
          />
        </View>
      }
    >
      <View style={{ gap: spacing.lg }}>{children}</View>
    </Modal>
  );
}
