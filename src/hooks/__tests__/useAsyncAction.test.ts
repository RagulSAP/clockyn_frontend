import { act, renderHook } from '@testing-library/react-native';

import { ApiError } from '@/lib/api/errors';
import { __resetToastBridge } from '@/lib/query/toast';

import { useAsyncAction } from '../useAsyncAction';

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/ui', () => ({ useToast: () => mockToast }), { virtual: true });

beforeEach(() => {
  mockToast.success.mockClear();
  mockToast.error.mockClear();
  __resetToastBridge();
});

describe('useAsyncAction', () => {
  it('returns the result, toasts success and toggles loading', async () => {
    let resolve: (v: number) => void = () => undefined;
    const fn = jest.fn(
      () =>
        new Promise<number>((r) => {
          resolve = r;
        }),
    );
    const onSuccess = jest.fn();
    const { result } = await renderHook(() => useAsyncAction(fn, { successMessage: 'Saved', onSuccess }));
    expect(result.current.loading).toBe(false);
    let promise!: Promise<number | undefined>;
    await act(async () => {
      promise = result.current.run();
    });
    expect(result.current.loading).toBe(true);
    await act(async () => {
      resolve(42);
      await promise;
    });
    expect(await promise).toBe(42);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockToast.success).toHaveBeenCalledWith('Saved');
    expect(onSuccess).toHaveBeenCalledWith(42);
  });

  it('passes arguments through', async () => {
    const fn = jest.fn(async (a: number, b: number) => a + b);
    const { result } = await renderHook(() => useAsyncAction(fn));
    let out: number | undefined;
    await act(async () => {
      out = await result.current.run(2, 3);
    });
    expect(out).toBe(5);
  });

  it('failure: toasts the server message, never throws, never a success toast, loading clears', async () => {
    const onError = jest.fn();
    const { result } = await renderHook(() =>
      useAsyncAction(
        async () => {
          throw new ApiError({ status: 400, message: 'Invalid OTP', detail: 'Invalid OTP' });
        },
        { successMessage: 'Done', errorMessage: 'Failed', onError },
      ),
    );
    let out: unknown = 'sentinel';
    await act(async () => {
      out = await result.current.run();
    });
    expect(out).toBeUndefined();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Invalid OTP');
    expect(mockToast.error).toHaveBeenCalledWith('Invalid OTP');
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('uses the fallback for errors without a message, and hides engine errors', async () => {
    const { result } = await renderHook(() =>
      useAsyncAction(
        async () => {
          throw new TypeError('undefined is not an object');
        },
        { errorMessage: 'Failed to load' },
      ),
    );
    await act(async () => {
      await result.current.run();
    });
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load');
  });

  it('silentError keeps the error in state without a toast', async () => {
    const { result } = await renderHook(() =>
      useAsyncAction(
        async () => {
          throw new Error('nope');
        },
        { silentError: true },
      ),
    );
    await act(async () => {
      await result.current.run();
    });
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(result.current.error).toBe('nope');
  });

  it('ignores re-entrant calls while running (double tap)', async () => {
    let resolve: () => void = () => undefined;
    const fn = jest.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const { result } = await renderHook(() => useAsyncAction(fn));
    let first!: Promise<void | undefined>;
    let second: unknown = 'sentinel';
    await act(async () => {
      first = result.current.run();
      second = await result.current.run();
    });
    expect(second).toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve();
      await first;
    });
    const again = result.current.run();
    await act(async () => {
      resolve();
      await again;
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('clears the previous error on the next run and via reset()', async () => {
    let fail = true;
    const { result } = await renderHook(() =>
      useAsyncAction(async () => {
        if (fail) throw new Error('first');
        return 1;
      }),
    );
    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toBe('first');
    fail = false;
    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toBeNull();
    fail = true;
    await act(async () => {
      await result.current.run();
    });
    await act(async () => {
      result.current.reset();
    });
    expect(result.current.error).toBeNull();
  });

  it('supports a success message function and the latest closure', async () => {
    const { result, rerender } = await renderHook(
      (p: { label: string }) => useAsyncAction(async () => p.label, { successMessage: (r) => `Saved ${r}` }),
      { initialProps: { label: 'one' } },
    );
    await rerender({ label: 'two' });
    await act(async () => {
      await result.current.run();
    });
    expect(mockToast.success).toHaveBeenCalledWith('Saved two');
  });

  it('does not update state after unmount', async () => {
    let resolve: () => void = () => undefined;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result, unmount } = await renderHook(() =>
      useAsyncAction(
        () =>
          new Promise<void>((r) => {
            resolve = r;
          }),
      ),
    );
    let p!: Promise<void | undefined>;
    await act(async () => {
      p = result.current.run();
    });
    await unmount();
    await act(async () => {
      resolve();
      await p;
    });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('stays silent when the request was cancelled', async () => {
    const { result } = await renderHook(() =>
      useAsyncAction(async () => {
        throw new ApiError({ status: 0, isAborted: true });
      }),
    );
    await act(async () => {
      await result.current.run();
    });
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});
