import React, { useEffect, useRef, useState } from 'react';
import { Modal as RNModal, View } from 'react-native';
import { elevation, radii, spacing, useTheme } from '@/theme';
import { Spinner } from './Spinner';
import { Text } from './Text';
import { allocOverlayId, popOverlay, pushOverlay } from './internal/overlayStore';
import { ToastLayer } from './internal/ToastLayer';

export type LoadingOverlayProps = {
  visible: boolean;
  message?: string;
  /** Safety net: call `onTimeout` if still visible after this many ms (0/undefined = off). */
  timeoutMs?: number;
  onTimeout?: () => void;
  testID?: string;
};

/** Full-screen, touch-blocking loading layer (hardware back is swallowed while visible). */
export function LoadingOverlay({ visible, message, timeoutMs, onTimeout, testID }: LoadingOverlayProps) {
  const { colors } = useTheme();
  const cb = useRef(onTimeout);
  useEffect(() => {
    cb.current = onTimeout;
  });

  useEffect(() => {
    if (!visible || !timeoutMs) return undefined;
    const t = setTimeout(() => cb.current?.(), timeoutMs);
    return () => clearTimeout(t);
  }, [visible, timeoutMs]);

  const [overlayId] = useState(allocOverlayId);
  useEffect(() => {
    if (!visible) return undefined;
    pushOverlay(overlayId);
    return () => popOverlay(overlayId);
  }, [visible, overlayId]);

  if (!visible) return null;
  return (
    <RNModal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View
        testID={testID}
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
        accessibilityLabel={message ?? 'Loading'}
        style={{ flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            minWidth: 120,
            maxWidth: 280,
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.xl,
            paddingHorizontal: spacing.xxl,
            borderRadius: radii.lg,
            backgroundColor: colors.surfaceElevated,
            ...elevation.lg(colors.shadow),
          }}
        >
          <Spinner size="large" />
          {message ? (
            <Text variant="callout" color="textSecondary" align="center">
              {message}
            </Text>
          ) : null}
        </View>
        <ToastLayer scope={overlayId} />
      </View>
    </RNModal>
  );
}
