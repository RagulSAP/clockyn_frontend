import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, type Href } from 'expo-router';

import { Spinner } from '@/components/ui';
import { resolveAreaGuard, type Role } from '@/lib/routeGuard';
import { useAuthHydrated, useRole } from '@/store/auth';
import { useTheme } from '@/theme';

/**
 * Guards a role area. Reactive to the auth store: when the session disappears (sign-out, forced logout,
 * account deleted) every guarded screen redirects to the welcome screen on its own, so no screen has to call
 * `router.replace('/')` after `signOut()`.
 */
export function RoleGuard({ allowed, children }: { allowed: readonly Role[]; children: React.ReactNode }) {
  const hydrated = useAuthHydrated();
  const role = useRole();
  const { colors } = useTheme();
  const decision = resolveAreaGuard({ hydrated, role, allowed });

  if (decision.status === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]} testID="guard-loading">
        <Spinner />
      </View>
    );
  }
  if (decision.status === 'redirect') return <Redirect href={decision.href as Href} />;
  return <>{children}</>;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
