import { ApiError } from '@/lib/api/errors';
import type { OrderQuote, ReferralOffer } from '@/types/api/billing';

import { REFERRAL_REFUSED_FALLBACK, isReferralOrderError, referralRefusal, shouldOfferReferral } from '../utils/referral';

const offer = (over: Partial<ReferralOffer> = {}): ReferralOffer => ({ availableCount: 1, eligible: true, percent: 10, message: null, ...over });
const quote = (over: Partial<OrderQuote>): OrderQuote => over as OrderQuote;

describe('referral helpers', () => {
  it('the card is offered only when a reward is available (or one is applied); never without an offer', () => {
    expect(shouldOfferReferral(null, false)).toBe(false);
    expect(shouldOfferReferral(offer({ availableCount: 0 }), false)).toBe(false);
    expect(shouldOfferReferral(offer({ availableCount: 0 }), true)).toBe(true);
    expect(shouldOfferReferral(offer({ availableCount: 2, eligible: false, message: 'Prime and Elite only' }), false)).toBe(true);
  });

  it('referralRefusal prefers the quote message, then the offer message, then a generic one', () => {
    expect(referralRefusal(quote({ referralMessage: 'A', referral: offer({ message: 'B' }) }))).toBe('A');
    expect(referralRefusal(quote({ referralMessage: null, referral: offer({ message: 'B' }) }))).toBe('B');
    expect(referralRefusal(quote({ referralMessage: null, referral: null }))).toBe(REFERRAL_REFUSED_FALLBACK);
  });

  it('isReferralOrderError: any 400 of the create call (the code is not readable in browsers), nothing else', () => {
    expect(isReferralOrderError(new ApiError({ status: 400, detail: 'Use either a coupon or a referral reward, not both' }))).toBe(true);
    expect(isReferralOrderError(new ApiError({ status: 400, detail: 'No referral reward available' }))).toBe(true);
    expect(isReferralOrderError(new ApiError({ status: 500, detail: 'referral exploded' }))).toBe(false);
    expect(isReferralOrderError(new ApiError({ status: 0, isNetwork: true }))).toBe(false);
    expect(isReferralOrderError(new Error('referral'))).toBe(false);
  });
});
