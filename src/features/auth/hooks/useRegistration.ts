import { useCallback, useMemo, useState } from 'react';

import { authApi } from '@/api';
import { saveAttribution } from '@/api/attribution';
import { useToast } from '@/components/ui';
import { refreshPushToken } from '@/components/layout/bootstrap/pushToken';
import { ApiError, getErrorMessage } from '@/lib/api/errors';
import { logEvent } from '@/lib/platform/analytics';
import { MediaPermissionError, pickImage, type PickedImage } from '@/lib/platform/media';
import { useAppRouter } from '@/lib/navigation';
import { sessionFromRegistration, signIn } from '@/store/auth';
import type { UserAuthMode } from '@/types/api/auth';

import { getDeviceToken } from '../utils/deviceToken';
import { warmRegistrationQueries } from '../utils/loginService';
import {
  buildRegisterInput,
  initialRegisterValues,
  isRegisterReady,
  requiredErrors,
  type RegisterValues,
  type RequiredField,
} from '../utils/registerForm';
import { PIN_LENGTH, REGISTER_GUARD_MESSAGE, cinError, digitsOnly, gstError, isValidMobile, normalizeEmail, normalizeStatutoryId, panError, tanError } from '../utils/validation';
import { useContactOtp, type ContactOtp } from './useContactOtp';

export const REGISTER_NETWORK_MESSAGE = 'Failed to save data - Server not reachable';
export const REGISTER_FAILED_MESSAGE = 'Failed to save data in database';

type TextField = Exclude<keyof RegisterValues, 'branches' | 'departments'>;
type ListField = 'branches' | 'departments';

export interface Registration {
  values: RegisterValues;
  mobile: ContactOtp;
  email: ContactOtp;
  logo: PickedImage | null;
  loading: boolean;
  ready: boolean;
  /** Blocking inline errors, only for fields the user already left. */
  fieldErrors: Partial<Record<RequiredField, string>>;
  /** Display-only statutory format errors (never block the submit). */
  statutoryErrors: { gst: string; pan: string; cin: string; tan: string };
  setField: (field: TextField, text: string) => void;
  touch: (field: RequiredField) => void;
  addToList: (field: ListField) => void;
  updateInList: (field: ListField, index: number, text: string) => void;
  removeFromList: (field: ListField, index: number) => void;
  pickLogo: () => void;
  submit: () => void;
}

/** Normalisation applied while typing (v1: statutory ids upper-case; pincode digits only). */
function normalizeField(field: TextField, text: string): string {
  switch (field) {
    case 'gst':
    case 'pan':
    case 'cin':
    case 'tan':
      return normalizeStatutoryId(text);
    case 'pincode':
      return digitsOnly(text, PIN_LENGTH);
    default:
      return text;
  }
}

/**
 * State and submit pipeline of the company registration screen.
 * `mode` is the deployment's sign-in mode: `otp` verifies the mobile number and the e-mail by OTP; `email` verifies only
 * the e-mail (the mobile number is still collected, but never sent a code).
 */
