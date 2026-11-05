import { useCallback, useState } from 'react';

import * as authApi from '@/api/auth';
import { useToast } from '@/components/ui';
import { useMounted } from '@/hooks/useMounted';
import { getErrorMessage, isApiError } from '@/lib/api/client';

export type ContactKind = 'mobile' | 'email';
export type VerificationState = 'idle' | 'sent' | 'verified';

export type ContactVerification = {
  state: VerificationState;
  otp: string;
  setOtp: (v: string) => void;
  sending: boolean;
  verifying: boolean;
  /** Sends the OTP to `contact`. */
  send: (contact: string) => Promise<void>;
  /** Verifies the typed OTP for `contact`. */
  verify: (contact: string) => Promise<void>;
  /** Back to the plain input (cancel / change the contact). */
  reset: () => void;
};

/**
 * OTP verification of one contact (mobile or e-mail) while editing a company:
 * `idle` (plain input) -> `sent` (OTP boxes) -> `verified` (read-only tick).
 * Purpose is `registration`, like v1. The server's message is shown for every failure (v1 discarded it); a wrong code
 * clears the digits and reads "Invalid mobile/email OTP". OTPs are never logged.
 */
export function useContactVerification(kind: ContactKind): ContactVerification {
  const toast = useToast();
  const isMounted = useMounted();
  const [state, setState] = useState<VerificationState>('idle');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const send = useCallback(
    async (contact: string) => {
      setSending(true);
      try {
        const res = await authApi.requestOtp({ contact, purpose: 'registration' });
        if (!isMounted()) return;
        setOtp('');
        setState('sent');
        toast.success(res.message || 'OTP sent');
      } catch (e) {
        toast.error(getErrorMessage(e, 'Failed to send OTP'));
      } finally {
        if (isMounted()) setSending(false);
      }
    },
    [isMounted, toast],
  );

  const verify = useCallback(
    async (contact: string) => {
      setVerifying(true);
      try {
        await authApi.verifyOtp({ contact, otp, purpose: 'registration' });
        if (!isMounted()) return;
        setState('verified');
        setOtp('');
        toast.success(kind === 'mobile' ? 'Mobile number verified' : 'Email verified');
      } catch (e) {
        if (isMounted()) setOtp('');
        // A rejected code is "Invalid ... OTP"; transport failures keep their own explanation.
        toast.error(isApiError(e) && e.isNetwork ? getErrorMessage(e) : `Invalid ${kind} OTP`);
      } finally {
        if (isMounted()) setVerifying(false);
      }
    },
    [isMounted, kind, otp, toast],
  );

  const reset = useCallback(() => {
    setState('idle');
    setOtp('');
  }, []);

  return { state, otp, setOtp, sending, verifying, send, verify, reset };
}
