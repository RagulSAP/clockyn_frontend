import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider } from '@/components/ui';
import { useAuthStore, type Session } from '@/store/auth';
import { ThemeProvider } from '@/theme';

export const staffSession: Session = {
  userId: 'u1',
  orgId: 'org1',
  orgName: 'Acme Corp',
  roleId: 3,
  managerPermissions: [],
  name: 'Asha Rao',
};

export const managerSession: Session = { ...staffSession, userId: 'm1', roleId: 2, managerPermissions: ['Staff Management', 'Requests Management', 'Salary Management'] };

export function signInAs(session: Session): void {
  useAuthStore.setState({ session, hydrated: true });
}

export function signOutState(): void {
  useAuthStore.setState({ session: null, hydrated: true });
}

/** Renders inside theme + react-query + toast/confirm host, with retries off so failures surface immediately. */
export async function renderScreen(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const result = await render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>
        <QueryClientProvider client={client}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    ),
  });
  return { ...result, client };
}

/** Mock for `@/components/layout`: only `Screen`, without the app shell / bootstrap (native push modules). */
export function layoutMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { Screen: (require('@/components/layout/Screen') as typeof import('@/components/layout/Screen')).Screen };
}

/** Mock of `expo-router` pieces used by the screens (no navigation container in unit tests). */
export const routerPush = jest.fn();
export const routerBack = jest.fn();
export const routerReplace = jest.fn();

export function routerMock() {
  const r = { push: routerPush, replace: routerReplace, back: routerBack, canGoBack: () => true, dismissAll: jest.fn(), navigate: jest.fn() };
  return {
    useRouter: () => r,
    router: r,
    useFocusEffect: (cb: () => void | (() => void)) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const React2 = require('react') as typeof React;
      React2.useEffect(cb, [cb]);
    },
  };
}

/** Typed access to a jest mock of any signature (the mocked API modules are replaced wholesale). */
export const mockOf = (fn: unknown) => fn as jest.Mock;
