import type { CheckoutOrder } from '@/types/api/billing';

import { buildCheckoutOptions, runCheckout, verifyPending, type CheckoutContext, type CheckoutDeps } from '../utils/checkoutFlow';

const order: CheckoutOrder = {
  orderId: 'order_1',
  keyId: 'key_test',
  amount: 8496,
  currency: 'INR',
  orderName: '',
  isFirstPayment: false,
  prefill: { name: '', email: '', contact: '9999999999' },
  notes: { org_name: 'Acme Traders' },
};

const ctx: CheckoutContext = {
  userId: 'u1',
  orgId: 'o1',
  email: 'owner@example.com',
  userName: 'Owner',
  orgName: 'Acme',
  planId: 22,
  planName: 'Prime',
  amount: 8496,
  staffLimit: 15,
  couponCode: 'WELCOME10',
};

function makeDeps(over: Partial<CheckoutDeps> = {}): CheckoutDeps & { calls: string[] } {
  const calls: string[] = [];
  const deps: CheckoutDeps = {
    createOrder: jest.fn(async () => {
      calls.push('create');
      return order;
    }),
    openCheckout: jest.fn(async () => {
      calls.push('checkout');
      return { status: 'success' as const, paymentId: 'pay_1', orderId: 'order_1', signature: 'sig' };
    }),
    verifyPayment: jest.fn(async () => {
      calls.push('verify');
      return { message: 'ok', validTill: '2027-10-18', planId: 22 };
    }),
    ...over,
  };
  return Object.assign(deps, { calls });
}

describe('buildCheckoutOptions', () => {
  it('uses the server amount in rupees, the org name from the order notes and sensible fallbacks', () => {
    const o = buildCheckoutOptions(order, ctx);
    expect(o).toMatchObject({
      key: 'key_test',
      orderId: 'order_1',
      amount: 8496,
      currency: 'INR',
      name: 'Acme Traders',
      description: 'Prime Plan Subscription',
      prefill: { name: 'Owner', email: 'owner@example.com', contact: '9999999999' },
    });
  });

  it('falls back to the requested total, the organisation and the app name', () => {
    const o = buildCheckoutOptions({ ...order, amount: 0, notes: {} }, { ...ctx, orgName: '' });
    expect(o.amount).toBe(8496);
    expect(o.name).toBe('Clockyn');
  });
});

describe('runCheckout', () => {
  it('sends the purchase mode of the screen with the order', async () => {
    const deps = makeDeps();
    await runCheckout(deps, { ...ctx, mode: 'renew' });
    expect(deps.createOrder).toHaveBeenCalledWith(expect.objectContaining({ planId: 22, mode: 'renew' }));
  });

  it('carries apply_referral (and no coupon) when a referral reward is redeemed, and omits it otherwise', async () => {
    const deps = makeDeps();
    await runCheckout(deps, { ...ctx, couponCode: null, mode: 'new', applyReferral: true });
    expect(deps.createOrder).toHaveBeenLastCalledWith({ userId: 'u1', orgId: 'o1', planId: 22, amount: 8496, staffLimit: 15, couponCode: null, mode: 'new', applyReferral: true });
    await runCheckout(deps, { ...ctx, applyReferral: false });
    expect((deps.createOrder as unknown as jest.Mock).mock.calls[1][0]).not.toHaveProperty('applyReferral');
  });

  it('creates the order with the grand total, pays, verifies and reports success', async () => {
    const deps = makeDeps();
    const created = jest.fn();
    const outcome = await runCheckout(deps, ctx, created);
    expect(outcome).toMatchObject({ kind: 'success', payment: { validTill: '2027-10-18' } });
    expect(deps.calls).toEqual(['create', 'checkout', 'verify']);
    expect(deps.createOrder).toHaveBeenCalledWith({ userId: 'u1', orgId: 'o1', planId: 22, amount: 8496, staffLimit: 15, couponCode: 'WELCOME10' });
    expect(deps.verifyPayment).toHaveBeenCalledWith({
      userId: 'u1',
      email: 'owner@example.com',
      wantsGstInvoice: false,
      razorpayOrderId: 'order_1',
      razorpayPaymentId: 'pay_1',
      razorpaySignature: 'sig',
    });
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('a closed payment sheet never calls verify', async () => {
    const deps = makeDeps({ openCheckout: jest.fn(async () => ({ status: 'dismissed' as const })) });
    expect(await runCheckout(deps, ctx)).toEqual({ kind: 'dismissed' });
    expect(deps.verifyPayment).not.toHaveBeenCalled();
  });

  it('a failed payment reports the reason and never calls verify', async () => {
    const deps = makeDeps({ openCheckout: jest.fn(async () => ({ status: 'failed' as const, error: 'Card declined' })) });
    expect(await runCheckout(deps, ctx)).toEqual({ kind: 'failed', message: 'Card declined' });
    expect(deps.verifyPayment).not.toHaveBeenCalled();
  });

  it('order creation errors propagate (nothing was charged)', async () => {
    const deps = makeDeps({ createOrder: jest.fn(async () => Promise.reject(new Error('Failed to create order'))) });
    await expect(runCheckout(deps, ctx)).rejects.toThrow('Failed to create order');
    expect(deps.openCheckout).not.toHaveBeenCalled();
  });

  it('a verification failure keeps the payment proof so it can be retried', async () => {
    const deps = makeDeps({ verifyPayment: jest.fn(async () => Promise.reject(new Error('Signature mismatch'))) });
    const outcome = await runCheckout(deps, ctx);
    expect(outcome.kind).toBe('verify-failed');
    if (outcome.kind !== 'verify-failed') return;
    expect(outcome.message).toBe('Signature mismatch');
    expect(outcome.pending.input).toMatchObject({ razorpayPaymentId: 'pay_1', razorpayOrderId: 'order_1', razorpaySignature: 'sig' });

    const retryDeps = makeDeps();
    const retry = await verifyPending(retryDeps, outcome.pending);
    expect(retry.kind).toBe('success');
    expect(retryDeps.createOrder).not.toHaveBeenCalled();
    expect(retryDeps.openCheckout).not.toHaveBeenCalled();
  });
});
