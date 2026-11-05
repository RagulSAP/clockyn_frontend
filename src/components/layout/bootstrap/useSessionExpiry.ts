import { useEffect, useState } from 'react';

import { registerSessionExpiry } from './sessionExpiry';

/**
 * Registers the 401 (expired / revoked token) handler with the HTTP client for the lifetime of the app shell.
 * It is registered during the first render (idempotent: `configureApi` just overwrites the handler) so a request fired by a
 * screen's mount effect, which runs before this component's own effects, cannot miss it.
 */
export function useSessionExpiry(): void {
  const [unregister] = useState(() => registerSessionExpiry());
  useEffect(() => {
    registerSessionExpiry(); // re-arm after a StrictMode cleanup
    return unregister;
  }, [unregister]);
}
