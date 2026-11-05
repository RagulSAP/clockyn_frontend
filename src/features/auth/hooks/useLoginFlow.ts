import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Keyboard } from 'react-native';

import { authApi } from '@/api';
import type { UserAuthMode } from '@/types/api/auth';
import { useToast } from '@/components/ui';
import { refreshPushToken } from '@/components/layout/bootstrap/pushToken';
import { routes, useAppRouter } from '@/lib/navigation';
import { ApiError } from '@/lib/api/errors';
import { setString, STORAGE_KEYS } from '@/lib/storage';
import { signIn } from '@/store/auth';

import { clearDeviceToken, getDeviceToken, setDeviceToken } from '../utils/deviceToken';
import {
  initialLoginState,
  interpretDeviceVerify,
  isPrimaryDisabled,
  loginErrorMessage,
  loginReducer,
  otpErrorMessage,
  primaryAction,
  sendOtpErrorMessage,
  type LoginAction,
  type LoginPortalKind,
  type LoginState,
  type PrimaryAction,
} from '../utils/loginMachine';
import { loginAndBuildSession, softPushToken, trackLoginSuccess, warmHomeQueries } from '../utils/loginService';
import { MOBILE_LENGTH, digitsOnly, isValidLoginId, normalizeEmail } from '../utils/validation';

export interface LoginFlow {
  state: LoginState;
  portal: LoginPortalKind;
  action: PrimaryAction;
  actionDisabled: boolean;
  setMobile: (text: string) => void;
  setOtp: (text: string) => void;
  /** Runs the single primary button (Get OTP / Continue / Verify & Continue / Request Access). */
  submit: () => void;
  changeNumber: () => void;
}

/**
 * Mobile + OTP login for one portal. All async work is try/catch/finally; `loading` always clears; stale
 * trusted-device answers are dropped; the role is validated before the session is persisted.
 */
