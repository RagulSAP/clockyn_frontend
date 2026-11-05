import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { OrderQuote } from '@/types/api/billing';

import { useServerQuote, type QuoteParams } from '../hooks/useServerQuote';
import { signInTestAdmin } from './testHelpers';

const mockQuote = jest.fn();
jest.mock('@/api', () => ({ billingApi: { quote: (...a: unknown[]) => mockQuote(...a) } }));

const q = (grandTotal: number, over: Partial<OrderQuote> = {}): OrderQuote => ({
  mode: 'new', planId: 22, planName: 'prime', pricePerStaffMonth: 40, chargedStaff: 15, chargedMonths: 12, termMonths: 12,
  staffCharge: 7200, credit: 0, afterCredit: 7200, couponCode: null, couponApplied: false, couponMessage: null, discountPercent: null,
  discountAmount: 0, subtotal: 7200, gstPercent: 18, gst: 1296, grandTotal, amountPaise: grandTotal * 100, currency: 'INR',
  validFrom: null, validTill: null, resultingStaffLimit: null, payable: grandTotal > 0, ...over,
});

interface Deferred {
  resolve: (v: OrderQuote | null) => void;
  signal?: AbortSignal;
  input: { couponCode?: string | null; staffLimit?: number };
}
const calls: Deferred[] = [];

const base: QuoteParams = { planId: 22, staffLimit: 15, couponCode: null, mode: 'new' };
const DEBOUNCE = 30;

beforeEach(() => {
  calls.length = 0;
  mockQuote.mockReset();
  mockQuote.mockImplementation(
    (input: Deferred['input'], opts?: { signal?: AbortSignal }) =>
      new Promise<OrderQuote | null>((resolve) => {
        calls.push({ resolve, signal: opts?.signal, input });
      }),
  );
  signInTestAdmin();
});

describe('useServerQuote', () => {
  it('fetches the first quote at once, reports loading until it lands, then serves it', async () => {
    const { result } = await renderHook(() => useServerQuote(base, true, DEBOUNCE));
    expect(result.current.loading).toBe(true);
    expect(result.current.quote).toBeNull();
    expect(mockQuote).toHaveBeenCalledTimes(1);
    expect(mockQuote).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', orgId: 'org-1', planId: 22, staffLimit: 15, couponCode: null, mode: 'new' }), expect.anything());
    await act(async () => calls[0].resolve(q(8496)));
    expect(result.current.loading).toBe(false);
    expect(result.current.quote?.grandTotal).toBe(8496);
  });

  it('a stale response never overwrites a newer one (and the stale request is aborted)', async () => {
    const { result, rerender } = await renderHook((p: QuoteParams) => useServerQuote(p, true, DEBOUNCE), { initialProps: base });
    await act(async () => calls[0].resolve(q(8496)));
    await rerender({ ...base, couponCode: 'A' });
    await waitFor(() => expect(calls).toHaveLength(2));
    await rerender({ ...base, couponCode: 'B' });
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[1].signal?.aborted).toBe(true);
    await act(async () => calls[2].resolve(q(7000, { couponCode: 'B' }))); // newest answers first
    await act(async () => calls[1].resolve(q(1111, { couponCode: 'A' }))); // the old one answers late
    expect(result.current.quote?.grandTotal).toBe(7000);
    expect(result.current.quote?.couponCode).toBe('B');
    expect(result.current.loading).toBe(false);
  });

  it('debounces rapid input changes into one request and shows loading meanwhile', async () => {
    const { result, rerender } = await renderHook((p: QuoteParams) => useServerQuote(p, true, DEBOUNCE), { initialProps: base });
    await act(async () => calls[0].resolve(q(8496)));
    await rerender({ ...base, staffLimit: 16 });
    await rerender({ ...base, staffLimit: 17 });
    await rerender({ ...base, staffLimit: 18 });
    expect(mockQuote).toHaveBeenCalledTimes(1); // nothing yet: the timer is pending
    expect(result.current.loading).toBe(true);
    expect(result.current.quote).toBeNull();
    await waitFor(() => expect(mockQuote).toHaveBeenCalledTimes(2));
    expect(calls[1].input).toMatchObject({ staffLimit: 18 });
    await act(async () => calls[1].resolve(q(9000)));
    expect(result.current.quote?.grandTotal).toBe(9000);
  });

  it('falls back when the server has no quote route: quote stays null and loading ends', async () => {
    const { result } = await renderHook(() => useServerQuote(base, true, DEBOUNCE));
    await act(async () => calls[0].resolve(null));
    expect(result.current.quote).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('does nothing when disabled or without inputs', async () => {
    const off = await renderHook(() => useServerQuote(base, false, DEBOUNCE));
    const none = await renderHook(() => useServerQuote(null, true, DEBOUNCE));
    expect(mockQuote).not.toHaveBeenCalled();
    expect(off.result.current.loading).toBe(false);
    expect(none.result.current.loading).toBe(false);
    await expect(off.result.current.settle()).resolves.toBeNull();
  });

  it('settle() returns the loaded quote, or fetches one right now while the inputs are still settling', async () => {
    const { result, rerender } = await renderHook((p: QuoteParams) => useServerQuote(p, true, DEBOUNCE), { initialProps: base });
    await act(async () => calls[0].resolve(q(8496)));
    await expect(result.current.settle()).resolves.toMatchObject({ grandTotal: 8496 });
    expect(mockQuote).toHaveBeenCalledTimes(1);
    await rerender({ ...base, couponCode: 'FLAT500' });
    let pending!: Promise<OrderQuote | null>;
    act(() => {
      pending = result.current.settle();
    });
    await waitFor(() => expect(calls.some((c) => c.input.couponCode === 'FLAT500')).toBe(true));
    const mine = calls.find((c) => c.input.couponCode === 'FLAT500') as Deferred;
    await act(async () => mine.resolve(q(7906, { couponCode: 'FLAT500' })));
    await expect(pending).resolves.toMatchObject({ grandTotal: 7906 });
  });
});
