import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Icon, Modal, Text, TextField } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import { isDeleteConfirmValid } from '../../utils/staffActions';

export interface DeleteStaffDialogProps {
  visible: boolean;
  staffName: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Type-the-name confirmation for the irreversible permanent delete (role 1 only). */
export function DeleteStaffDialog({ visible, staffName, deleting, onClose, onConfirm }: DeleteStaffDialogProps) {
  const { colors } = useTheme();
  const [typed, setTyped] = useState('');
  const valid = isDeleteConfirmValid(typed, staffName);

  const close = () => {
    if (deleting) return;
    setTyped('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={close}
      dismissible={!deleting}
      size="sm"
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button title="Cancel" variant="secondary" onPress={close} disabled={deleting} fullWidth />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={deleting ? 'Deleting...' : 'Delete'}
              variant="danger"
              loading={deleting}
              disabled={!valid || deleting}
              onPress={onConfirm}
              fullWidth
              testID="delete-confirm"
            />
          </View>
        </View>
      }
    >
      <View style={{ gap: spacing.md, alignItems: 'center' }} testID="delete-dialog">
        <View style={{ width: 56, height: 56, borderRadius: radii.lg, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="alert" size={28} color="danger" />
        </View>
        <Text variant="title3" align="center">{`Permanently Delete ${staffName}?`}</Text>
        <Text variant="callout" color="textSecondary" align="center">
          All records related to this employee — attendance, salary, requests, chat, and photos — will be permanently removed from our systems. This action cannot be undone.
        </Text>
        <View style={{ alignSelf: 'stretch', gap: spacing.xs }}>
          <Text variant="callout">
            {'Type '}
            <Text variant="callout" weight="bold">
              {staffName}
            </Text>
            {' to confirm'}
          </Text>
          <TextField
            value={typed}
            onChangeText={setTyped}
            placeholder={staffName}
            editable={!deleting}
            autoCapitalize="none"
            autoCorrect={false}
            error={typed.length > 0 && !valid}
            accessibilityLabel="Type the staff name to confirm"
            testID="delete-name-input"
          />
        </View>
      </View>
    </Modal>
  );
}
