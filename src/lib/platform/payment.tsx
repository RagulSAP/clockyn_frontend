/**
 * Payment — WEB / default implementation: Razorpay `checkout.js`, loaded on demand.
 * `<CheckoutHost />` renders nothing here (the Razorpay modal is injected into the page by checkout.js);
 * it exists so the root layout can mount it unconditionally on every platform.
 * The native implementation (WebView modal) lives in `payment.native.tsx`.
 */
import { CHECKOUT_SCRIPT_URL, buildRazorpayOptions, type CheckoutOptions, type CheckoutResult } from './paymentCore';

export type { CheckoutOptions, CheckoutResult } from './paymentCore';

type RazorpayInstance = { open: () => void; on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void };
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Checkout needs a browser'));
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = CHECKOUT_SCRIPT_URL;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        s.remove();
        scriptPromise = null; // allow a retry
        reject(new Error('Could not load the payment checkout. Check your connection and try again.'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

let inFlight = false;

export async function openCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
  if (inFlight) return { status: 'failed', error: 'A payment is already in progress.' };
  inFlight = true;
  try {
    await loadCheckoutScript();
    const Razorpay = window.Razorpay;
    if (!Razorpay) return { status: 'failed', error: 'Payment checkout is unavailable.' };
    return await new Promise<CheckoutResult>((resolve) => {
      let done = false;
      const finish = (r: CheckoutResult) => {
        if (done) return;
        done = true;
        resolve(r);
      };
      const rzp = new Razorpay({
        ...buildRazorpayOptions(options),
        handler: (r: { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string }) => {
          if (r.razorpay_payment_id && r.razorpay_order_id && r.razorpay_signature) {
            finish({ status: 'success', paymentId: r.razorpay_payment_id, orderId: r.razorpay_order_id, signature: r.razorpay_signature });
          } else {
            finish({ status: 'failed', error: 'Payment response was incomplete' });
          }
        },
        modal: { ondismiss: () => finish({ status: 'dismissed' }) },
      });
      rzp.on('payment.failed', (resp) => finish({ status: 'failed', error: resp.error?.description ?? 'Payment failed' }));
      rzp.open();
    });
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Could not start checkout' };
  } finally {
    inFlight = false;
  }
}

/** No UI to host on the web. */
export function CheckoutHost(): null {
  return null;
}
