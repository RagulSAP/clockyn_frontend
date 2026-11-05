import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal as RNModal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { breakpoints, elevation, motion, radii, spacing, useTheme } from '@/theme';
import { IconButton } from '../Button';
import { Text } from '../Text';
import { useInsets } from './insets';
import { allocOverlayId, popOverlay, pushOverlay } from './overlayStore';
import { ToastLayer } from './ToastLayer';
import { nativeDriver } from './web';

export type OverlaySize = 'sm' | 'md' | 'lg';
export type SheetSnap = 'auto' | 'half' | 'tall' | 'full';

const DIALOG_WIDTH: Record<OverlaySize, number> = { sm: 380, md: 520, lg: 720 };
const SNAP_RATIO: Record<SheetSnap, number | null> = { auto: null, half: 0.55, tall: 0.75, full: 0.92 };

export type OverlayShellProps = {
  visible: boolean;
  onClose: () => void;
  dismissible?: boolean;
  presentation: 'dialog' | 'sheet';
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: OverlaySize;
  snap?: SheetSnap;
  /** Wrap the body in a ScrollView (default). Disable when the body manages its own scrolling (FlatList). */
  scrollable?: boolean;
  /** Remove the default body padding (e.g. edge-to-edge lists). */
  flush?: boolean;
  testID?: string;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Mount/unmount with an exit animation. `anim` runs 0 -> 1 on open and back on close. */
function useTransition(visible: boolean) {
  const [mounted, setMounted] = useState(visible);
  const [anim] = useState(() => new Animated.Value(visible ? 1 : 0));
  if (visible && !mounted) setMounted(true);
  useEffect(() => {
    if (visible) {
      Animated.timing(anim, { toValue: 1, duration: motion.base, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
      return undefined;
    }
    Animated.timing(anim, { toValue: 0, duration: motion.fast + 40, easing: Easing.in(Easing.cubic), useNativeDriver: nativeDriver }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
    return undefined;
  }, [visible, anim]);
  return { mounted, anim };
}

/**
 * Shared engine behind Modal and BottomSheet. Built on RN Modal (separate window on native, portal on web),
 * with our own backdrop/transition, keyboard avoidance and a toast layer so toasts stay visible on top.
 */
export function OverlayShell({
  visible,
  onClose,
  dismissible = true,
  presentation,
  title,
  children,
  footer,
  size = 'md',
  snap = 'auto',
  scrollable = true,
  flush,
  testID,
  contentStyle,
}: OverlayShellProps) {
  const { colors } = useTheme();
  const insets = useInsets();
  const { width, height } = useWindowDimensions();
  const { mounted, anim } = useTransition(visible);
  const [overlayId] = useState(allocOverlayId);
  const [drag] = useState(() => new Animated.Value(0));

  // register as an overlay while mounted (toast layer routing)
  useEffect(() => {
    if (!mounted) return undefined;
    pushOverlay(overlayId);
    return () => popOverlay(overlayId);
  }, [mounted, overlayId]);

  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);

  const isSheet = presentation === 'sheet';
  const ratio = SNAP_RATIO[snap];
  const fixedHeight = ratio ? Math.round(height * ratio) : undefined;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => isSheet && dismissible && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          if (g.dy > 0) drag.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 110 || g.vy > 0.9) {
            onClose();
          } else {
            Animated.spring(drag, { toValue: 0, useNativeDriver: nativeDriver, bounciness: 4 }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(drag, { toValue: 0, useNativeDriver: nativeDriver }).start();
        },
      }),
    [isSheet, dismissible, drag, onClose],
  );

  if (!mounted) return null;

  const panelBase: ViewStyle = {
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    ...elevation.lg(colors.shadow),
  };

  const panel: Animated.WithAnimatedValue<ViewStyle> = isSheet
    ? {
        ...panelBase,
        width: '100%',
        maxWidth: 720,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        height: fixedHeight,
        maxHeight: height * 0.92,
        paddingBottom: Math.max(insets.bottom, spacing.lg),
        transform: [
          { translateY: Animated.add(anim.interpolate({ inputRange: [0, 1], outputRange: [Math.min(height, 700), 0] }), drag) },
        ],
      }
    : {
        ...panelBase,
        width: '100%',
        maxWidth: Math.min(DIALOG_WIDTH[size], width - spacing.xl * 2),
        borderRadius: radii.xl,
        height: fixedHeight,
        maxHeight: height * 0.88,
        opacity: anim,
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
      };

  const bodyPad = flush ? 0 : spacing.lg;
  const handleClose = () => {
    if (dismissible) onClose();
  };

  return (
    <RNModal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
      supportedOrientations={['portrait', 'landscape', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    >
      <View style={{ flex: 1 }} testID={testID}>
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay, opacity: anim }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            disabled={!dismissible}
            // keep the scrim out of the tab order on web
            focusable={false}
          />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'web' ? undefined : 'padding'}
          style={{
            flex: 1,
            justifyContent: isSheet ? 'flex-end' : 'center',
            alignItems: 'center',
            paddingHorizontal: isSheet ? 0 : spacing.xl,
            paddingTop: insets.top,
            pointerEvents: 'box-none',
          }}
        >
          <Animated.View
            style={panel}
            accessibilityViewIsModal
            role="dialog"
            aria-modal
            accessibilityLabel={title}
          >
            {isSheet ? (
              <View {...pan.panHandlers} style={{ alignItems: 'center', paddingTop: spacing.sm + 2, paddingBottom: spacing.xs }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
              </View>
            ) : null}

            {title || (dismissible && !isSheet) ? (
              <View
                {...(isSheet ? pan.panHandlers : {})}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingLeft: spacing.xl,
                  paddingRight: spacing.sm,
                  paddingTop: isSheet ? spacing.xs : spacing.md,
                  paddingBottom: spacing.sm,
                  minHeight: 52,
                }}
              >
                <Text variant="title3" style={{ flex: 1 }} numberOfLines={2} accessibilityRole="header">
                  {title ?? ''}
                </Text>
                {dismissible ? <IconButton icon="x" size="sm" onPress={onClose} accessibilityLabel="Close dialog" /> : null}
              </View>
            ) : null}

            {scrollable ? (
              <ScrollView
                style={{ flexShrink: 1, flexGrow: fixedHeight ? 1 : 0 }}
                contentContainerStyle={[{ padding: bodyPad, paddingTop: title ? spacing.xs : bodyPad }, contentStyle]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[{ flexShrink: 1, flexGrow: fixedHeight ? 1 : 0, padding: bodyPad, paddingTop: title ? spacing.xs : bodyPad }, contentStyle]}>
                {children}
              </View>
            )}

            {footer ? (
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.md,
                  paddingBottom: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>

        <ToastLayer scope={overlayId} />
      </View>
    </RNModal>
  );
}

/** True when the viewport is wide enough that sheets should present as centred dialogs. */
export function useIsWideViewport(): boolean {
  const { width } = useWindowDimensions();
  return width >= breakpoints.tablet;
}
