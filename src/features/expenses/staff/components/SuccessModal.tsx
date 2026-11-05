import React from 'react';
import { View } from 'react-native';

import { Button, Icon, Modal, Text, type IconName } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

export type SuccessModalProps = {
  visible: boolean;
  title: string;
  message: string;
  /** Extra line under the message (e.g. the computed distance). */
  detail?: string;
  icon?: IconName;
  actionLabel: string;
  onClose: () => void;
  testID?: string;
};

/** Confirmation dialog that stays until the user taps the action button. */
export function SuccessModal({ visible, title, message, detail, icon = 'check-circle', actionLabel, onClose, testID }: SuccessModalProps) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} onClose={onClose} size="sm" testID={testID}>
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
        <View style={{ width: 72, height: 72, borderRadius: radii.pill, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={38} color="success" />
        </View>
        <Text variant="title2" align="center">
          {title}
        </Text>
        <Text variant="body" color="textSecondary" align="center">
          {message}
        </Text>
        {detail ? (
          <Text variant="title3" color="primary" align="center" testID="success-detail">
            {detail}
          </Text>
        ) : null}
        <Button title={actionLabel} onPress={onClose} fullWidth style={{ marginTop: spacing.sm }} />
      </View>
    </Modal>
  );
}
