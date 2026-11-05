import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { OverlayShell, useIsWideViewport, type OverlaySize, type SheetSnap } from './internal/OverlayShell';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** `auto` sizes to content (max 92%); `half` / `tall` / `full` use a fixed share of the window height. */
  snap?: SheetSnap;
  /** Wrap children in a ScrollView (default). Turn off when children bring their own list. */
  scrollable?: boolean;
  flush?: boolean;
  dismissible?: boolean;
  /** Width cap when presented as a dialog on wide screens. */
  size?: OverlaySize;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Bottom sheet with drag-to-dismiss on phones; centred dialog on tablet / desktop web. */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  snap = 'auto',
  scrollable = true,
  flush,
  dismissible = true,
  size = 'md',
  contentStyle,
  testID,
}: BottomSheetProps) {
  const wide = useIsWideViewport();
  return (
    <OverlayShell
      visible={visible}
      onClose={onClose}
      title={title}
      footer={footer}
      snap={snap}
      scrollable={scrollable}
      flush={flush}
      dismissible={dismissible}
      size={size}
      contentStyle={contentStyle}
      testID={testID}
      presentation={wide ? 'dialog' : 'sheet'}
    >
      {children}
    </OverlayShell>
  );
}
