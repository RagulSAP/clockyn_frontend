import { Platform } from 'react-native';

import { env } from '@/config/env';

/**
 * Employee Access (staff and manager sign-in) needs the phone: the face punch uses the camera and the location comes from the
 * device. So it is for the Android / iOS app only; in a browser the app explains this instead of opening the login.
 * (Admins use the Admin Portal everywhere. `EXPO_PUBLIC_ALLOW_WEB_EMPLOYEE=true` lifts the block for the browser tests.)
 */
export function isEmployeeAccessBlocked(os: string = Platform.OS, allowWeb: boolean = env.allowWebEmployee): boolean {
  return os === 'web' && !allowWeb;
}

export const EMPLOYEE_MOBILE_ONLY_TITLE = 'Employee Access is mobile only';
export const EMPLOYEE_MOBILE_ONLY_MESSAGE =
  'Employee Access (punch in and out with your face and location, requests, payslips) works only in the Clockyn mobile app on Android and iOS. Please open the app on your phone to sign in. Admins can still sign in here with the Admin Portal.';
