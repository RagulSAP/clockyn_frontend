/**
 * Referral-reward helpers of the payment summary (pure). The server prices and decides; the app only passes the choice
 * (`apply_referral`) and shows what the quote says.
 */
import { ApiError } from '@/lib/api/errors';
import type { OrderQuote, ReferralOffer } from '@/types/api/billing';

/** Shown when a coupon and a reward meet (one replaces the other). */
export const REFERRAL_COUPON_CONFLICT = "A coupon and a referral reward can't be combined";

/** Fallback when the server refuses a reward without saying why. */
export const REFERRAL_REFUSED_FALLBACK = 'This referral reward cannot be applied.';

/** The reward card is offered when the org has a reward to use, or one is applied right now. */
export function shouldOfferReferral(offer: ReferralOffer | null, applied: boolean): boolean {
  return offer !== null && (offer.availableCount > 0 || applied);
}

/** Why a requested reward was not used: the quote's `referral_message`, else the offer's, else a generic text. */
export function referralRefusal(q: OrderQuote): string {
  return q.referralMessage || q.referral?.message || REFERRAL_REFUSED_FALLBACK;
}

/**
 * True when `/orders/create` answered HTTP 400 to an order that asked for a referral reward. The server's reason
 * (`referral_not_applicable`, `referral_with_coupon`, ...) travels only in a plain-text `detail` (the machine code is in an
 * `X-Error-Code` header the browser cannot read), so ANY 400 on such an order counts: show the message, drop the reward,
 * re-quote.
 */
export function isReferralOrderError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 400;
}
