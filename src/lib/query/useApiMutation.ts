import { useMutation, useQueryClient, type QueryKey, type UseMutationResult } from '@tanstack/react-query';

import { ApiError, getErrorMessage, GENERIC_ERROR_MESSAGE } from '@/lib/api/errors';

import { useAppToast } from './toast';

type MaybeFn<T, A extends unknown[]> = T | ((...args: A) => T);

const resolve = <T, A extends unknown[]>(v: MaybeFn<T, A>, ...args: A): T =>
  typeof v === 'function' ? (v as (...a: A) => T)(...args) : v;

export interface ApiMutationOptions<TData, TVars> {
  /**
   * Query keys (prefixes) to invalidate after a SUCCESSFUL mutation, e.g. `[queryKeys.staff.all(orgId)]`.
   * Active queries refetch in the background; the mutation does not wait for them.
   */
  invalidate?: MaybeFn<readonly QueryKey[], [data: TData, vars: TVars]>;
  /** Success toast text (omit for none). A function may return '' / undefined to skip the toast. */
  successMessage?: MaybeFn<string | undefined | null, [data: TData, vars: TVars]>;
  /**
   * Fallback error text used when the server sent no message. The server's `detail`/`message` is always preferred,
   * network errors keep their own text. Default: "Something went wrong. Please try again."
   */
  errorMessage?: MaybeFn<string, [error: unknown, vars: TVars]>;
  /** Do not toast failures (the caller renders the error itself). */
  silentError?: boolean;
  onSuccess?: (data: TData, vars: TVars) => void | Promise<void>;
  onError?: (error: unknown, vars: TVars) => void;
  onSettled?: (data: TData | undefined, error: unknown | null, vars: TVars) => void;
}

/**
 * Mutation with the app's async hygiene baked in:
 *  - failures always toast the server message (never silent, never a success toast on failure),
 *  - successes toast `successMessage` and invalidate `invalidate` keys,
 *  - `mutate` never produces unhandled rejections (use `mutateAsync` + try/catch when you need the result; the
 *    error toast has already been shown by then).
 *
 * ```ts
 * const save = useApiMutation((v: StaffInput) => addStaff(orgId, v), {
 *   invalidate: [queryKeys.staff.all(orgId), queryKeys.home.all(orgId)],
 *   successMessage: 'Staff added successfully',
 *   errorMessage: 'Failed to add staff',
 * });
 * ```
 */
export function useApiMutation<TData = unknown, TVars = void>(
  fn: (vars: TVars) => Promise<TData>,
  options: ApiMutationOptions<TData, TVars> = {},
): UseMutationResult<TData, Error, TVars> {
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: async (data, vars) => {
      const keys = options.invalidate ? resolve(options.invalidate, data, vars) : [];
      for (const queryKey of keys) {
        void queryClient.invalidateQueries({ queryKey }).catch(() => undefined);
      }
      const message = options.successMessage ? resolve(options.successMessage, data, vars) : undefined;
      if (message) toast.success(message);
      await options.onSuccess?.(data, vars);
    },
    onError: (error, vars) => {
      if (error instanceof ApiError && error.isAborted) return;
      if (!options.silentError) {
        const fallback = options.errorMessage ? resolve(options.errorMessage, error, vars) : GENERIC_ERROR_MESSAGE;
        toast.error(getErrorMessage(error, fallback));
      }
      options.onError?.(error, vars);
    },
    onSettled: (data, error, vars) => {
      options.onSettled?.(data, error ?? null, vars);
    },
  });
}
