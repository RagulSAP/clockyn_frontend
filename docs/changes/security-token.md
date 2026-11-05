# Bearer-token sessions (security WP12, app side)

The backend issues an opaque access token at login. The app stores it with the session and sends it on every protected request.
Nothing changes for a server that issues no token: no header is sent and the app behaves as before.

## Contract (what the backend must match)
1. **Issue.** `POST /auth/validate-otp` (valid OTP, user exists), `POST /auth/verify-device-token` (`skip_otp: true`) and `POST /auth/register`
   add `access_token` (string) and `expires_in` (seconds). Nothing else in those bodies changes. `POST /auth/login` / `employee-login` return no token:
   the token of the OTP / trusted-device step that precedes the lookup goes into the session.
2. **Send.** `Authorization: Bearer <access_token>` on every request to a non-public path (all methods, uploads included, file downloads from the API host).
   Public (no header): `/auth/config`, `/auth/generate-otp`, `/auth/validate-otp`, `/auth/verify-device-token`, `/auth/login`, `/auth/employee-login`,
   `/auth/register`, `/auth/check-mobile/*`, `/auth/check-email/*`, `/auth/org-logo/*`, `/profile-photo/*`, `/version/check`, `/health`, `/ready`,
   `/files/*`, `/static/*`, `/uploads/*`, `/webhook/*`. Hosts other than the API host (chat attachments, CDN links) never get the header.
3. **Reject.** `401 {"detail": ...}` for a missing / invalid / expired token (only under `REQUIRE_AUTH=1`), `403` for forbidden. A 401 on a protected path
   means "session expired" (see below). A 403 is shown as an ordinary error.
4. **WebSockets.** `/ws/chat/{userId}` and `/ws/group-chat/{groupId}/{userId}` get `?token=<access_token>` (re-read on every reconnect).
5. **Logout.** `POST /auth/logout {user_id, device_token?, push_token?}` (always 200) on an explicit sign-out, before the session is cleared, token header attached.

## App behaviour
| Case | Behaviour |
|---|---|
| Login by OTP / trusted device / registration | token + `tokenExpiresAt` (now + `expires_in`) saved in the persisted session blob (`@clockyn/auth`, same storage, no second location) |
| Request on a protected path | header attached from the live session (store getter, not React); per-call `accessToken` option covers the two calls made before the session exists (restoring the admin's last company, the registration logo upload) |
| 401 on a protected path while signed in | `onUnauthorized` runs ONCE per session (latched on `userId|token`, stale answers of an older session are ignored): `signOut({reason:'expired'})` (stops sockets / tracking / push, clears session + caches, keeps the trusted-device token), welcome screen, toast "Your session expired. Please sign in again." The next login can skip the OTP |
| 401 from a public path, from `/auth/logout`, or with no session | ignored (a wrong OTP or unknown number is a normal error) |
| Session saved before tokens existed, server under `REQUIRE_AUTH=1` | first 401 sends the user to sign in again |
| Sign-out (user pressed Logout) | `authApi.logout` (2.5 s timeout, errors swallowed) runs as a sign-out teardown, before the session is cleared; not called for forced / expired / deleted sign-outs |

## Files
- Types / mappers / API: `src/types/api/auth.ts` (`accessToken`, `expiresIn`, `LogoutInput`), `src/api/mappers/auth.ts`, `src/api/auth.ts` (`logout`, `uploadOrgLogo` option), `src/api/company.ts` (`getCompanyDetails` option).
- Session: `src/store/auth.ts` (`Session.accessToken` / `tokenExpiresAt`, `tokenFields`, `getAccessToken`, `sessionFromLogin` / `sessionFromRegistration` options), `src/store/ui.ts` (`SignOutReason` `expired`).
- Login flow: `src/features/auth/utils/loginService.ts` (`loginAndBuildSession(..., { deviceToken, accessToken, expiresIn })`), `hooks/useLoginFlow.ts`, `hooks/useRegistration.ts`.
- HTTP: `src/lib/api/client.ts` (`isPublicPath`, header, `onUnauthorized`, `authHeadersFor`, `accessToken` request option, upload included), `src/lib/platform/files.ts` + `files.native.ts` (report / invoice downloads), `src/lib/realtime/socketCore.ts` (`?token=`), `src/api/chat.ts`, `src/api/groupChat.ts` (URL helpers).
- Bootstrap: `src/components/layout/bootstrap/sessionExpiry.ts` + `useSessionExpiry.ts` (401 handler), `serverLogout.ts` (logout teardown), `useBootstrapTeardown.ts`, `Bootstrap.tsx`.
- Mock server: `e2e/mock-server/lib/authz.js`, `routes/auth.js` (tokens, `POST /auth/logout`), `index.js` + `state.js` (flags), `e2e/support/mock.ts` (`mock.requireAuth()`, `mock.revokeTokens()`, `auth` on recorded requests).

## How to test
- Unit: `npx jest src/lib/api src/api/__tests__/authToken.test.ts src/store/__tests__/authToken.test.ts src/components/layout/bootstrap src/lib/realtime src/features/auth`
- E2E: `npm run e2e:build` then `npm run e2e -- e2e/specs/q4-auth-token.spec.ts --project desktop --project phone`.
  In specs: `await mock.requireAuth(true)` (every protected path answers 401 `Not authenticated` without an issued token), `await mock.revokeTokens()` (issued tokens answer 401 `Token expired`),
  `(await mock.requests()).map(r => r.auth)` shows the header the app sent (WebSocket rows: `token=<value>`).
- Against a real backend: start it with `REQUIRE_AUTH=1`, sign in by OTP, open a data screen, then revoke the token server-side and reload: the welcome screen with the expiry toast appears.
