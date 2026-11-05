import React, { createContext, useContext, useMemo } from 'react';
import { ConfirmHost } from './ConfirmDialog';
import { ToastLayer } from './internal/ToastLayer';
import { toast, type ToastApi } from './internal/toastStore';

export { toast } from './internal/toastStore';
export type { ToastApi, ToastKind, ToastOptions } from './internal/toastStore';

const HostContext = createContext(false);

/**
 * Mount once at the app root. Hosts the toast stack and the global confirm dialog; both stay visible
 * above Modals and BottomSheets. Nested providers are harmless (the inner one renders only children).
 */
export function ToastProvider({ children }: { children?: React.ReactNode }) {
  const nested = useContext(HostContext);
  if (nested) return <>{children}</>;
  return (
    <HostContext.Provider value>
      {children}
      <ToastLayer scope="root" />
      <ConfirmHost />
    </HostContext.Provider>
  );
}

/** `const toast = useToast(); toast.success('Saved')`. Stable identity. */
export function useToast(): ToastApi {
  return useMemo(() => toast, []);
}
