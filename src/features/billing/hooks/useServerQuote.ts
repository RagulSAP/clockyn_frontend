import { useCallback, useEffect, useRef, useState } from 'react';

import { billingApi } from '@/api';
import { useOrgId, useUserId } from '@/store/auth';
import type { OrderMode, OrderQuote } from '@/types/api/billing';

export const QUOTE_DEBOUNCE_MS = 300;

export interface QuoteParams {
  planId: number | null;
  /** Staff charged (the EXTRA staff for `upgrade`). */
  staffLimit: number;
  couponCode: string | null;
  mode: OrderMode;
  /** Price with one referral reward (never together with a coupon). Left out / false = no reward. */
  applyReferral?: boolean;
}

type Result = { key: string; quote: OrderQuote | null };

/**
 * The server's price quote (`POST /orders/quote`) for the checkout inputs. The first quote is fetched at once; later
 * input changes are debounced (~300 ms) and a response that no longer matches the inputs is dropped (stale responses
 * never overwrite newer ones, the request itself is aborted). `quote` is `null` while loading and when the server has
 * no quote route / failed: the caller then keeps its local numbers. `settle()` resolves the quote for the CURRENT
 * inputs right now (used by Pay so the amount posted is the one the server prices).
 */
export function useServerQuote(params: QuoteParams | null, enabled = true, debounceMs = QUOTE_DEBOUNCE_MS) {
  const userId = useUserId();
  const orgId = useOrgId();
  const key = params ? JSON.stringify(params) : '';
  const [result, setResult] = useState<Result | null>(null);
  const seq = useRef(0);
  const started = useRef(false);
  const latest = useRef({ params, userId, orgId, key });
  // Declared before the fetch effect so it always reads the inputs of the render that scheduled it.
  useEffect(() => {
    latest.current = { params, userId, orgId, key };
  });

  const active = enabled && params !== null && userId !== '' && orgId !== '';

  useEffect(() => {
    if (!active) return undefined;
    const { params: p } = latest.current;
    if (!p) return undefined;
    const mine = ++seq.current;
    const controller = new AbortController();
    const run = async (): Promise<void> => {
      const q = await billingApi.quote({ userId, orgId, planId: p.planId, staffLimit: p.staffLimit, couponCode: p.couponCode, mode: p.mode, applyReferral: p.applyReferral === true }, { signal: controller.signal });
      if (mine !== seq.current || controller.signal.aborted) return; // stale: inputs changed meanwhile
      setResult({ key, quote: q });
    };
    if (!started.current) {
      started.current = true;
      void run();
      return () => controller.abort();
    }
    const timer = setTimeout(() => void run(), debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, key, userId, orgId, debounceMs]);

  const current = active && result !== null && result.key === key ? result : null;

  /** One-off quote for given inputs (coupon Apply); never debounced, never stored. */
  const preview = useCallback(
    (over: Partial<QuoteParams>): Promise<OrderQuote | null> => {
      const l = latest.current;
      if (!l.params) return Promise.resolve(null);
      const p = { ...l.params, ...over };
      return billingApi.quote({ userId: l.userId, orgId: l.orgId, planId: p.planId, staffLimit: p.staffLimit, couponCode: p.couponCode, mode: p.mode, applyReferral: p.applyReferral === true });
    },
    [],
  );

  /** The quote for the inputs as they are NOW: the loaded one, else a fresh request. `null` = fall back to local numbers. */
  const settle = useCallback(async (): Promise<OrderQuote | null> => {
    const l = latest.current;
    if (!enabled || !l.params || l.userId === '' || l.orgId === '') return null;
    if (current) return current.quote;
    return preview({});
  }, [enabled, current, preview]);

  return { quote: current?.quote ?? null, loading: active && current === null, preview, settle };
}
