import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { elevation, radii, spacing, useTheme } from '@/theme';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Text } from '../Text';
import { useInsets } from './insets';
import { useTopOverlay } from './overlayStore';
import { removeToast, useToastItems, type ToastItemData, type ToastKind } from './toastStore';
import { Touchable } from './Touchable';
import { nativeDriver } from './web';

const ICONS: Record<ToastKind, IconName> = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'info',
  warning: 'alert',
};

function ToastItem({ item }: { item: ToastItemData }) {
  const { colors } = useTheme();
  const [anim] = useState(() => new Animated.Value(0));
  const leaving = useRef(false);

  const dismiss = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(anim, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: nativeDriver }).start(() => removeToast(item.id));
  }, [anim, item.id]);

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
    if (item.duration <= 0) return undefined;
    const t = setTimeout(dismiss, item.duration);
    return () => clearTimeout(t);
  }, [anim, dismiss, item.duration]);

  const tone =
    item.kind === 'success'
      ? { fg: colors.success, bg: colors.successSoft }
      : item.kind === 'error'
        ? { fg: colors.danger, bg: colors.dangerSoft }
        : item.kind === 'warning'
          ? { fg: colors.warning, bg: colors.warningSoft }
          : { fg: colors.info, bg: colors.infoSoft };

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        width: '100%',
        maxWidth: 440,
        marginBottom: spacing.sm,
      }}
    >
      <Touchable
        onPress={dismiss}
        accessibilityRole="alert"
        accessibilityLabel={`${item.kind}: ${item.message}`}
        accessibilityLiveRegion={item.kind === 'error' ? 'assertive' : 'polite'}
        pressedStyle={{ opacity: 0.9 }}
        radius={radii.md}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radii.md,
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor: colors.border,
          ...elevation.lg(colors.shadow),
        }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={ICONS[item.kind]} size={18} color={tone.fg} />
        </View>
        <View style={{ flex: 1 }}>
          {item.title ? (
            <Text variant="bodyStrong" numberOfLines={1}>
              {item.title}
            </Text>
          ) : null}
          <Text variant={item.title ? 'callout' : 'bodyStrong'} color={item.title ? 'textSecondary' : 'text'} numberOfLines={4}>
            {item.message}
          </Text>
        </View>
        {item.action ? (
          <Touchable
            onPress={() => {
              item.action?.onPress();
              dismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel={item.action.label}
            hitSlop={8}
          >
            <Text variant="callout" weight="bold" color={tone.fg}>
              {item.action.label}
            </Text>
          </Touchable>
        ) : null}
      </Touchable>
    </Animated.View>
  );
}

/**
 * Renders the toast stack. `scope='root'` is mounted once by `ToastProvider`; overlays mount a layer scoped to
 * their own id so toasts stay visible above native modals. Only the scope owning the top-most overlay renders.
 */
export function ToastLayer({ scope }: { scope: 'root' | number }) {
  const items = useToastItems();
  const top = useTopOverlay();
  const insets = useInsets();
  const active = scope === 'root' ? top === null : top === scope;
  if (!active || items.length === 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + spacing.sm,
        left: 0,
        right: 0,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        zIndex: 99999,
        pointerEvents: 'box-none',
      }}
    >
      {items.map((t) => (
        <ToastItem key={t.id} item={t} />
      ))}
    </View>
  );
}
