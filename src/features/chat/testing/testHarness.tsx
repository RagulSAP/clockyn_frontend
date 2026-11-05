import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { resetBadges } from '@/store/badges';
import { ThemeProvider } from '@/theme';
import { resetChatSessionMemory } from '../utils/chatSession';

export async function renderChat(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const utils = await render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { client, ...utils };
}

export function signInAs(roleId: 1 | 2 | 3, extra: { userId?: string; name?: string } = {}): void {
  resetBadges();
  resetChatSessionMemory();
  useAuthStore.setState({
    session: { userId: extra.userId ?? 'me', orgId: 'org1', orgName: 'Acme Co', roleId, managerPermissions: [], name: extra.name },
    hydrated: true,
  });
}

/** An ISO timestamp `minutesAgo` minutes before now (always "Today" in IST unless it crosses midnight). */
export const isoMinutesAgo = (minutesAgo: number): string => new Date(Date.now() - minutesAgo * 60_000).toISOString();
