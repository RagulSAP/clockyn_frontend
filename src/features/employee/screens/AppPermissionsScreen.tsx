import React from 'react';
import { Platform, View } from 'react-native';

import { Screen } from '@/components/layout';
import { Badge, Card, ListItem, Text, useToast, type IconName } from '@/components/ui';
import { openAppSettings, requestPermission, type PermissionKind } from '@/lib/platform/permissions';
import { spacing } from '@/theme';

import { LISTED_PERMISSIONS, usePermissionStatus } from '../hooks/usePermissionStatus';

const META: Record<string, { title: string; icon: IconName; blurb: string }> = {
  location: { title: 'Location', icon: 'map-pin', blurb: 'Verify you are at your branch when punching' },
  camera: { title: 'Camera', icon: 'camera', blurb: 'Face verification and profile photos' },
  notifications: { title: 'Notifications', icon: 'bell', blurb: 'Requests, chat and announcements' },
};

/** Device permission status (Location, Camera, Notifications) with a shortcut to the OS / browser settings. */
export default function AppPermissionsScreen() {
  const toast = useToast();
  const { status, refresh, refreshSoon } = usePermissionStatus();

  const manage = async (kind: PermissionKind) => {
    const detail = status[kind];
    // Not asked yet: show the system prompt. Otherwise the OS settings are the only place to change it.
    if (detail && detail.status === 'undetermined' && detail.canAskAgain) {
      await requestPermission(kind);
      await refresh();
      return;
    }
    if (Platform.OS === 'web') {
      toast.info("Change this in your browser's site settings.");
      return;
    }
    openAppSettings();
    refreshSoon();
  };

  return (
    <Screen title="App Permissions" subtitle="Tap a permission to manage it" testID="permissions-screen">
      <Card padding={0}>
        {LISTED_PERMISSIONS.map((kind, i) => {
          const meta = META[kind];
          const enabled = status[kind]?.status === 'granted';
          return (
            <ListItem
              key={kind}
              testID={`permission-${kind}`}
              icon={meta.icon}
              iconTone={enabled ? 'success' : 'neutral'}
              title={meta.title}
              subtitle={meta.blurb}
              right={<Badge label={enabled ? 'Enabled' : 'Disabled'} tone={enabled ? 'success' : 'neutral'} />}
              onPress={() => void manage(kind)}
              divider={i < LISTED_PERMISSIONS.length - 1}
            />
          );
        })}
      </Card>
      <View style={{ marginTop: spacing.lg }}>
        <Text variant="caption" color="textMuted">
          {Platform.OS === 'web' ? 'Browsers manage permissions per site: use the lock icon in the address bar.' : 'Statuses refresh when you return from the system settings.'}
        </Text>
      </View>
    </Screen>
  );
}
