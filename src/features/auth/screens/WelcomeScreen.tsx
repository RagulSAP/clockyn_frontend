import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, type Href } from 'expo-router';

import { Card, Divider, Icon, Reveal, Text } from '@/components/ui';
import { useRootRedirect } from '@/hooks';
import { routes, useAppRouter } from '@/lib/navigation';
import { signOutNoticeMessage, useUiStore } from '@/store/ui';
import { spacing } from '@/theme';

import { AuthShell, FEATURE_ITEMS } from '../components/AuthShell';
import { InfoBox } from '../components/InfoBox';
import { PortalCard } from '../components/PortalCard';

/** Welcome / role chooser. Signed-in users are redirected to their role home (reactively). */
export default function WelcomeScreen() {
  const { ready, href } = useRootRedirect();
  const router = useAppRouter();
  // The sign-out reason (forced / deleted) is captured on mount, shown once, then forgotten.
  const [notice] = useState(() => signOutNoticeMessage(useUiStore.getState().signOutNotice));
  useEffect(() => {
    useUiStore.getState().clearSignOutNotice();
  }, []);

  if (!ready) return null;
  if (href) return <Redirect href={href as Href} />;

  return (
    <AuthShell>
      <Card padding={spacing.xl} style={{ gap: spacing.xl }} testID="welcome-card">
        <View>
          <Text variant="title1">Get Started</Text>
          <Text variant="body" color="textSecondary">
            Select how you&apos;d like to sign in
          </Text>
        </View>

        {notice ? <InfoBox tone="warning" message={notice} testID="signout-notice" /> : null}

        <View style={{ gap: spacing.md }}>
          <Reveal index={1}>
            <PortalCard
              icon="briefcase"
              title="Admin Portal"
              description="Dashboard, staff & reports"
              tone="primary"
              onPress={() => router.push(routes.adminLogin)}
              testID="portal-admin"
            />
          </Reveal>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Divider style={{ flex: 1 }} />
            <Text variant="micro" color="textMuted">
              OR
            </Text>
            <Divider style={{ flex: 1 }} />
          </View>
          <Reveal index={2}>
            <PortalCard
              icon="fingerprint"
              title="Employee Access"
              description="Attendance & personal records"
              tone="success"
              onPress={() => router.push(routes.staffLogin)}
              testID="portal-staff"
            />
          </Reveal>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {FEATURE_ITEMS.map((item) => (
            <View key={item.label} style={{ alignItems: 'center', gap: spacing.xs, flex: 1 }}>
              <Icon name={item.icon} size={20} color="primary" />
              <Text variant="caption" color="textSecondary">
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </AuthShell>
  );
}
