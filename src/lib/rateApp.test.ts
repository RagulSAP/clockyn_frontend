import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/lib/storage';
import {
  evaluateOpen,
  markRateAppDone,
  registerAppOpen,
  snoozeRateApp,
  useRatePrompt,
  RATE_SNOOZE_DAYS,
  type RateState,
} from './rateApp';

const mockEnv = { androidStoreUrl: '', iosStoreUrl: 'https://store.example/clockyn' };
// getter: the factory runs lazily, after the module-level const below is initialised
jest.mock('@/config/env', () => ({
  get env() {
    return mockEnv;
  },
}));

const DAY = 24 * 60 * 60 * 1000;
const fresh: RateState = { count: 0, done: false, snoozedAt: null };

describe('evaluateOpen (pure cadence)', () => {
  it('shows on every 3rd open only', () => {
    let state = fresh;
    const shown: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const r = evaluateOpen(state, 1_000);
      shown.push(r.show);
      state = { ...state, count: r.count };
    }
    expect(shown).toEqual([false, false, true, false, false, true, false]);
  });

  it('never shows once done', () => {
    expect(evaluateOpen({ count: 2, done: true, snoozedAt: null }, 1)).toEqual({ show: false, count: 2 });
  });

  it('freezes the counter while snoozed and resumes after 14 days', () => {
    const snoozedAt = 5 * DAY;
    expect(evaluateOpen({ count: 2, done: false, snoozedAt }, snoozedAt + 13 * DAY)).toEqual({ show: false, count: 2 });
    expect(RATE_SNOOZE_DAYS).toBe(14);
    // after the snooze: count 3 -> shows
    expect(evaluateOpen({ count: 2, done: false, snoozedAt }, snoozedAt + 14 * DAY)).toEqual({ show: true, count: 3 });
  });

  it('does not re-trigger on every open after the snooze expires (exact multiples only)', () => {
    const r = evaluateOpen({ count: 3, done: false, snoozedAt: 0 }, 20 * DAY);
    expect(r).toEqual({ show: false, count: 4 });
  });
});

describe('persisted flow', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockEnv.androidStoreUrl = '';
    mockEnv.iosStoreUrl = 'https://store.example/clockyn';
  });

  it('counts opens in storage and reports the 3rd', async () => {
    expect(await registerAppOpen(1)).toBe(false);
    expect(await registerAppOpen(2)).toBe(false);
    expect(await registerAppOpen(3)).toBe(true);
    expect(await AsyncStorage.getItem(STORAGE_KEYS.rateAppOpenCount)).toBe('3');
  });

  it('snooze suppresses and keeps the counter; done suppresses forever', async () => {
    await registerAppOpen(1);
    await registerAppOpen(2);
    await snoozeRateApp(100);
    expect(await registerAppOpen(100 + DAY)).toBe(false);
    expect(await AsyncStorage.getItem(STORAGE_KEYS.rateAppOpenCount)).toBe('2');
    expect(await registerAppOpen(100 + 15 * DAY)).toBe(true);
    await markRateAppDone();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.rateAppDone)).toBe('true');
    for (let i = 0; i < 6; i++) expect(await registerAppOpen(100 + (20 + i) * DAY)).toBe(false);
  });

  it('survives corrupt storage values', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.rateAppOpenCount, 'abc');
    await AsyncStorage.setItem(STORAGE_KEYS.rateAppSnoozedAt, 'nope');
    expect(await registerAppOpen(1)).toBe(false);
    expect(await AsyncStorage.getItem(STORAGE_KEYS.rateAppOpenCount)).toBe('1');
  });
});

describe('useRatePrompt', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockEnv.iosStoreUrl = 'https://store.example/clockyn';
  });

  it('counts once per mount (not on re-render) and shows on the 3rd mount', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.rateAppOpenCount, '2');
    const { result, rerender } = await renderHook(() => useRatePrompt());
    await waitFor(() => expect(result.current.visible).toBe(true));
    await rerender({});
    await rerender({});
    expect(await AsyncStorage.getItem(STORAGE_KEYS.rateAppOpenCount)).toBe('3');
    await act(async () => result.current.close());
    expect(result.current.visible).toBe(false);
  });

  it('does not show without a store URL (the open is still counted)', async () => {
    mockEnv.iosStoreUrl = '';
    await AsyncStorage.setItem(STORAGE_KEYS.rateAppOpenCount, '2');
    const { result } = await renderHook(() => useRatePrompt());
    await waitFor(async () => expect(await AsyncStorage.getItem(STORAGE_KEYS.rateAppOpenCount)).toBe('3'));
    expect(result.current.visible).toBe(false);
  });
});
