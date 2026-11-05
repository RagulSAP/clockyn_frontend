import { useEffect } from 'react';

import { useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';

/**
 * Toasts a failed query once per failure (server message preferred, `fallback` otherwise). Queries keep their
 * previous data, so the screen stays usable; the toast is the "no silent failure" signal.
 */
export function useQueryErrorToast(error: unknown, fallback: string): void {
  const toast = useToast();
  useEffect(() => {
    if (error) toast.error(getErrorMessage(error, fallback));
  }, [error, fallback, toast]);
}
