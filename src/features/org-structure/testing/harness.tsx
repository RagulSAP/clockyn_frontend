/** Test helpers for the org-structure screens: providers + a signed-in session. Not shipped in the app bundle. */
import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider } from '@/components/ui';
import { useAuthStore, type Session } from '@/store/auth';
import { ThemeProvider } from '@/theme';

export const ADMIN_SESSION: Session = {
  userId: 'admin-1',
  orgId: 'org-1',
  orgName: 'Acme Works',
  roleId: 1,
  managerPermissions: [],
};

export function signInAs(session: Session = ADMIN_SESSION): void {
  useAuthStore.setState({ session, hydrated: true });
}

export function createTestClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
}

export function renderWithProviders(ui: React.ReactElement, client: QueryClient = createTestClient()) {
  return render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    ),
  });
}
