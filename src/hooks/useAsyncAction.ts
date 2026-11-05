import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, GENERIC_ERROR_MESSAGE, getErrorMessage } from '@/lib/api/errors';
import { useAppToast } from '@/lib/query/toast';

import { useMounted } from './useMounted';

export interface AsyncActionOptions<R> {
  /** Success toast text. */
  successMessage?: string | ((result: R) => string | undefined);
  /** Fallback text when the server sent no message (the server `detail` is always preferred). */
  errorMessage?: string;
  /** Do not toast failures (render `error` yourself). */
  silentError?: boolean;
  onSuccess?: (result: R) => void | Promise<void>;
  onError?: (error: unknown) => void;
}

export interface AsyncAction<A extends unknown[], R> {
  /** Runs the action. Never throws: resolves to the result, or `undefined` on failure / when already running. */
  run: (...args: A) => Promise<R | undefined>;
  loading: boolean;
  /** Last failure as user-facing text (cleared on the next run). */
  error: string | null;
  reset: () => void;
}

/**
 * Async handler with hygiene built in: try/catch/finally, `loading` ALWAYS clears, failures toast the server message,
 * no success toast on failure, double-taps are ignored while running, no state updates after unmount.
 *
 * ```ts
 * const { run: save, loading } = useAsyncAction(() => saveBranch(input), { successMessage: 'Saved' });
 * <Button title="Save" loading={loading} onPress={save} />
 * ```
 */
export function useAsyncAction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  options: AsyncActionOptions<R> = {},
): AsyncAction<A, R> {
  const toast = useAppToast();
  const isMounted = useMounted();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  // Latest closures without changing `run` identity.
  const fnRef = useRef(fn);
  const optsRef = useRef(options);
  useEffect(() => {
    fnRef.current = fn;
    optsRef.current = options;
  });

  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      if (busy.current) return undefined;
      busy.current = true;
      setLoading(true);
      setError(null);
      try {
        const result = await fnRef.current(...args);
        const o = optsRef.current;
        const msg = typeof o.successMessage === 'function' ? o.successMessage(result) : o.successMessage;
        if (msg) toast.success(msg);
        await o.onSuccess?.(result);
        return result;
      } catch (e) {
        if (e instanceof ApiError && e.isAborted) return undefined;
        const o = optsRef.current;
        const message = getErrorMessage(e, o.errorMessage ?? GENERIC_ERROR_MESSAGE);
        if (isMounted()) setError(message);
        if (!o.silentError) toast.error(message);
        o.onError?.(e);
        return undefined;
      } finally {
        busy.current = false;
        if (isMounted()) setLoading(false);
      }
    },
    [toast, isMounted],
  );

  const reset = useCallback(() => setError(null), []);

  return { run, loading, error, reset };
}
