import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { OverlayShell, type OverlaySize } from './internal/OverlayShell';

export type ModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  /** Sticky footer, usually action buttons. */
  footer?: React.ReactNode;
  /** When false the scrim, close button and hardware back do nothing. Default true. */
  dismissible?: boolean;
  /** Dialog width cap: sm 380 / md 520 / lg 720. */
  size?: OverlaySize;
  /** Remove body padding (edge-to-edge content). */
  flush?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Centred dialog with scrim, exit animation, Escape/back handling and toasts rendered above it. */
export function Modal({ visible, onClose, title, children, footer, dismissible = true, size = 'md', flush, contentStyle, testID }: ModalProps) {
  return (
    <OverlayShell
      visible={visible}
      onClose={onClose}
      title={title}
      footer={footer}
      dismissible={dismissible}
      size={size}
      flush={flush}
      contentStyle={contentStyle}
      testID={testID}
      presentation="dialog"
    >
      {children}
    </OverlayShell>
  );
}
