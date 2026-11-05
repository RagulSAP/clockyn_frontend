import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getOrgLogoUrl } from '@/api/auth';
import { Avatar, BrandMark, Button, CountBadge, Icon, Text, useConfirm, type IconName } from '@/components/ui';
import { queryKeys } from '@/lib/query/queryKeys';
import { signOut, useSession } from '@/store/auth';
import { useTheme, useThemePreference, type Theme, type ThemePreference } from '@/theme';
import { sidebarWidth } from '@/theme/tokens';
import { useShellNav } from './useShellNav';

const ROLE_LABEL: Record<number, string> = { 1: 'Admin', 2: 'Manager', 3: 'Staff' };

const THEME_OPTIONS: readonly { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: 'system', label: 'System theme', icon: 'monitor' },
  { value: 'light', label: 'Light theme', icon: 'sun' },
  { value: 'dark', label: 'Dark theme', icon: 'moon' },
];

/**
 * Sidebar for wide web windows and tablets: brand header (organisation), the role's tabs with badges, theme
 * toggle, user card and sign-out. Tabs share their logic (plan gate, badges, navigation) with `TabBar`.
 */
export function SidebarNav() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const confirm = useConfirm();
  const { preference, setPreference } = useThemePreference();
  const { items, onPress } = useShellNav();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const orgId = session?.orgId ?? '';
  const logo = useQuery({
    queryKey: queryKeys.company.logo(orgId),
    queryFn: () => getOrgLogoUrl(orgId),
    enabled: orgId !== '',
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const roleLabel = session ? (ROLE_LABEL[session.roleId] ?? 'Staff') : '';
  const displayName = session?.name || session?.email || roleLabel;

  const handleSignOut = useCallback(async () => {
    const ok = await confirm({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) await signOut({ reason: 'logout' });
  }, [confirm]);

  return (
    <View testID="sidebar" style={[styles.root, { paddingTop: insets.top + theme.spacing.lg, paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
      <View style={styles.header}>
        <Avatar uri={logo.data ?? undefined} name={session?.orgName ?? ''} size={44} />
        <View style={styles.headerText}>
          <Text variant="title3" numberOfLines={1}>
            {session?.orgName || 'Clockyn'}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {roleLabel}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.nav} contentContainerStyle={styles.navContent} showsVerticalScrollIndicator={false}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            testID={`sidebar-${item.key}`}
            accessibilityRole="link"
            accessibilityLabel={item.badge > 0 ? `${item.label}, ${item.badge} unread` : item.label}
            accessibilityState={{ selected: item.active }}
            onPress={() => onPress(item.key)}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.navItem,
              item.active && styles.navItemActive,
              !item.active && hovered ? styles.navItemHover : null,
              pressed && styles.pressed,
            ]}
          >
            <Icon name={item.icon} size={20} color={item.active ? 'primary' : 'textSecondary'} strokeWidth={item.active ? 2.4 : 2} />
            <Text variant={item.active ? 'bodyStrong' : 'callout'} color={item.active ? 'primary' : 'textSecondary'} style={styles.navLabel}>
              {item.label}
            </Text>
            {item.badge > 0 ? <CountBadge count={item.badge} /> : null}
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.themeRow} accessibilityRole="radiogroup" accessibilityLabel="Theme">
          {THEME_OPTIONS.map((opt) => {
            const selected = preference === opt.value;
            return (
              <Pressable
                key={opt.value}
                testID={`theme-${opt.value}`}
                accessibilityRole="radio"
                accessibilityLabel={opt.label}
                accessibilityState={{ selected }}
                onPress={() => setPreference(opt.value)}
                style={[styles.themeOption, selected && styles.themeOptionActive]}
              >
                <Icon name={opt.icon} size={16} color={selected ? 'primary' : 'textMuted'} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.userCard}>
          <Avatar name={displayName} size={36} />
          <View style={styles.headerText}>
            <Text variant="callout" numberOfLines={1}>
              {displayName}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {roleLabel}
            </Text>
          </View>
        </View>

        <Button title="Logout" variant="ghost" icon="logout" onPress={handleSignOut} fullWidth testID="sidebar-signout" />
        <View style={styles.brand}>
          <BrandMark size={18} variant="wordmark" />
        </View>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      width: sidebarWidth,
      backgroundColor: theme.colors.surface,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingBottom: theme.spacing.lg },
    headerText: { flex: 1, minWidth: 0 },
    nav: { flex: 1 },
    navContent: { gap: theme.spacing.xs, paddingVertical: theme.spacing.sm },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: 44,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
    },
    navItemActive: { backgroundColor: theme.colors.primarySoft },
    navItemHover: { backgroundColor: theme.colors.surfaceMuted },
    navLabel: { flex: 1 },
    pressed: { opacity: 0.75 },
    footer: { gap: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    themeRow: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radii.pill,
      padding: theme.spacing.xxs,
    },
    themeOption: { flex: 1, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.pill },
    themeOptionActive: { backgroundColor: theme.colors.surface },
    userCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    brand: { alignItems: 'center', paddingTop: theme.spacing.xs, opacity: 0.8 },
  });
