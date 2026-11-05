import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuthStore, type Session } from '@/store/auth';
import { ThemeProvider } from '@/theme';

export function setSession(over: Partial<Session> = {}): void {
  useAuthStore.setState({
    hydrated: true,
    session: { userId: 'u1', orgId: 'org1', orgName: 'Acme Ltd', roleId: 1, managerPermissions: [], ...over },
  });
}

const clients: QueryClient[] = [];
// Drop every cache / pending gc timer after each test so Jest can exit.
afterEach(() => {
  clients.forEach((c) => c.clear());
  clients.length = 0;
});

/** Renders a screen inside the theme and a fresh query client (no retries). */
export async function renderScreen(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const result = await render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    ),
  });
  return { ...result, client };
}

export const openPlan = {
  planId: 3,
  isFreeTrial: false,
  isExpired: false,
  status: null,
  isLoading: false,
  isError: false,
  isBlocked: () => false,
  message: () => '',
  panelMessage: 'Your plan has expired. Please contact your admin.',
  audience: 'admin' as const,
  refetch: async () => undefined,
};
