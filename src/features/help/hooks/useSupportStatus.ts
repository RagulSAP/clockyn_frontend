import { useCallback, useEffect, useState } from 'react';

import type { ChatItem } from '@/features/chat/types';

import { delayedMessage, isSupportOpen, nextOpeningLabel } from '../utils/supportHours';

const TICK_MS = 20_000;

export interface SupportStatus {
  /** The team is at work right now (Mon–Fri, 10 AM–6 PM IST). */
  open: boolean;
  /** When the team is next in ("Monday at 10 AM"); null while open. */
  nextOpening: string | null;
  /** The last message has waited past the promised time: show the "high volume" note. */
  showDelayNotice: boolean;
  dismissDelayNotice: () => void;
}

/**
 * Live status of Clockyn support for the open conversation: open / closed by the clock, and whether the organisation's
 * last message has been waiting longer than the promised reply time. Re-evaluated every 20 seconds while the screen is open;
 * the note can be closed and comes back only for the next unanswered message.
 */
export function useSupportStatus(items: readonly ChatItem[]): SupportStatus {
  const [now, setNow] = useState(() => Date.now());
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const open = isSupportOpen(now);
  const waiting = delayedMessage(items, now);
  const dismissDelayNotice = useCallback(() => {
    if (waiting) setDismissedId(waiting.id);
  }, [waiting]);

  return {
    open,
    nextOpening: open ? null : nextOpeningLabel(now),
    showDelayNotice: !!waiting && waiting.id !== dismissedId,
    dismissDelayNotice,
  };
}
