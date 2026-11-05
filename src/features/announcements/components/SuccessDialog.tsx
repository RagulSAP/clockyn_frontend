import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Modal, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';
import { SUCCESS_DIALOG_MS } from '../targets';

/**
 * State of the "Announcement Sent!" dialog. The subtitle is passed in `show()` (computed from the draft BEFORE the
 * form resets). Auto-closes after `SUCCESS_DIALOG_MS`; the timer is restarted by a new `show()` and cleared on
 * unmount (v1 left the first timer running, closing a second dialog early).
 */
export function useSuccessDialog(): { subtitle: string | null; show: (subtitle: string) => void; hide: () => void } {
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const hide = useCallback(() => {
    clear();
    setSubtitle(null);
  }, [clear]);
  const show = useCallback(
    (text: string) => {
      clear();
      setSubtitle(text);
      timer.current = setTimeout(() => {
        timer.current = null;
        setSubtitle(null);
      }, SUCCESS_DIALOG_MS);
    },
    [clear],
  );

  useEffect(() => clear, [clear]);
  return { subtitle, show, hide };
}

export type SuccessDialogProps = { subtitle: string | null; onClose: () => void };

/** Tap anywhere to dismiss. */
export function SuccessDialog({ subtitle, onClose }: SuccessDialogProps) {
  const { colors } = useTheme();
  return (
    <Modal visible={subtitle !== null} onClose={onClose} size="sm" testID="announcement-success">
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onClose} style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check-circle" size={34} color="success" />
        </View>
        <Text variant="title2" align="center">
          Announcement Sent!
        </Text>
        <Text variant="body" color="textSecondary" align="center" testID="announcement-success-subtitle">
          {subtitle ?? ''}
        </Text>
      </Pressable>
    </Modal>
  );
}
