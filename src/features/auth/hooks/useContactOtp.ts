import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

import { authApi } from '@/api';
import { useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';

import {
  EMAIL_EXISTS_MESSAGE,
  INVALID_EMAIL_MESSAGE,
  INVALID_MOBILE_MESSAGE,
  MOBILE_EXISTS_MESSAGE,
  MOBILE_LENGTH,
  OTP_LENGTH,
  digitsOnly,
  isValidEmail,
  isValidMobile,
  normalizeEmail,
} from '../utils/validation';

export type ContactKind = 'mobile' | 'email';

const COPY: Record<ContactKind, { exists: string; sendFailed: string; wrongOtp: string }> = {
  mobile: {
    exists: MOBILE_EXISTS_MESSAGE,
    sendFailed: 'Failed to send mobile OTP',
    wrongOtp: 'The mobile OTP you entered is incorrect. Please try again.',
  },
  email: {
    exists: EMAIL_EXISTS_MESSAGE,
    sendFailed: 'Failed to send email OTP',
    wrongOtp: 'The email OTP you entered is incorrect. Please try again.',
  },
};

export interface ContactOtp {
  kind: ContactKind;
  /** `false` when this contact is collected without an OTP (the mobile number of an e-mail sign-in deployment). */
  needsOtp: boolean;
  value: string;
  /** Inline error under the field (already registered, or invalid format once the field was left). */
  error: string;
  checking: boolean;
  otp: string;
  otpSent: boolean;
  verified: boolean;
  sending: boolean;
  verifying: boolean;
  canSend: boolean;
  canVerify: boolean;
  setValue: (text: string) => void;
  setOtp: (text: string) => void;
  sendOtp: () => void;
  verify: () => void;
  /** Leave the OTP step to correct the contact (no resend: a new code needs "Get OTP" again). */
  editContact: () => void;
  /** Call from the field's onBlur: format errors only show after the user left the field. */
  onBlur: () => void;
}

/**
 * One contact (mobile or e-mail) of the registration form: duplicate check, OTP request and OTP verification
 * (purpose `registration`). `initiallyVerified` locks a number already verified on the login screen.
 * `needsOtp: false` keeps the format and duplicate checks but never asks for a code.
 */
export function useContactOtp(
  kind: ContactKind,
  opts: { initialValue?: string; initiallyVerified?: boolean; needsOtp?: boolean } = {},
): ContactOtp {
  const toast = useToast();
  const [value, setValueState] = useState(opts.initialValue ?? '');
  const [existsError, setError] = useState('');
  const [blurred, setBlurred] = useState(false);
  const [checking, setChecking] = useState(false);
  const [otp, setOtpState] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(!!opts.initiallyVerified && !!opts.initialValue);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const seq = useRef(0);
  const copy = COPY[kind];

  const isValid = kind === 'mobile' ? isValidMobile : isValidEmail;
  const formatError =
    blurred && value !== '' && !verified && !isValid(value) ? (kind === 'mobile' ? INVALID_MOBILE_MESSAGE : INVALID_EMAIL_MESSAGE) : '';
  const error = existsError || formatError;

  // Duplicate pre-check (the endpoint may be unavailable: any failure means "unknown", never an error).
  const runExistsCheck = useCallback(
    async (contact: string) => {
      const id = ++seq.current;
      setChecking(true);
      try {
        const exists = kind === 'mobile' ? await authApi.checkMobileExists(contact) : await authApi.checkEmailExists(contact);
        if (id === seq.current && exists) setError(copy.exists);
      } catch {
        /* unknown: the server rejects duplicates at OTP / register time */
      } finally {
        if (id === seq.current) setChecking(false);
      }
    },
    [copy.exists, kind],
  );

  useEffect(
    () => () => {
      seq.current += 1;
    },
    [],
  );

  const setValue = useCallback(
    (text: string) => {
      const next = kind === 'mobile' ? digitsOnly(text, MOBILE_LENGTH) : normalizeEmail(text);
      setValueState(next);
      setError('');
      seq.current += 1; // drop an in-flight check for the previous text
      setChecking(false);
      if (isValid(next)) {
        if (kind === 'mobile') Keyboard.dismiss();
        void runExistsCheck(next);
      }
    },
    [isValid, kind, runExistsCheck],
  );

  const setOtp = useCallback((text: string) => setOtpState(digitsOnly(text, OTP_LENGTH)), []);

  const sendOtp = useCallback(() => {
    if (sending || verified || !isValid(value) || error || checking) return;
    Keyboard.dismiss();
    setSending(true);
    void (async () => {
      try {
        const res = await authApi.requestOtp({ contact: value, purpose: 'registration' });
        setOtpSent(true);
        setOtpState('');
        toast.success(res.message || 'OTP sent');
      } catch (e) {
        const raw = getErrorMessage(e, 'Network error. Please try again.');
        const message = raw === 'Failed to send OTP' ? copy.sendFailed : raw;
        if (/already registered/i.test(message)) setError(message);
        toast.error(message);
      } finally {
        setSending(false);
      }
    })();
  }, [checking, copy.sendFailed, error, isValid, sending, toast, value, verified]);

  const verify = useCallback(() => {
    if (verifying || otp.length !== OTP_LENGTH) return;
    setVerifying(true);
    void (async () => {
      try {
        const res = await authApi.verifyOtp({ contact: value, otp, purpose: 'registration' });
        setVerified(true);
        setOtpSent(false);
        setOtpState('');
        toast.success(res.message || (kind === 'mobile' ? 'Mobile number verified' : 'Email verified'));
      } catch (e) {
        setOtpState('');
        toast.error(getErrorMessage(e, copy.wrongOtp));
      } finally {
        setVerifying(false);
      }
    })();
  }, [copy.wrongOtp, kind, otp, toast, value, verifying]);

  const editContact = useCallback(() => {
    if (verified) return;
    setOtpSent(false);
    setOtpState('');
  }, [verified]);

  return {
    kind,
    needsOtp: opts.needsOtp !== false,
    value,
    error,
    checking,
    otp,
    otpSent,
    verified,
    sending,
    verifying,
    canSend: !verified && !sending && !checking && !error && isValid(value),
    canVerify: !verifying && otp.length === OTP_LENGTH,
    setValue,
    setOtp,
    sendOtp,
    verify,
    editContact,
    onBlur: () => setBlurred(true),
  };
}
