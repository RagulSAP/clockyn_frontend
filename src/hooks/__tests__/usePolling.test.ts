import { act, renderHook } from '@testing-library/react-native';

import { usePolling } from '../usePolling';

let mockActive = true;
jest.mock('../useAppActive', () => ({ useAppActive: () => mockActive }));

beforeEach(() => {
  mockActive = true;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('usePolling', () => {
  it('calls fn every interval and not immediately by default', async () => {
    const fn = jest.fn();
    await renderHook(() => usePolling(fn, 1000));
    expect(fn).not.toHaveBeenCalled();
    await advance(999);
    expect(fn).not.toHaveBeenCalled();
    await advance(1);
    expect(fn).toHaveBeenCalledTimes(1);
    await advance(3000);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('runs immediately when asked', async () => {
    const fn = jest.fn();
    await renderHook(() => usePolling(fn, 1000, { immediate: true }));
    await advance(0);
    expect(fn).toHaveBeenCalledTimes(1);
    await advance(1000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does nothing while disabled and starts when enabled', async () => {
    const fn = jest.fn();
    const { rerender } = await renderHook((p: { enabled: boolean }) => usePolling(fn, 1000, { enabled: p.enabled }), {
      initialProps: { enabled: false },
    });
    await advance(5000);
    expect(fn).not.toHaveBeenCalled();
    await rerender({ enabled: true });
    await advance(1000);
    expect(fn).toHaveBeenCalledTimes(1);
    await rerender({ enabled: false });
    await advance(5000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cleans up its timer on unmount', async () => {
    const fn = jest.fn();
    const clearSpy = jest.spyOn(global, 'clearInterval');
    const { unmount } = await renderHook(() => usePolling(fn, 1000));
    await advance(1000);
    expect(fn).toHaveBeenCalledTimes(1);
    await unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
    await advance(5000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('pauses while the app/tab is inactive and runs immediately on resume', async () => {
    const fn = jest.fn();
    const { rerender } = await renderHook(() => usePolling(fn, 1000));
    await advance(1000);
    expect(fn).toHaveBeenCalledTimes(1);
    mockActive = false;
    await rerender({});
    await advance(10_000);
    expect(fn).toHaveBeenCalledTimes(1);
    mockActive = true;
    await rerender({});
    await advance(0);
    expect(fn).toHaveBeenCalledTimes(2); // immediate catch-up
    await advance(1000);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('keeps running in the background when pauseWhenInactive is false', async () => {
    const fn = jest.fn();
    mockActive = false;
    await renderHook(() => usePolling(fn, 1000, { pauseWhenInactive: false }));
    await advance(2000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('never overlaps runs', async () => {
    let resolveRun: () => void = () => undefined;
    const fn = jest.fn(
      () =>
        new Promise<void>((r) => {
          resolveRun = r;
        }),
    );
    await renderHook(() => usePolling(fn, 1000));
    await advance(5000);
    expect(fn).toHaveBeenCalledTimes(1);
    resolveRun();
    await advance(1000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('survives a throwing fn', async () => {
    const fn = jest.fn(async () => {
      throw new Error('boom');
    });
    await renderHook(() => usePolling(fn, 1000));
    await advance(3000);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('always calls the latest fn without restarting the timer', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = await renderHook((p: { fn: () => void }) => usePolling(p.fn, 1000), { initialProps: { fn: first } });
    await advance(500);
    await rerender({ fn: second });
    await advance(500);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('restarts on interval change and ignores non-positive intervals', async () => {
    const fn = jest.fn();
    const { rerender } = await renderHook((p: { ms: number }) => usePolling(fn, p.ms), { initialProps: { ms: 1000 } });
    await rerender({ ms: 200 });
    await advance(200);
    expect(fn).toHaveBeenCalledTimes(1);
    await rerender({ ms: 0 });
    await advance(5000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('trigger() runs on demand', async () => {
    const fn = jest.fn();
    const { result } = await renderHook(() => usePolling(fn, 1000, { enabled: false }));
    await act(async () => {
      await result.current.trigger();
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
