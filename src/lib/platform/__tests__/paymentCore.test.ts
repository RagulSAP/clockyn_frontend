import {
  CHECKOUT_MESSAGE_SOURCE,
  buildCheckoutHtml,
  buildRazorpayOptions,
  parseCheckoutMessage,
  safeJsonForScript,
  toPaise,
} from '../paymentCore';

const base = { key: 'rzp_test_key', orderId: 'order_1', amount: 7646, currency: 'INR', name: 'Org' };

describe('paymentCore', () => {
  it('converts rupees to paise (rounded) unless already paise', () => {
    expect(toPaise(7646)).toBe(764600);
    expect(toPaise(10.005)).toBe(1001);
    expect(toPaise(500, true)).toBe(500);
  });

  it('builds razorpay options', () => {
    const o = buildRazorpayOptions({ ...base, description: 'Plan', prefill: { name: 'A' }, notes: { k: 'v' }, themeColor: '#123456' });
    expect(o).toMatchObject({
      key: 'rzp_test_key',
      amount: 764600,
      currency: 'INR',
      name: 'Org',
      description: 'Plan',
      order_id: 'order_1',
      prefill: { name: 'A', email: '', contact: '' },
      notes: { k: 'v' },
      theme: { color: '#123456' },
    });
  });

  it('cannot be broken out of the inline script by hostile values', () => {
    expect(safeJsonForScript({ a: '</script><script>alert(1)</script>' })).not.toContain('</script>');
    const html = buildCheckoutHtml({ ...base, name: '</script><img src=x onerror=alert(1)>', notes: { x: ' ' } });
    expect(html.match(/<\/script>/g)).toHaveLength(1); // only the page's own closing tag
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('https://checkout.razorpay.com/v1/checkout.js');
  });

  describe('parseCheckoutMessage', () => {
    const msg = (o: object) => JSON.stringify({ source: CHECKOUT_MESSAGE_SOURCE, ...o });

    it('parses success, dismissed and failed', () => {
      expect(parseCheckoutMessage(msg({ status: 'success', paymentId: 'p', orderId: 'o', signature: 's' }))).toEqual({
        status: 'success',
        paymentId: 'p',
        orderId: 'o',
        signature: 's',
      });
      expect(parseCheckoutMessage(msg({ status: 'dismissed' }))).toEqual({ status: 'dismissed', error: undefined });
      expect(parseCheckoutMessage(msg({ status: 'failed', error: 'Card declined' }))).toEqual({ status: 'failed', error: 'Card declined' });
    });

    it('treats an incomplete success as a failure (cannot be verified)', () => {
      expect(parseCheckoutMessage(msg({ status: 'success', paymentId: 'p' }))?.status).toBe('failed');
    });

    it('ignores foreign, malformed and unknown messages', () => {
      expect(parseCheckoutMessage('not json')).toBeNull();
      expect(parseCheckoutMessage(JSON.stringify({ status: 'success' }))).toBeNull();
      expect(parseCheckoutMessage(msg({ status: 'weird' }))).toBeNull();
      expect(parseCheckoutMessage(42)).toBeNull();
      expect(parseCheckoutMessage(null)).toBeNull();
    });

    it('accepts an already-parsed object (web postMessage)', () => {
      expect(parseCheckoutMessage({ source: CHECKOUT_MESSAGE_SOURCE, status: 'dismissed' })?.status).toBe('dismissed');
    });
  });
});
