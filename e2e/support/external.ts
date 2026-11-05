/**
 * The app talks to a few third-party hosts (map tiles, reverse geocoding, Razorpay checkout). E2E runs offline and
 * deterministic: every non-local request is answered here.
 */
import type { BrowserContext, Page } from '@playwright/test';

// 1x1 transparent PNG
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const RAZORPAY_STUB = `
(function () {
  function Razorpay(options) { this.options = options; this.handlers = {}; }
  Razorpay.prototype.on = function (event, cb) { this.handlers[event] = cb; };
  Razorpay.prototype.open = function () {
    var self = this;
    var mode = window.__RZP_MODE || 'success';
    setTimeout(function () {
      var o = self.options;
      if (mode === 'success') {
        o.handler({ razorpay_payment_id: 'pay_mock_1', razorpay_order_id: o.order_id, razorpay_signature: 'sig_mock' });
      } else if (mode === 'dismiss') {
        if (o.modal && o.modal.ondismiss) o.modal.ondismiss();
      } else if (self.handlers['payment.failed']) {
        self.handlers['payment.failed']({ error: { description: 'Payment failed (mock)' } });
      }
    }, 50);
  };
  window.Razorpay = Razorpay;
})();
`;

const NOMINATIM_BODY = {
  name: 'Head Office',
  display_name: 'Head Office, 12 MG Road, Bengaluru, Karnataka, India',
  address: { road: 'MG Road', city: 'Bengaluru', state: 'Karnataka', country: 'India' },
};

/** Route every non-local request to a deterministic stub. Idempotent per context. */
export async function stubExternalNetwork(context: BrowserContext): Promise<void> {
  await context.route(
    (url) => !['127.0.0.1', 'localhost'].includes(url.hostname) && /^https?:$/.test(url.protocol),
    async (route) => {
      const url = new URL(route.request().url());
      const host = url.hostname;
      if (host.endsWith('tile.openstreetmap.org') || host.endsWith('arcgisonline.com')) {
        return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 });
      }
      if (host.endsWith('nominatim.openstreetmap.org')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NOMINATIM_BODY) });
      }
      if (host === 'checkout.razorpay.com') {
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: RAZORPAY_STUB });
      }
      return route.fulfill({ status: 204, body: '' });
    },
  );
}

/** How the stubbed Razorpay checkout ends: 'success' (default) | 'dismiss' | 'fail'. Call before navigating. */
export async function setCheckoutMode(page: Page, mode: 'success' | 'dismiss' | 'fail'): Promise<void> {
  await page.addInitScript((m: string) => {
    (window as unknown as { __RZP_MODE: string }).__RZP_MODE = m;
  }, mode);
}
