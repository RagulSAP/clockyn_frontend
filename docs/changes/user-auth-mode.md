# Sign-in mode: mobile + SMS code or email + emailed code (`USER_AUTH`)

The backend decides (environment variable `USER_AUTH` = `otp` | `email`, default `otp`); the app reads it from `GET /auth/config`
(`authApi.getAuthMode()`, never throws, falls back to `otp`) through `useAuthMode()` (10 min cache) and draws the matching UI.
Nothing is configured in the app build, so one build serves both deployments.

## What changes when `USER_AUTH=email`
| Place | `otp` (as before) | `email` |
|---|---|---|
| Admin and staff login (`LoginPortal` -> `MobileOtpLoginForm`) | mobile field, SMS code | email field (lower-cased as typed, `email-input`), code emailed, "We emailed a code to ...", "Change email" |
| Login id passed to the API | mobile | email (`verify-device-token`, `generate-otp`, `validate-otp`, `login` / `employee-login`) |
| Trusted-device token | stored under the mobile | stored under the email |
| Unknown admin id | register with `mobileNumber` + `verifiedContact` | register with `emailAddress` + `verifiedContact` (email arrives locked) |
| Registration | mobile OTP + email OTP | mobile is a plain required field (format + duplicate check, no code); only the email is verified |
| Company add / edit | mobile and email changes need an OTP | only an email change needs an OTP |

Screens show a spinner until the mode is known (`LoginPortal`, `RegisterScreen`), so the wrong form is never shown. The login state keeps
the field name `mobile` (now documented as "login id") and gains `mode`; `isValidLoginId(mode, value)` replaces `isValidMobile` in the machine.

## Files
`api/auth.ts` (`getAuthMode`), `types/api/auth.ts` (`UserAuthMode`), `lib/query/queryKeys.ts` (`system.authConfig`), `features/auth/hooks/useAuthMode.ts`,
`components/LoginPortal.tsx`, `MobileOtpLoginForm.tsx`, `ContactOtpField.tsx` (`needsOtp`), `hooks/useLoginFlow.ts(portal, mode)`,
`hooks/useRegistration.ts(params, mode)`, `hooks/useContactOtp.ts` (`needsOtp`), `utils/loginMachine.ts`, `utils/validation.ts`,
`features/company/screens/CompanyEditScreen.tsx`. Mock server: `GET /auth/config`, flag `userAuth`, lookups by email, phone refused in email mode.

## Tests
Unit: `screens.test.tsx`, `useLoginFlow.test.tsx`, `validation.test.ts`, `coreModules.test.ts` (new email-mode cases). E2E: `e2e/specs/q4-auth-email-mode.spec.ts`
(`mock.setState({ userAuth: 'email' })`).

## Backend needs
`GET /auth/config` and email-capable `generate-otp` / `validate-otp` / `verify-device-token` / `login` / `employee-login`
(backend repo, see `identity_auth_onboarding.md` "Sign-in mode switch"). Staff need an email on record to sign in.
Not covered: the delete-account OTP (no screen in the app calls it), the platform-operator login.
