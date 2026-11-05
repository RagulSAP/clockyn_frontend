/**
 * Rate-the-app prompt logic (no UI).
 *
 * Cadence (unchanged from v1): the counter is bumped once per home-screen mount; the prompt shows on every 3rd
 * qualifying open, never while snoozed ("Maybe later" = 14 days, counter frozen) and never again once the user
 * went to the store ("done"). Only exact multiples trigger, so an expired snooze does not re-prompt on every open.
 * Fix vs v1: the open is counted once per mount (v1 counted on every focus, so returning from any sub-screen
 * counted as an "open"). Store URLs come from `@/config/env`; with none configured there is nothing to rate on.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { env } from '@/config/env';
import { getString, setString, STORAGE_KEYS } from '@/lib/storage';

export const RATE_SHOW_EVERY_OPENS = 3;
export const RATE_SNOOZE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RateState = {
  /** Opens counted so far (before this one). */
  count: number;
  done: boolean;
  /** Epoch ms of the last "Maybe later", or null. */
  snoozedAt: number | null;
};

/** Pure decision: should this open show the prompt, and what is the new counter value. */
export function evaluateOpen(state: RateState, now: number): { show: boolean; count: number } {
  if (state.done) return { show: false, count: state.count };
  if (state.snoozedAt !== null && now - state.snoozedAt < RATE_SNOOZE_DAYS * DAY_MS) {
    return { show: false, count: state.count }; // the counter does not advance while snoozed
  }
  const count = state.count + 1;
  return { show: count % RATE_SHOW_EVERY_OPENS === 0, count };
}

function toNumber(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function readState(): Promise<RateState> {
  const [count, done, snoozed] = await Promise.all([
    getString(STORAGE_KEYS.rateAppOpenCount),
    getString(STORAGE_KEYS.rateAppDone),
    getString(STORAGE_KEYS.rateAppSnoozedAt),
  ]);
  return { count: toNumber(count) ?? 0, done: done === 'true', snoozedAt: toNumber(snoozed) };
}

/** Count one app open and report whether the prompt is due. Storage failures never throw (-> false). */
export async function registerAppOpen(now: number = Date.now()): Promise<boolean> {
  try {
    const state = await readState();
    const next = evaluateOpen(state, now);
    if (next.count !== state.count) await setString(STORAGE_KEYS.rateAppOpenCount, String(next.count));
    return next.show;
  } catch {
    return false;
  }
}

/** The user went to the store: never ask again. */
export async function markRateAppDone(): Promise<void> {
  await setString(STORAGE_KEYS.rateAppDone, 'true');
}

/** "Maybe later": stay quiet for 14 days. */
export async function snoozeRateApp(now: number = Date.now()): Promise<void> {
  await setString(STORAGE_KEYS.rateAppSnoozedAt, String(now));
}

/** Store listing for this platform, or '' (web, or the env var is not set). */
export function getRateStoreUrl(): string {
  if (Platform.OS === 'ios') return env.iosStoreUrl;
  if (Platform.OS === 'android') return env.androidStoreUrl;
  return '';
}

/** Opens the store listing. Resolves false (never throws) when there is no URL or it cannot be opened. */
export async function openRateStore(): Promise<boolean> {
  const url = getRateStoreUrl();
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Call once from each home screen. Counts ONE open per mount (React strict-mode safe) and exposes the modal
 * state for `<RateAppModal visible={visible} onClose={close} />`. Nothing shows when no store URL is configured.
 */
export function useRatePrompt(): { visible: boolean; close: () => void } {
  const [visible, setVisible] = useState(false);
  const counted = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    void registerAppOpen().then((show) => {
      if (show && mounted.current && getRateStoreUrl()) setVisible(true);
    });
  }, []);

  const close = useCallback(() => setVisible(false), []);
  return { visible, close };
}
