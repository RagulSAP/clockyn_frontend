import { useCallback, useState } from 'react';

import type { OrderQuote, ReferralOffer } from '@/types/api/billing';

import { REFERRAL_COUPON_CONFLICT, referralRefusal, shouldOfferReferral } from '../utils/referral';

type Note = { text: string; kind: 'conflict' | 'refused' };

export interface UseReferralRewardArgs {
  /** False for capacity upgrades / unsupported platforms: no reward is offered or sent. */
  enabled: boolean;
  /** A coupon is applied right now. */
  hasCoupon: boolean;
  /** Removes the applied coupon (a reward and a coupon are mutually exclusive). */
  clearCoupon: () => void;
}

/**
 * The referral-reward choice of the payment summary. `applyReferral` is what goes into the quote / order request (always
 * false while a coupon is applied). Whatever the server refuses (plan not eligible, reward used up) drops the choice with
 * the server's message; a reward and a coupon replace each other with a short note.
 */
export function useReferralReward({ enabled, hasCoupon, clearCoupon }: UseReferralRewardArgs) {
  const [applied, setApplied] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [offer, setOffer] = useState<ReferralOffer | null>(null);

  const active = enabled && applied;
  const applyReferral = active && !hasCoupon;

  // Adjusted during render (React's "derive state from props" pattern, no extra effect pass):
  // a coupon appeared while a reward was applied (typed, or the welcome coupon): the coupon wins.
  if (active && hasCoupon) {
    setApplied(false);
    setNote({ text: REFERRAL_COUPON_CONFLICT, kind: 'conflict' });
  }
  // The "can't be combined" note goes away once neither a coupon nor a reward is on screen (a refusal stays until the next choice).
  if (note?.kind === 'conflict' && !applied && !hasCoupon) setNote(null);

  /**
   * Feed the server quote of the CURRENT inputs (`null` while it loads / without a quote route). Call it from an effect
   * keyed on `[quote, observeQuote]` (the callback changes with `applyReferral`, so a quote of the previous choice is never
   * judged against the new one). Keeps the last offer (no card flicker while the next quote loads) and, when the server
   * priced the order WITH the reward request and did not apply it (e.g. Core selected), drops the choice and says why.
   */
  const observeQuote = useCallback(
    (quote: OrderQuote | null) => {
      if (!quote) return;
      if (quote.referral) setOffer(quote.referral);
      if (applyReferral && !quote.referralApplied) {
        setApplied(false);
        setNote({ text: referralRefusal(quote), kind: 'refused' });
      }
    },
    [applyReferral],
  );

  const apply = useCallback(() => {
    if (hasCoupon) {
      clearCoupon();
      setNote({ text: REFERRAL_COUPON_CONFLICT, kind: 'conflict' });
    } else {
      setNote(null);
    }
    setApplied(true);
  }, [hasCoupon, clearCoupon]);

  const remove = useCallback(() => {
    setApplied(false);
    setNote(null);
  }, []);

  /** The order was refused because of the reward (any 400 of create): drop it and show the server message. */
  const refuse = useCallback((message: string) => {
    setApplied(false);
    setNote({ text: message, kind: 'refused' });
  }, []);

  return {
    applyReferral,
    offer: enabled ? offer : null,
    visible: enabled && shouldOfferReferral(offer, applyReferral),
    note: note?.text ?? null,
    apply,
    remove,
    refuse,
    observeQuote,
  };
}
