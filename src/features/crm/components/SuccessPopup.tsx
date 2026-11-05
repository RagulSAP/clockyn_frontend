import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { Icon, Modal, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

export interface SuccessPopupProps {
  visible: boolean;
  message: string;
  detail?: string;
  /** Auto-dismiss delay (v1: 2 s assign, 1 s save, 2.5 s carry-forward request). */
  durationMs?: number;
  /** Called on tap-away and when the timer fires. */
  onDismiss: () => void;
}

/** Green-check confirmation dialog that dismisses itself; the timer is cleared on unmount. */
export function SuccessPopup({ visible, message, detail, durationMs = 2000, onDismiss }: SuccessPopupProps) {
  const { colors } = useTheme();
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(() => dismissRef.current(), durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs]);

  return (
    <Modal visible={visible} onClose={onDismiss} size="sm" testID="crm-success-popup">
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
        <View style={{ width: 64, height: 64, borderRadius: radii.pill, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={32} color="success" strokeWidth={3} />
        </View>
        <Text variant="title2" align="center">
          {message}
        </Text>
        {detail ? (
          <Text variant="callout" color="textSecondary" align="center">
            {detail}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}
