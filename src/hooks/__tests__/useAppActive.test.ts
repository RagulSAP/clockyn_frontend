import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import { useAppActive } from '../useAppActive';

describe('useAppActive', () => {
  let listener: (() => void) | undefined;
  const remove = jest.fn();
  let state: string | null | undefined = 'active';

  beforeEach(() => {
    listener = undefined;
    remove.mockClear();
    state = 'active';
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, cb: () => void) => {
      listener = cb;
      return { remove };
    }) as never);
    Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => state });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('follows the app state', async () => {
    const { result } = await renderHook(() => useAppActive());
    expect(result.current).toBe(true);
    state = 'background';
    await act(async () => {
      listener?.();
    });
    expect(result.current).toBe(false);
    state = 'active';
    await act(async () => {
      listener?.();
    });
    expect(result.current).toBe(true);
  });

  it('treats an unknown state as active and unsubscribes on unmount', async () => {
    state = null;
    const { result, unmount } = await renderHook(() => useAppActive());
    expect(result.current).toBe(true);
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
