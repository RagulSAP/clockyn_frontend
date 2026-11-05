import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/theme';
import { useAuthStore, type Session } from '@/store/auth';

export const TEST_SESSION: Session = {
  userId: 'admin1',
  orgId: 'org1',
  orgName: 'Acme Corp',
  roleId: 1,
  managerPermissions: [],
  name: 'Admin One',
};

export function signInAs(over: Partial<Session> = {}): void {
  useAuthStore.setState({ session: { ...TEST_SESSION, ...over }, hydrated: true });
}

/** Renders a screen inside the theme and a fresh (non-retrying) query client. */
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
