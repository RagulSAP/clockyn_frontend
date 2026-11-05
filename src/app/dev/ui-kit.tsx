import React from 'react';
import { Redirect } from 'expo-router';
import { ToastProvider } from '@/components/ui';

/**
 * Dev-only visual gallery of every design-system component (used by QA for light/dark checks).
 * Outside `__DEV__` the route redirects home, and the gallery module is not loaded at all.
 */
export default function UiKitRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  // Lazy require so production bundles drop the gallery (the branch above is dead code there).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { UiKitGallery } = require('@/components/ui/dev/UiKitGallery') as typeof import('@/components/ui/dev/UiKitGallery');
  return (
    <ToastProvider>
      <UiKitGallery />
    </ToastProvider>
  );
}
