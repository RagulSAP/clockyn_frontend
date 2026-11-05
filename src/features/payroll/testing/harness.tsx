import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui';
import { renderThemed } from '@/components/ui/testing/testUtils';
import { useAuthStore } from '@/store/auth';

/** Signs in a fake admin of organisation `ORG1` (no persistence side effects needed by the screens under test). */
export function signInTestAdmin(): void {
  useAuthStore.setState({
    hydrated: true,
    session: { userId: 'ADMIN1', orgId: 'ORG1', orgName: 'Acme Traders', roleId: 1, managerPermissions: [] },
  });
}

/** Renders a screen with theme, a fresh query client (no retries) and the toast / confirm host. */
export async function renderPayrollScreen(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const result = await renderThemed(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
  return { ...result, client };
}
