import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { Screen, ResponsiveRow } from '@/components/layout';
import { Badge, Card, Icon, Reveal, SkeletonList, Text, useToast } from '@/components/ui';
import { requestLocationPermission } from '@/lib/platform/location';
import { getPermissionDetail, openAppSettings, requestPermission } from '@/lib/platform/permissions';
import { radii, spacing, useTheme } from '@/theme';

import { PermissionCard } from '../components/PermissionCard';
import { usePermissionStatuses } from '../hooks/usePermissionStatuses';
import { PERMISSIONS, countGranted, permissionAction, type PermissionMeta } from '../utils/permissionsLogic';

/** Device permission status (location, camera, notifications, photos) with grant buttons; re-checks on app foreground. */
export default function PermissionsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const { map, loaded, refresh } = usePermissionStatuses();
  const [busy, setBusy] = useState<string | null>(null);

  const granted = countGranted(map);
  const total = PERMISSIONS.length;
  const allGranted = granted === total;

  const explainBrowser = (meta: PermissionMeta) =>
    toast.info(`Allow ${meta.label.toLowerCase()} for this site in your browser's site settings, then reload the page.`);

  const onCardPress = async (meta: PermissionMeta) => {
    if (busy) return;
    const action = permissionAction(map[meta.kind], Platform.OS);
    if (action === 'none') return;
    if (action === 'open-settings') {
      openAppSettings(); // status is re-read when the app returns to the foreground
      return;
    }
    if (action === 'browser-instructions') {
      explainBrowser(meta);
      return;
    }
    setBusy(meta.kind);
    try {
      const ok = await requestPermission(meta.kind);
      // Android also needs "allow all the time" for background attendance tracking; iOS never asks for it. When the
      // background grant is refused the OS settings page opens (v1 flow), as it does for a refused foreground grant.
      const backgroundRefused =
        ok && meta.kind === 'location' && Platform.OS === 'android' ? !(await requestLocationPermission('background')) : false;
      await refresh();
      if (backgroundRefused) {
        openAppSettings();
      } else if (!ok) {
        const detail = await getPermissionDetail(meta.kind);
        const next = permissionAction(detail, Platform.OS);
        if (next === 'open-settings') openAppSettings();
        else if (next === 'browser-instructions') explainBrowser(meta);
      }
    } catch {
      toast.error('Could not update the permission. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      title="App Permissions"
      subtitle={`${granted} of ${total} permissions granted`}
      right={<Badge label={allGranted ? 'All Active' : `${total - granted} Pending`} tone={allGranted ? 'success' : 'warning'} testID="permissions-pill" />}
      testID="permissions-screen"
    >
      <View style={{ gap: spacing.lg }}>
        <Reveal index={0}>
          <Card variant="muted" testID="permissions-summary">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name="shield-check" size={24} color="primary" />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Permission Status</Text>
                <Text variant="caption" color="textMuted">
                  Tap a card to manage in device settings
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {PERMISSIONS.map((p) => (
                  <View
                    key={p.kind}
                    style={{ width: 10, height: 10, borderRadius: radii.pill, backgroundColor: map[p.kind].status === 'granted' ? colors.success : colors.borderStrong }}
                  />
                ))}
              </View>
            </View>
          </Card>
        </Reveal>

        <Reveal index={1}>
          {!loaded ? (
            <SkeletonList count={4} />
          ) : (
            <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
              {PERMISSIONS.map((meta) => (
                <PermissionCard
                  key={meta.kind}
                  meta={meta}
                  granted={map[meta.kind].status === 'granted'}
                  action={permissionAction(map[meta.kind], Platform.OS)}
                  busy={busy === meta.kind}
                  onPress={() => void onCardPress(meta)}
                />
              ))}
            </ResponsiveRow>
          )}
        </Reveal>

        <Text variant="caption" color="textMuted" align="center">
          Permissions are controlled by your device. Tap any card to open settings.
        </Text>
      </View>
    </Screen>
  );
}
