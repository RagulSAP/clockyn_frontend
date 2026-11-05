import React from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';

import { queryClient } from './queryClient';

/** Mount once at the app root (inside the root layout, around the navigator). */
export function QueryProvider({ children, client = queryClient }: { children?: React.ReactNode; client?: QueryClient }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
