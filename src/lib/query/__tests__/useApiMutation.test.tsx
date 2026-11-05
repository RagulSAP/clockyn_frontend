import React from 'react';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';

import { ApiError, networkError } from '@/lib/api/errors';

import { __resetToastBridge } from '../toast';
import { useApiMutation } from '../useApiMutation';

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/ui', () => ({ useToast: () => mockToast }), { virtual: true });

// Deliver react-query notifications synchronously so state updates land inside `act`.
notifyManager.setScheduler((cb) => cb());

let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  mockToast.success.mockClear();
  mockToast.error.mockClear();
  mockToast.info.mockClear();
  __resetToastBridge();
});

afterEach(() => client.clear());

describe('useApiMutation success', () => {
  it('returns the result, toasts the success message and invalidates the given keys', async () => {
    const spy = jest.spyOn(client, 'invalidateQueries');
    const onSuccess = jest.fn();
    const { result } = await renderHook(
      () =>
        useApiMutation(async (v: { name: string }) => ({ id: 7, name: v.name }), {
          invalidate: [['staff', 'org1'], ['home', 'org1']],
          successMessage: 'Staff added successfully',
          onSuccess,
        }),
      { wrapper },
    );
    let data: unknown;
    await act(async () => {
      data = await result.current.mutateAsync({ name: 'Ravi' });
    });
    expect(data).toEqual({ id: 7, name: 'Ravi' });
    expect(mockToast.success).toHaveBeenCalledWith('Staff added successfully');
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toEqual([['staff', 'org1'], ['home', 'org1']]);
    expect(onSuccess).toHaveBeenCalledWith({ id: 7, name: 'Ravi' }, { name: 'Ravi' });
  });

  it('supports function forms for invalidate and successMessage', async () => {
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = await renderHook(
      () =>
        useApiMutation(async (id: string) => ({ id }), {
          invalidate: (data) => [['things', data.id]],
          successMessage: (data, vars) => `Saved ${data.id}/${vars}`,
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync('a1');
    });
    expect(spy.mock.calls[0][0]?.queryKey).toEqual(['things', 'a1']);
    expect(mockToast.success).toHaveBeenCalledWith('Saved a1/a1');
  });

  it('shows no toast when there is no success message (or it resolves to empty)', async () => {
    const { result } = await renderHook(() => useApiMutation(async () => 1, { successMessage: () => '' }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it('actually refreshes active queries that match the invalidated key', async () => {
    let calls = 0;
    await client.fetchQuery({ queryKey: ['staff', 'org1', 'list'], queryFn: async () => ++calls });
    const observer = client.getQueryCache().find({ queryKey: ['staff', 'org1', 'list'] });
    expect(observer).toBeDefined();
    const { result } = await renderHook(() => useApiMutation(async () => 'ok', { invalidate: [['staff', 'org1']] }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(client.getQueryState(['staff', 'org1', 'list'])?.isInvalidated).toBe(true);
  });
});

describe('useApiMutation failure', () => {
  it('toasts the server detail, never a success toast, and does not invalidate', async () => {
    const spy = jest.spyOn(client, 'invalidateQueries');
    const onError = jest.fn();
    const { result } = await renderHook(
      () =>
        useApiMutation(
          async () => {
            throw new ApiError({ status: 400, message: 'Mobile number already registered', detail: 'Mobile number already registered' });
          },
          { invalidate: [['staff', 'org1']], successMessage: 'Saved', errorMessage: 'Failed to add staff', onError },
        ),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    expect(mockToast.error).toHaveBeenCalledWith('Mobile number already registered');
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('uses the fallback when the server gave no message', async () => {
    const { result } = await renderHook(
      () => useApiMutation(async () => { throw new ApiError({ status: 404 }); }, { errorMessage: 'Failed to delete branch' }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    expect(mockToast.error).toHaveBeenCalledWith('Failed to delete branch');
  });

  it('function errorMessage receives the error and variables', async () => {
    const { result } = await renderHook(
      () =>
        useApiMutation(async (_v: string) => { throw new ApiError({ status: 500 }); }, {
          errorMessage: (_e, v) => `Could not process ${v}`,
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync('X1').catch(() => undefined);
    });
    expect(mockToast.error).toHaveBeenCalledWith('Could not process X1');
  });

  it('keeps the network message for offline failures', async () => {
    const { result } = await renderHook(
      () => useApiMutation(async () => { throw networkError(); }, { errorMessage: 'Failed' }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    expect(mockToast.error).toHaveBeenCalledWith('Network connection failed. Please check your internet connection.');
  });

  it('mutate() (fire and forget) never produces an unhandled rejection', async () => {
    const { result } = await renderHook(() => useApiMutation(async () => { throw new ApiError({ status: 400, detail: 'bad', message: 'bad' }); }), { wrapper });
    await act(async () => {
      result.current.mutate();
    });
    expect(mockToast.error).toHaveBeenCalledWith('bad');
  });

  it('silentError suppresses the toast but still calls onError', async () => {
    const onError = jest.fn();
    const { result } = await renderHook(
      () => useApiMutation(async () => { throw new ApiError({ status: 400, detail: 'bad', message: 'bad' }); }, { silentError: true, onError }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('cancelled requests are silent', async () => {
    const { result } = await renderHook(
      () => useApiMutation(async () => { throw new ApiError({ status: 0, isAborted: true, message: 'Request cancelled' }); }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('exposes pending state and clears it after failure', async () => {
    const { result } = await renderHook(() => useApiMutation(async () => { throw new ApiError({ status: 400, detail: 'x', message: 'x' }); }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(true);
  });
});
