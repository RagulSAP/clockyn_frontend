import React, { useCallback, useEffect, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { spacing, useTheme } from '@/theme';
import { Button } from './Button';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { Text } from './Text';
import { haptic } from './internal/haptics';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Styles the confirm button as destructive. */
  destructive?: boolean;
  /** Hide the cancel button (acknowledge-only dialog). */
  hideCancel?: boolean;
};

export type ConfirmDialogProps = ConfirmOptions & {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  testID?: string;
};

/** Controlled confirmation dialog. Prefer `useConfirm()` for the promise-based flow. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive,
  hideCancel,
  loading,
  onConfirm,
  onCancel,
  testID,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  useEffect(() => {
    if (visible && destructive) haptic('warning');
  }, [visible, destructive]);

  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      size="sm"
      dismissible={!loading}
      testID={testID}
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end', paddingBottom: spacing.xs }}>
          {hideCancel ? null : <Button title={cancelText} variant="secondary" onPress={onCancel} disabled={loading} style={{ flex: 1 }} />}
          <Button
            title={confirmText}
            variant={destructive ? 'danger' : 'primary'}
            onPress={onConfirm}
            loading={loading}
            style={{ flex: 1 }}
            testID={testID ? `${testID}-confirm` : undefined}
          />
        </View>
      }
    >
      <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: destructive ? colors.dangerSoft : colors.primarySoft,
          }}
        >
          <Icon name={destructive ? 'alert' : 'help-circle'} size={26} color={destructive ? 'danger' : 'primary'} />
        </View>
        <Text variant="title3" align="center" accessibilityRole="header">
          {title}
        </Text>
        {message ? (
          <Text variant="body" color="textSecondary" align="center">
            {message}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Promise-based confirm flow. A single ConfirmHost (mounted by ToastProvider) renders the dialog.
// ---------------------------------------------------------------------------------------------
type Request = { id: number; options: ConfirmOptions; resolve: (ok: boolean) => void };

let queue: Request[] = [];
let nextId = 1;
let hostCount = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function confirmImpl(options: ConfirmOptions): Promise<boolean> {
  if (hostCount === 0) {
    console.warn('useConfirm(): no <ToastProvider> mounted, so no confirm dialog can be shown. Resolving false.');
    return Promise.resolve(false);
  }
  return new Promise<boolean>((resolve) => {
    queue = [...queue, { id: nextId++, options, resolve }];
    emit();
  });
}

function settle(ok: boolean) {
  const head = queue[0];
  if (!head) return;
  queue = queue.slice(1);
  emit();
  head.resolve(ok);
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getHead = () => queue[0] ?? null;

/** `const ok = await confirm({ title, message, destructive })`. Stable identity across renders. */
export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return useCallback((options: ConfirmOptions) => confirmImpl(options), []);
}

/** Non-hook access for use outside components. */
export const confirm = confirmImpl;

export function ConfirmHost() {
  useEffect(() => {
    hostCount += 1;
    return () => {
      hostCount -= 1;
      if (hostCount === 0) {
        // resolve anything pending so callers never hang
        const pending = queue;
        queue = [];
        pending.forEach((r) => r.resolve(false));
      }
    };
  }, []);
  const head = useSyncExternalStore(subscribe, getHead, getHead);
  // keep the last options around while the exit animation runs
  const [shown, setShown] = React.useState<ConfirmOptions | null>(null);
  if (head && head.options !== shown) setShown(head.options);
  if (!shown) return null;
  return (
    <ConfirmDialog
      {...shown}
      visible={!!head}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );
}
