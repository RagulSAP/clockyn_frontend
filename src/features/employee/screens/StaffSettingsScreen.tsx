import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout';
import { BottomSheet, Button, Card, ListItem, SectionHeader, SegmentedControl, useConfirm, useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { routes, useAppRouter, type AppRoute } from '@/lib/navigation';
import { signOut, useManagerPermissions, useRole } from '@/store/auth';
import { spacing, useThemePreference, type ThemePreference } from '@/theme';

import { availableAdminShortcuts, type AdminShortcut } from '../utils/managerShortcuts';

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

/**
 * Settings tab of staff and managers: permission-gated admin shortcuts (managers), general settings, appearance,
 * More Options and logout.
 */
export default function StaffSettingsScreen() {
  const router = useAppRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const role = useRole();
  const permissions = useManagerPermissions();
  const { preference, setPreference } = useThemePreference();
  const [menu, setMenu] = useState<AdminShortcut | null>(null);

  const shortcuts = useMemo(() => availableAdminShortcuts(role, permissions), [role, permissions]);

  const open = (shortcut: AdminShortcut) => {
    if (shortcut.options) setMenu(shortcut);
    else if (shortcut.route) router.push(shortcut.route);
  };
  // The sheet closes first, then the target opens.
  const go = (route: AppRoute) => {
    setMenu(null);
    router.push(route);
  };

  const logout = async () => {
    const ok = await confirm({ title: 'Confirm Logout', message: 'Are you sure you want to logout?', confirmText: 'Logout', destructive: true });
    if (!ok) return;
    try {
      // Sign-out stops location tracking and clears caches; the guards then show the welcome screen.
      await signOut();
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not log out. Please try again.'));
    }
  };

  return (
    <Screen title="Settings" hideBack edges={['top']} testID="staff-settings">
      <View style={{ gap: spacing.xl }}>
        {shortcuts.length > 0 ? (
          <View style={{ gap: spacing.sm }} testID="admin-shortcuts">
            <SectionHeader title="Admin Settings" />
            <Card padding={0}>
              {shortcuts.map((s, i) => (
                <ListItem
                  key={s.permission}
                  testID={`shortcut-${s.permission}`}
                  icon={s.icon}
                  iconTone="primary"
                  title={s.title}
                  onPress={() => open(s)}
                  divider={i < shortcuts.length - 1}
                />
              ))}
            </Card>
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="General Settings" />
          <Card padding={0}>
            <ListItem testID="row-profile" icon="user" iconTone="primary" title="Profile Settings" onPress={() => router.push(routes.staff.profile)} divider />
            <ListItem testID="row-permissions" icon="shield-check" iconTone="primary" title="App Permissions" onPress={() => router.push(routes.staff.permissions)} divider />
            <ListItem testID="row-appearance" icon="palette" iconTone="primary" title="Appearance" subtitle="Choose a light, dark or system theme" />
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
              <SegmentedControl options={THEME_OPTIONS} value={preference} onChange={setPreference} testID="appearance-control" />
            </View>
            <ListItem testID="row-more" icon="more-horizontal" iconTone="neutral" title="More Options" onPress={() => router.push(routes.staff.more)} />
          </Card>
        </View>

        <Button title="Logout" variant="danger" icon="logout" onPress={() => void logout()} fullWidth testID="logout" />
      </View>

      <BottomSheet visible={menu !== null} onClose={() => setMenu(null)} title={menu?.title} snap="auto" testID="shortcut-sheet">
        <View>
          {menu?.options?.map((o, i) => (
            <ListItem key={o.label} testID={`option-${o.label}`} title={o.label} onPress={() => go(o.route)} divider={i < (menu.options?.length ?? 0) - 1} />
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}
