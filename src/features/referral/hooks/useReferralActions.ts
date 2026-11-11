import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui';
import { copyToClipboard } from '@/lib/platform/clipboard';

import { shareReferral, shareViaSms, shareViaWhatsApp, type OpenOutcome } from '../utils/share';

export type CopiedWhat = 'code' | 'message' | null;

export const COPIED_RESET_MS = 2000;

/** Share / WhatsApp / SMS / copy actions of the referral card, with the brief "Copied" state of the copy buttons. */
export function useReferralActions(code: string, message: string) {
  const toast = useToast();
  const [copied, setCopied] = useState<CopiedWhat>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    async (what: Exclude<CopiedWhat, null>) => {
      const ok = await copyToClipboard(what === 'code' ? code : message);
      if (!ok) {
        toast.error('Could not copy. Please copy it manually.');
        return;
      }
      setCopied(what);
      toast.success(what === 'code' ? 'Referral code copied' : 'Share message copied');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), COPIED_RESET_MS);
    },
    [code, message, toast],
  );

  const report = useCallback(
    (outcome: OpenOutcome) => {
      if (outcome === 'copied') toast.success('Message copied. Paste it into any app to share.');
      else if (outcome === 'failed') toast.error('Could not open sharing. Please use Copy message instead.');
    },
    [toast],
  );

  const share = useCallback(async () => report(await shareReferral(message)), [message, report]);
  const whatsapp = useCallback(async () => report(await shareViaWhatsApp(message)), [message, report]);
  const sms = useCallback(async () => report(await shareViaSms(message)), [message, report]);
  const copyCode = useCallback(() => copy('code'), [copy]);
  const copyMessage = useCallback(() => copy('message'), [copy]);

  return { copied, share, whatsapp, sms, copyCode, copyMessage };
}
