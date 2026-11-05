import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { billingApi } from '@/api';
import { getErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useUserId } from '@/store/auth';
import type { Coupon, OrderQuote } from '@/types/api/billing';

/**
 * Coupon state of the payment summary: the one-time welcome coupon (auto-applied for a first payment, removable) and
 * manually entered codes. A failed manual attempt only sets the error text; an applied coupon is never lost by it.
 * `enabled=false` (capacity upgrades) skips every coupon request.
 */
export function useCoupon(enabled: boolean) {
  const orgId = useOrgId();
  const userId = useUserId();
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const welcomeHandled = useRef(false);

  // Welcome coupon: check on every mount; failures are silent (the user can still type a code).
  const welcome = useQuery({
    queryKey: queryKeys.billing.firstPayment(orgId),
    queryFn: async () => {
      const [isFirst, first] = await Promise.all([billingApi.checkFirstPayment(userId), billingApi.getFirstCoupon()]);
      return isFirst ? first : null;
    },
    enabled: enabled && orgId !== '' && userId !== '',
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (!enabled || welcomeHandled.current || !welcome.data) return;
    welcomeHandled.current = true;
    setCoupon((current) => current ?? welcome.data ?? null);
    setWelcomeOpen(true);
  }, [enabled, welcome.data]);

  const changeInput = useCallback((text: string) => {
    setInput(text);
    setError(null);
  }, []);

  /**
   * `verify` (optional) asks the server to price the order with the code: its verdict (applied / message) wins when it
   * answers; `null` (route missing, network) falls back to the percent-only `validateCoupon`.
   */
  const apply = useCallback(async (verify?: (code: string) => Promise<OrderQuote | null>) => {
    const code = input.trim();
    if (code === '' || applying) return;
    setApplying(true);
    setError(null);
    try {
      const priced = verify ? await verify(code) : null;
      if (priced) {
        if (priced.couponApplied) {
          setCoupon({ id: null, name: priced.couponCode || code, discountPercent: priced.discountPercent ?? 0 });
          setInput('');
        } else {
          setError(priced.couponMessage || 'Invalid or expired coupon');
        }
        return;
      }
      const valid = await billingApi.validateCoupon(code);
      setCoupon(valid);
      setInput('');
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to validate coupon') || 'Invalid coupon');
    } finally {
      setApplying(false);
    }
  }, [input, applying]);

  const remove = useCallback(() => {
    setCoupon(null);
    setInput('');
    setError(null);
  }, []);

  return {
    coupon: enabled ? coupon : null,
    input,
    error,
    applying,
    changeInput,
    apply,
    remove,
    welcomeOpen,
    closeWelcome: () => setWelcomeOpen(false),
  };
}
