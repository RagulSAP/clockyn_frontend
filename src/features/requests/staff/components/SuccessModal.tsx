import React from 'react';
import { View } from 'react-native';

import { Button, Icon, Modal, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

export type SuccessModalProps = {
  visible: boolean;
  title: string;
  message: string;
  /** Closing is handled by the caller (auto-dismiss timers). The dialog has no close button. */
  onClose?: () => void;
  actionLabel?: string;
  testID?: string;
};

/** "Submitted!" confirmation shown for a moment after a request is sent. */
export function SuccessModal({ visible, title, message, onClose, actionLabel, testID }: SuccessModalProps) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} onClose={onClose ?? (() => undefined)} dismissible={false} size="sm" testID={testID}>
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radii.pill,
            backgroundColor: colors.successSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="check-circle" size={40} color="success" />
        </View>
        <Text variant="title2" align="center">
          {title}
        </Text>
        <Text variant="body" color="textSecondary" align="center">
          {message}
        </Text>
        {actionLabel && onClose ? <Button title={actionLabel} onPress={onClose} fullWidth style={{ marginTop: spacing.sm }} /> : null}
      </View>
    </Modal>
  );
}
