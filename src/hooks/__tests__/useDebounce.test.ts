import { act, renderHook } from '@testing-library/react-native';

import { useDebounce } from '../useDebounce';
import { useMounted } from '../useMounted';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useDebounce', () => {
  it('returns the initial value immediately', async () => {
    const { result } = await renderHook(() => useDebounce('a', 300));
    expect(result.current).toBe('a');
  });

  it('only updates after the value has been stable for the delay', async () => {
    const { result, rerender } = await renderHook((p: { v: string }) => useDebounce(p.v, 300), { initialProps: { v: 'a' } });
    await rerender({ v: 'ab' });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });
    await rerender({ v: 'abc' });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });
    expect(result.current).toBe('a'); // timer restarted by the second change
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });
    expect(result.current).toBe('abc');
  });

  it('delay 0 updates without waiting', async () => {
    const { result, rerender } = await renderHook((p: { v: number }) => useDebounce(p.v, 0), { initialProps: { v: 1 } });
    await rerender({ v: 2 });
    expect(result.current).toBe(2);
  });

  it('does not update after unmount (timer cleared)', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender, unmount } = await renderHook((p: { v: number }) => useDebounce(p.v, 300), { initialProps: { v: 1 } });
    await rerender({ v: 2 });
    await unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('useMounted', () => {
  it('is true while mounted and false after unmount, with a stable function', async () => {
    const { result, rerender, unmount } = await renderHook(() => useMounted());
    const fn = result.current;
    expect(fn()).toBe(true);
    await rerender({});
    expect(result.current).toBe(fn);
    await unmount();
    expect(fn()).toBe(false);
  });
});
