/**
 * Pure Razorpay checkout helpers shared by native (WebView) and web (checkout.js): option building,
 * the inline checkout page for the native WebView, and parsing of the page's result message.
 */

export type CheckoutOptions = {
  /** Public Razorpay key id (comes from the backend order response; never stored in the app). */
  key: string;
  orderId: string;
  /** Amount in INR rupees (converted to paise internally) unless `amountInPaise` is set. */
  amount: number;
  amountInPaise?: boolean;
  currency: string;
  /** Merchant name shown in the checkout header. */
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  /** Accent colour of the checkout UI (`#RRGGBB`). */
  themeColor?: string;
};

export type CheckoutResult = {
  status: 'success' | 'dismissed' | 'failed';
  paymentId?: string;
  orderId?: string;
  signature?: string;
  error?: string;
};

export const CHECKOUT_ORIGIN = 'https://checkout.razorpay.com';
export const CHECKOUT_SCRIPT_URL = `${CHECKOUT_ORIGIN}/v1/checkout.js`;
/** Marker so unrelated postMessage traffic is ignored. */
export const CHECKOUT_MESSAGE_SOURCE = 'clockyn-checkout';

export function toPaise(amount: number, alreadyPaise = false): number {
  return alreadyPaise ? Math.round(amount) : Math.round(amount * 100);
}

/** Options for `new Razorpay(...)` minus the callbacks. */
export function buildRazorpayOptions(o: CheckoutOptions): Record<string, unknown> {
  return {
    key: o.key,
    amount: toPaise(o.amount, o.amountInPaise),
    currency: o.currency,
    name: o.name,
    description: o.description ?? '',
    order_id: o.orderId,
    prefill: { name: o.prefill?.name ?? '', email: o.prefill?.email ?? '', contact: o.prefill?.contact ?? '' },
    notes: o.notes ?? {},
    ...(o.themeColor ? { theme: { color: o.themeColor } } : {}),
  };
}

const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g');
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g');

/** JSON that is safe to embed inside an inline `<script>` (no `</script>` break-out, no line separators). */
export function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATOR, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\u2029');
}

/** The page loaded by the native WebView: opens Razorpay immediately and posts the outcome back as JSON. */
export function buildCheckoutHtml(o: CheckoutOptions): string {
  const options = safeJsonForScript(buildRazorpayOptions(o));
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#ffffff;font-family:sans-serif}.msg{padding:24px;text-align:center;color:#555}</style></head>
<body><div class="msg" id="msg">Loading secure checkout…</div>
<script>
(function () {
  var SRC = ${safeJsonForScript(CHECKOUT_MESSAGE_SOURCE)};
  function post(o) {
    o.source = SRC;
    var s = JSON.stringify(o);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent && window.parent !== window) window.parent.postMessage(s, '*');
  }
  var options = ${options};
  options.handler = function (r) {
    post({ status: 'success', paymentId: r.razorpay_payment_id, orderId: r.razorpay_order_id, signature: r.razorpay_signature });
  };
  options.modal = { ondismiss: function () { post({ status: 'dismissed' }); } };
  function start() {
    try {
      var rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        post({ status: 'failed', error: (resp && resp.error && resp.error.description) || 'Payment failed' });
      });
      document.getElementById('msg').style.display = 'none';
      rzp.open();
    } catch (e) { post({ status: 'failed', error: (e && e.message) || 'Could not start checkout' }); }
  }
  var s = document.createElement('script');
  s.src = ${safeJsonForScript(CHECKOUT_SCRIPT_URL)};
  s.onload = start;
  s.onerror = function () { post({ status: 'failed', error: 'Could not load the payment checkout. Check your connection and try again.' }); };
  document.head.appendChild(s);
})();
</script></body></html>`;
}

/** Parses a message posted by the checkout page; returns `null` for anything that is not ours. */
export function parseCheckoutMessage(raw: unknown): CheckoutResult | null {
  let msg: unknown = raw;
  if (typeof raw === 'string') {
    try {
      msg = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!msg || typeof msg !== 'object') return null;
  const m = msg as Record<string, unknown>;
  if (m.source !== CHECKOUT_MESSAGE_SOURCE) return null;
  if (m.status !== 'success' && m.status !== 'dismissed' && m.status !== 'failed') return null;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  if (m.status === 'success') {
    const paymentId = str(m.paymentId);
    const orderId = str(m.orderId);
    const signature = str(m.signature);
    // A "success" without the three values cannot be verified server-side → treat as failure.
    if (!paymentId || !orderId || !signature) return { status: 'failed', error: 'Payment response was incomplete' };
    return { status: 'success', paymentId, orderId, signature };
  }
  return { status: m.status, error: str(m.error) };
}
