import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider } from '@/components/ui';
import { useAuthStore, type Session } from '@/store/auth';
import { ThemeProvider } from '@/theme';

export const TEST_SESSION: Session = {
  userId: 'user-1',
  orgId: 'org-1',
  orgName: 'Acme Traders',
  roleId: 1,
  email: 'owner@example.com',
  name: 'Owner',
  managerPermissions: [],
};

export function signInTestAdmin(over: Partial<Session> = {}): void {
  useAuthStore.setState({ session: { ...TEST_SESSION, ...over }, hydrated: true });
}

/** Renders inside theme + a fresh query client (no retries) + the toast / confirm host. */
export async function renderScreen(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const result = await render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { client, ...result };
}
