import { useCallback, useRef, useState } from 'react';

import { referralApi } from '@/api';
import { ApiError } from '@/lib/api/errors';
import { INVALID_CODE_MESSAGE } from '@/api/referral';
import { REFERRAL_CODE_LENGTH, normalizeReferralCode } from '@/features/referral/utils/code';

export const REFERRAL_SHORT_MESSAGE = `A referral code has ${REFERRAL_CODE_LENGTH} letters or digits`;

export type ReferralCheck = 'idle' | 'checking' | 'valid' | 'invalid' | 'unchecked';

export interface ReferralCodeField {
  /** Normalised text of the field (upper-case, alphanumeric, at most 6). */
  code: string;
  status: ReferralCheck;
  /** "Referred by <org>" once the code is accepted. */
  referrerOrgName: string;
  /** Error shown under the field (invalid code, or an unfinished code after the field was left). */
  error: string;
  /** The code cannot be used as it stands (unfinished or rejected): registering must wait for a fix or an empty field. */
  blocking: boolean;
  /** Code to send with the register request (`undefined` when empty). */
  value: string | undefined;
  setCode: (text: string) => void;
  /** Field left: validates a complete code against the server. */
  blur: () => void;
  /** Settles the check before submitting. `ok: false` carries the message to show. */
  ensure: () => Promise<{ ok: true } | { ok: false; message: string }>;
  /** The register request itself was refused because of the code. */
  reject: (message: string) => void;
}

/** The server answered, so a refusal means "this code is not valid" (as opposed to a flaky network). */
const isRefusal = (e: unknown): e is ApiError => e instanceof ApiError && !e.isNetwork && !e.isTimeout && [400, 404, 422].includes(e.status);

/**
 * The optional "Referral code" field of the sign-up form: typing is normalised, a complete code is checked against
 * `GET /referral/validate` (when it is complete and when the field is left), a rejected or unfinished code blocks the
 * Register button but never touches the other fields. When the check itself cannot run (offline, server hiccup) the form is
 * not blocked: the register call validates the code again and answers 400 if it is wrong.
 */
export function useReferralCode(): ReferralCodeField {
  const [code, setCodeState] = useState('');
  const [status, setStatus] = useState<ReferralCheck>('idle');
  const [referrerOrgName, setReferrer] = useState('');
  const [message, setMessage] = useState('');
  const [left, setLeft] = useState(false);
  const [, setBump] = useState(0);
  /** Increments per request so a slow answer for an older code never overwrites a newer one. */
  const seq = useRef(0);
  const codeRef = useRef('');
  const statusRef = useRef<ReferralCheck>('idle');

  const apply = useCallback((s: ReferralCheck, org = '', msg = '') => {
    statusRef.current = s;
    setStatus(s);
    setReferrer(org);
    setMessage(msg);
  }, []);

  const check = useCallback(
    async (value: string): Promise<{ ok: true } | { ok: false; message: string }> => {
      const mine = ++seq.current;
      apply('checking');
      try {
        const res = await referralApi.validateCode(value);
        if (mine !== seq.current) return res.valid ? { ok: true } : { ok: false, message: res.message };
        if (res.valid) {
          apply('valid', res.referrerOrgName);
          return { ok: true };
        }
        apply('invalid', '', res.message || INVALID_CODE_MESSAGE);
        return { ok: false, message: res.message || INVALID_CODE_MESSAGE };
      } catch (e) {
        if (isRefusal(e)) {
          const msg = e.detail || e.message || INVALID_CODE_MESSAGE;
          if (mine === seq.current) apply('invalid', '', msg);
          return { ok: false, message: msg };
        }
        if (mine === seq.current) apply('unchecked');
        return { ok: true };
      }
    },
    [apply],
  );

  const setCode = useCallback(
    (text: string) => {
      const next = normalizeReferralCode(text);
      if (next === codeRef.current) {
        // A rejected character (typed "-", an extra digit past 6): the state is unchanged, so force a render so the
        // input's own text is put back to the normalised value.
        setBump((n) => n + 1);
        return;
      }
      codeRef.current = next;
      seq.current += 1; // drop any answer still on its way for the previous text
      setCodeState(next);
      apply('idle');
      if (next.length === REFERRAL_CODE_LENGTH) void check(next);
    },
    [apply, check],
  );

  const blur = useCallback(() => {
    setLeft(true);
    const current = codeRef.current;
    if (current.length === REFERRAL_CODE_LENGTH && statusRef.current === 'idle') void check(current);
  }, [check]);

  const ensure = useCallback(async () => {
    const current = codeRef.current;
    if (current === '') return { ok: true } as const;
    if (current.length < REFERRAL_CODE_LENGTH) {
      setLeft(true);
      return { ok: false, message: REFERRAL_SHORT_MESSAGE } as const;
    }
    if (statusRef.current === 'invalid') return { ok: false, message: message || INVALID_CODE_MESSAGE } as const;
    if (statusRef.current === 'valid' || statusRef.current === 'unchecked') return { ok: true } as const;
    return check(current);
  }, [check, message]);

  const reject = useCallback((msg: string) => apply('invalid', '', msg), [apply]);

  const short = code !== '' && code.length < REFERRAL_CODE_LENGTH;
  const error = status === 'invalid' ? message : short && left ? REFERRAL_SHORT_MESSAGE : '';

  return {
    code,
    status,
    referrerOrgName,
    error,
    blocking: short || status === 'invalid',
    value: code === '' ? undefined : code,
    setCode,
    blur,
    ensure,
    reject,
  };
}