export function useRegistration(
  params: { mobileNumber?: string; emailAddress?: string; verifiedContact?: string },
  mode: UserAuthMode = 'otp',
): Registration {
  const toast = useToast();
  const router = useAppRouter();
  const [values, setValues] = useState<RegisterValues>(initialRegisterValues);
  const [touched, setTouched] = useState<Partial<Record<RequiredField, boolean>>>({});
  const [logo, setLogo] = useState<PickedImage | null>(null);
  const [loading, setLoading] = useState(false);

  const initialMobile = digitsOnly(params.mobileNumber ?? '', 10);
  const mobile = useContactOtp('mobile', {
    initialValue: initialMobile,
    initiallyVerified: initialMobile !== '' && params.verifiedContact === initialMobile,
    needsOtp: mode === 'otp',
  });
  const initialEmail = normalizeEmail(params.emailAddress ?? '');
  const email = useContactOtp('email', {
    initialValue: initialEmail,
    initiallyVerified: initialEmail !== '' && params.verifiedContact === initialEmail,
  });

  const mobileOk = mobile.needsOtp ? mobile.verified : isValidMobile(mobile.value) && !mobile.error && !mobile.checking;
  const ready = isRegisterReady(values, { mobile: mobile.value, mobileVerified: mobileOk, emailVerified: email.verified });

  const setField = useCallback((field: TextField, text: string) => setValues((v) => ({ ...v, [field]: normalizeField(field, text) })), []);
  const touch = useCallback((field: RequiredField) => setTouched((t) => (t[field] ? t : { ...t, [field]: true })), []);

  const addToList = useCallback((field: ListField) => setValues((v) => ({ ...v, [field]: [...v[field], ''] })), []);
  const updateInList = useCallback(
    (field: ListField, index: number, text: string) => setValues((v) => ({ ...v, [field]: v[field].map((item, i) => (i === index ? text : item)) })),
    [],
  );
  const removeFromList = useCallback(
    (field: ListField, index: number) =>
      setValues((v) => (v[field].length <= 1 ? v : { ...v, [field]: v[field].filter((_, i) => i !== index) })),
    [],
  );

  const pickLogo = useCallback(() => {
    void (async () => {
      try {
        const picked = await pickImage({ source: 'library', allowsEditing: true, quality: 0.8 });
        if (picked) setLogo(picked);
      } catch (e) {
        toast.error(e instanceof MediaPermissionError ? e.message : getErrorMessage(e, 'Could not open the photo library.'));
      }
    })();
  }, [toast]);

  const submit = useCallback(() => {
    if (loading) return;
    if (!ready) {
      toast.error(REGISTER_GUARD_MESSAGE);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const deviceToken = await getDeviceToken(mode === 'email' ? email.value : mobile.value);
        const result = await authApi.registerCompany(buildRegisterInput(values, { mobile: mobile.value, email: email.value, deviceToken }));
        const orgName = result.orgName || values.orgName.trim();
        const orgId = result.orgId || result.userId;

        // Logo: its failure must not undo the registration, but it must not be silent either.
        if (logo && orgId) {
          try {
            const file = { uri: logo.uri, fileName: logo.fileName, mimeType: logo.mimeType };
            // The session does not exist yet: the registration token authorises this one upload.
            if (result.accessToken) await authApi.uploadOrgLogo(orgId, file, { accessToken: result.accessToken });
            else await authApi.uploadOrgLogo(orgId, file);
          } catch {
            toast.error('Your company was created, but the logo could not be uploaded. You can add it later from Company settings.');
          }
        }

        const session = sessionFromRegistration({ userId: result.userId, orgId, orgName, email: email.value, accessToken: result.accessToken, expiresIn: result.expiresIn });
        signIn(session);
        logEvent('CompleteRegistration');
        void saveAttribution({ userId: session.userId, source: 'organic' }).catch(() => undefined);
        void refreshPushToken();
        warmRegistrationQueries(session);
        router.goHome(session.roleId);
        toast.success(`Awesome! Welcome to ${orgName}`);
      } catch (e) {
        toast.error(e instanceof ApiError && e.isNetwork ? REGISTER_NETWORK_MESSAGE : getErrorMessage(e, REGISTER_FAILED_MESSAGE));
      } finally {
        setLoading(false);
      }
    })();
  }, [email.value, loading, logo, mobile.value, mode, ready, router, toast, values]);

  const fieldErrors = useMemo(() => {
    const all = requiredErrors(values);
    const out: Partial<Record<RequiredField, string>> = {};
    for (const key of Object.keys(all) as RequiredField[]) if (touched[key]) out[key] = all[key];
    return out;
  }, [touched, values]);

  const statutoryErrors = useMemo(
    () => ({ gst: gstError(values.gst), pan: panError(values.pan), cin: cinError(values.cin), tan: tanError(values.tan) }),
    [values.cin, values.gst, values.pan, values.tan],
  );

  return { values, mobile, email, logo, loading, ready, fieldErrors, statutoryErrors, setField, touch, addToList, updateInList, removeFromList, pickLogo, submit };
}
