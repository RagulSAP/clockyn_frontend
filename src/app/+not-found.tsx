import React from 'react';
import { Stack } from 'expo-router';

import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui';
import { routes, useAppRouter } from '@/lib/navigation';
import { useRole } from '@/store/auth';

/** Unknown route / stale deep link. Offers the way back to the role's home (or the welcome screen when signed out). */
export default function NotFoundScreen() {
  const router = useAppRouter();
  const role = useRole();

  return (
    <>
      <Stack.Screen options={{ title: 'Page not found' }} />
      <Screen scroll={false}>
        <EmptyState
          icon="search"
          title="Page not found"
          message="The page you are looking for does not exist or has moved."
          action={{
            label: role ? 'Go to home' : 'Go to welcome',
            onPress: () => (role ? router.goHome(role) : router.replace(routes.welcome)),
          }}
        />
      </Screen>
    </>
  );
}
