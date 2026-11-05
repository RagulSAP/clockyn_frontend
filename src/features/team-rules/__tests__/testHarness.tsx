import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { ThemeProvider } from '@/theme';

/** Renders a screen inside theme + query client + toast/confirm host (no retries, cache kept for the test). */
export function renderScreen(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

export function signInAdmin(): void {
  useAuthStore.setState({
    session: { userId: 'admin1', orgId: 'org1', orgName: 'Acme', roleId: 1, managerPermissions: [] },
    hydrated: true,
  });
}
