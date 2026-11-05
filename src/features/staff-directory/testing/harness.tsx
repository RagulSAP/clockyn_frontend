import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuthStore, type Session } from '@/store/auth';
import { renderThemed } from '@/components/ui/testing/testUtils';
import type { StaffMember } from '@/types/api/staff';

export function member(over: Partial<StaffMember> & { userId: string }): StaffMember {
  return {
    name: over.userId,
    empId: '',
    mobile: '',
    email: '',
    department: '',
    branch: '',
    status: 'unknown',
    statusLabel: '',
    isActive: true,
    raw: {},
    ...over,
  };
}

export function signInAs(roleId: 1 | 2 | 3 = 1, over: Partial<Session> = {}): void {
  useAuthStore.setState({
    session: { userId: 'u-admin', orgId: 'org-1', orgName: 'Acme Co', roleId, managerPermissions: [], ...over },
    hydrated: true,
  });
}

export function signOutForTest(): void {
  useAuthStore.setState({ session: null, hydrated: true });
}

/** Render a screen inside the theme and a fresh, non-retrying query client. */
export function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return renderThemed(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
