import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountBadge, Icon, Text } from '@/components/ui';
import { useTheme, type Theme } from '@/theme';
import { tabBarHeight } from '@/theme/tokens';
import { useIsWideShell, useShellNav } from './useShellNav';

/**
 * Bottom tab bar (phones / narrow windows). Rendered by the `(tabs)` layouts through the navigator's `tabBar`
 * option. Returns nothing on wide screens, where `AppShell` shows the sidebar instead.
 * iOS: translucent blurred bar; Android / web: solid surface.
 */
export function TabBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const wide = useIsWideShell();
  const { items, onPress } = useShellNav();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (wide) return null;

  const isIOS = Platform.OS === 'ios';
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 6 : 0);

  return (
    <View
      testID="tab-bar"
      accessibilityRole="tablist"
      style={[styles.bar, isIOS ? styles.barTranslucent : styles.barSolid, { paddingBottom: bottomPad, height: tabBarHeight + bottomPad }]}
    >
      {isIOS ? <BlurView intensity={70} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
      {items.map((item) => {
        const color = item.active ? theme.colors.primary : theme.colors.textMuted;
        const label = item.badge > 0 ? `${item.label}, ${item.badge} unread` : item.label;
        return (
          <Pressable
            key={item.key}
            testID={`tab-${item.key}`}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: item.active }}
            onPress={() => onPress(item.key)}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <View style={[styles.iconWrap, item.active && styles.iconWrapActive]}>
              <Icon name={item.icon} size={22} color={color} strokeWidth={item.active ? 2.4 : 2} />
              {item.badge > 0 ? (
                <View style={styles.badge} testID={`tab-badge-${item.key}`} pointerEvents="none">
                  <CountBadge count={item.badge} />
                </View>
              ) : null}
            </View>
            <Text variant="micro" color={color} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingTop: theme.spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      overflow: 'hidden',
    },
    barSolid: { backgroundColor: theme.colors.surface },
    barTranslucent: { backgroundColor: theme.colors.tabBar },
    item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, gap: 2, paddingVertical: theme.spacing.xs },
    itemPressed: { opacity: 0.7 },
    iconWrap: {
      minWidth: 52,
      height: 30,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapActive: { backgroundColor: theme.colors.primarySoft },
    badge: { position: 'absolute', top: -6, right: 2 },
  });