export function useLoginFlow(portal: LoginPortalKind, mode: UserAuthMode = 'otp'): LoginFlow {
  const [state, dispatch] = useReducer(loginReducer, { ...initialLoginState, mode });
  const toast = useToast();
  const router = useAppRouter();
  const checkSeq = useRef(0);
  const running = useRef(false);
  /** Bearer token issued by the trusted-device check for `mobile` (used by "Continue", which skips the OTP). */
  const trustedToken = useRef<{ mobile: string; accessToken: string; expiresIn?: number } | null>(null);

  // Trusted-device check whenever a valid number is typed (cancelled / ignored when the number changes).
  const { mobile, checkKey } = state;
  useEffect(() => {
    checkSeq.current += 1;
    if (!isValidLoginId(mode, mobile)) return undefined;
    const seq = checkSeq.current;
    void (async () => {
      try {
        const token = await getDeviceToken(mobile);
        if (seq !== checkSeq.current) return;
        if (!token) {
          dispatch({ type: 'trustFailed', mobile });
          return;
        }
        dispatch({ type: 'trustChecking', mobile });
        const pushToken = await softPushToken();
        const res = await authApi.verifyDeviceToken({
          contact: mobile,
          deviceToken: token,
          roleId: portal === 'admin' ? 1 : undefined,
          pushToken,
        });
        if (seq !== checkSeq.current) return;
        trustedToken.current = res.accessToken ? { mobile, accessToken: res.accessToken, expiresIn: res.expiresIn } : null;
        const outcome = interpretDeviceVerify(portal, res);
        if (outcome.removeToken) await clearDeviceToken(mobile);
        if (seq === checkSeq.current) dispatch({ type: 'trustResolved', mobile, outcome });
      } catch {
        if (seq === checkSeq.current) dispatch({ type: 'trustFailed', mobile });
      }
    })();
    return () => {
      checkSeq.current += 1;
    };
  }, [mobile, checkKey, portal, mode]);

  const setMobile = useCallback((text: string) => {
    const value = mode === 'email' ? normalizeEmail(text) : digitsOnly(text, MOBILE_LENGTH);
    dispatch({ type: 'mobileChanged', value });
    if (mode === 'otp' && value.length === MOBILE_LENGTH) Keyboard.dismiss();
  }, [mode]);

  const setOtp = useCallback((text: string) => dispatch({ type: 'otpChanged', value: text }), []);
  const changeNumber = useCallback(() => dispatch({ type: 'changeNumber' }), []);

  const sendOtp = useCallback(async () => {
    if (!isValidLoginId(mode, mobile)) return;
    Keyboard.dismiss();
    dispatch({ type: 'otpRequestStarted' });
    try {
      const res = await authApi.requestOtp({ contact: mobile, purpose: 'login', roleId: portal === 'admin' ? 1 : 3 });
      dispatch({ type: 'otpRequested' });
      toast.success(res.message || 'OTP sent');
    } catch (e) {
      dispatch({ type: 'otpRequestFailed' });
      toast.error(sendOtpErrorMessage(e));
    }
  }, [mobile, mode, portal, toast]);

  const runLogin = useCallback(
    async (attempt: 'trusted' | 'otp', otp: string) => {
      if (running.current) return;
      running.current = true;
      dispatch({ type: 'loginStarted' });
      let otpAccepted = attempt === 'trusted';
      let end: LoginAction = { type: 'loginEnded' };
      try {
        let deviceToken = await getDeviceToken(mobile);
        const trusted = attempt === 'trusted' && trustedToken.current?.mobile === mobile ? trustedToken.current : null;
        let accessToken: string | undefined = trusted?.accessToken;
        let expiresIn: number | undefined = trusted?.expiresIn;

        if (attempt === 'otp') {
          try {
            const pushToken = await softPushToken();
            const verified = await authApi.verifyOtp({
              contact: mobile,
              otp,
              purpose: 'login',
              deviceToken: deviceToken ?? undefined,
              pushToken,
            });
            otpAccepted = true;
            accessToken = verified.accessToken;
            expiresIn = verified.expiresIn;
            if (verified.deviceToken) {
              await setDeviceToken(mobile, verified.deviceToken);
              deviceToken = verified.deviceToken;
            }
            if (portal === 'admin' && !verified.userExists) {
              // Unknown number / email: continue with the company registration, the contact is already verified.
              router.push(routes.register, mode === 'email' ? { emailAddress: mobile, verifiedContact: mobile } : { mobileNumber: mobile, verifiedContact: mobile });
              return;
            }
          } catch (e) {
            end = { type: 'loginEnded', otpRejected: true };
            toast.error(otpErrorMessage(e));
            return;
          }
        }

        const { session } = await loginAndBuildSession(portal, mobile, { deviceToken, accessToken, expiresIn });
        // Grace window for the single-device session check (must exist before the watcher starts).
        await setString(STORAGE_KEYS.lastLoginAt, String(Date.now()));
        signIn(session);
        trackLoginSuccess();
        void refreshPushToken();
        warmHomeQueries(session);
        router.goHome(session.roleId);
      } catch (e) {
        // After a verified OTP the code is spent: go back to the number (the stored token enables "Continue").
        end = { type: 'loginEnded', backToNumber: attempt === 'otp' && otpAccepted && !(e instanceof ApiError && e.isNetwork) };
        toast.error(loginErrorMessage(portal, e));
      } finally {
        running.current = false;
        dispatch(end);
      }
    },
    [mobile, mode, portal, router, toast],
  );

  const submit = useCallback(() => {
    const action = primaryAction(state, portal);
    if (isPrimaryDisabled(state, portal)) return;
    switch (action) {
      case 'get-otp':
        void sendOtp();
        break;
      case 'continue':
        void runLogin('trusted', '');
        break;
      case 'verify-otp':
        void runLogin('otp', state.otp);
        break;
      case 'request-access':
        router.push(routes.deviceChangeRequest, { userId: state.mismatchUserId, orgId: state.mismatchOrgId, mobile: state.mobile });
        break;
      default:
        break;
    }
  }, [portal, router, runLogin, sendOtp, state]);

  return {
    state,
    portal,
    action: primaryAction(state, portal),
    actionDisabled: isPrimaryDisabled(state, portal),
    setMobile,
    setOtp,
    submit,
    changeNumber,
  };
}
