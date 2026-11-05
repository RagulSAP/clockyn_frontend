import { act, renderHook } from '@testing-library/react-native';

import { useRefreshOnFocus } from '../useRefreshOnFocus';

let focusCallback: (() => void) | null = null;
jest.mock('expo-router', () => ({
  // Runs the effect on mount (first focus) and exposes the callback so tests can simulate a re-focus.
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react');
    useEffect(() => {
      focusCallback = cb;
      cb();
    }, [cb]);
  },
}));

beforeEach(() => {
  focusCallback = null;
});

describe('useRefreshOnFocus', () => {
  it('skips the first focus and refetches on later focuses', async () => {
    const refetch = jest.fn();
    await renderHook(() => useRefreshOnFocus(refetch));
    expect(refetch).not.toHaveBeenCalled();
    await act(async () => {
      focusCallback?.();
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      focusCallback?.();
    });
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('can refetch on the first focus too', async () => {
    const refetch = jest.fn();
    await renderHook(() => useRefreshOnFocus(refetch, { skipFirst: false }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('always calls the latest refetch', async () => {
    const a = jest.fn();
    const b = jest.fn();
    const { rerender } = await renderHook((p: { fn: () => void }) => useRefreshOnFocus(p.fn), { initialProps: { fn: a } });
    await rerender({ fn: b });
    await act(async () => {
      focusCallback?.();
    });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('swallows rejected and throwing refetches', async () => {
    const rejected = jest.fn(() => Promise.reject(new Error('net')));
    await renderHook(() => useRefreshOnFocus(rejected));
    await expect(
      act(async () => {
        focusCallback?.();
      }),
    ).resolves.not.toThrow();
    const throwing = jest.fn(() => {
      throw new Error('sync');
    });
    await renderHook(() => useRefreshOnFocus(throwing));
    await expect(
      act(async () => {
        focusCallback?.();
      }),
    ).resolves.not.toThrow();
  });
});
