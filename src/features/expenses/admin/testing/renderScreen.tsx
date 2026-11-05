import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ThemeProvider } from '@/theme';
import { useAuthStore } from '@/store/auth';

export function signInAs(roleId: 1 | 2 = 1): void {
  useAuthStore.setState({
    hydrated: true,
    session: { userId: 'u1', orgId: 'org1', orgName: 'Acme Traders', roleId, managerPermissions: [] },
  });
}

/** Renders a screen inside the theme and a fresh query client (no retries). */
export function renderScreen(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    ),
  });
}
