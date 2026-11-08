import React from 'react';
import { Stack, type NativeStackNavigationOptions } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { ADMIN_AREA_ROLES, STAFF_AREA_ROLES, type Role } from '@/lib/routeGuard';
import { useTheme } from '@/theme';
import { AppShell } from './AppShell';
import { RoleGuard } from './RoleGuard';
import { TabBar } from './TabBar';

/** Tab roots do not animate and cannot be swiped back; every other screen slides in from the right (v1 behaviour). */
export function areaScreenOptions({ route }: { route: { name: string } }): NativeStackNavigationOptions {
  const isTabRoot = route.name === '(tabs)';
  return { headerShown: false, animation: isTabRoot ? 'none' : 'slide_from_right', gestureEnabled: !isTabRoot };
}

function AreaLayout({ allowed }: { allowed: readonly Role[] }) {
  return (
    <RoleGuard allowed={allowed}>
      <AppShell>
        <Stack screenOptions={areaScreenOptions} />
      </AppShell>
    </RoleGuard>
  );
}

/** `src/app/admin/_layout.tsx` — roles 1 and 2. */
export function AdminAreaLayout() {
  return <AreaLayout allowed={ADMIN_AREA_ROLES} />;
}

/** `src/app/staff/_layout.tsx` — roles 2 and 3. */
export function StaffAreaLayout() {
  return <AreaLayout allowed={STAFF_AREA_ROLES} />;
}

/**
 * `(tabs)/_layout.tsx` of both areas: Home / CRM / Chat / Settings with our own bar (bottom bar on phones, nothing
 * on wide screens where the sidebar from `AppShell` takes over); the ADMIN area adds a fifth tab, Support. Android back
 * from another tab returns to Home, and from Home leaves the app.
 */
export function TabsAreaLayout({ variant }: { variant: 'admin' | 'staff' }) {
  const { colors } = useTheme();
  return (
    <Tabs
      backBehavior="firstRoute"
      tabBar={() => <TabBar />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      {/* Expo Router 58: only screens declared here become tabs (order = Home, CRM, Chat, Settings, Support). Support exists for admins only. */}
      <Tabs.Screen name="home" />
      <Tabs.Screen name="crm" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="settings" />
      {variant === 'admin' ? <Tabs.Screen name="help" /> : null}
    </Tabs>
  );
}
