import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider } from '@/components/ui';
import { clearToasts } from '@/components/ui/internal/toastStore';
import { useAuthStore } from '@/store/auth';
import { ThemeProvider } from '@/theme';

export const SESSION = {
  userId: 'u1',
  orgId: 'o1',
  orgName: 'Acme',
  roleId: 3 as const,
  managerPermissions: [] as string[],
};

export function signInForTest(): void {
  useAuthStore.setState({ session: { ...SESSION } });
}

export function resetToasts(): void {
  clearToasts();
}

/** Renders inside theme + toast host + a fresh query client (no retries, nothing cached between tests). */
export async function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const result = await render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    ),
  });
  return { client, result };
}

export const PICKED_PHOTO = { uri: 'file:///tmp/photo.jpg', mimeType: 'image/jpeg', fileName: 'photo.jpg', width: 800, height: 600 };
