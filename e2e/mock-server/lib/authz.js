'use strict';
/**
 * Bearer-token model of the mock backend (counterpart of the real server's token auth).
 *
 *  - `issueToken(s, userId)`  -> `{ access_token: 'tok-<userId>-<random>', expires_in: 7776000 }` (90 days), remembered per tenant.
 *  - `requireAuth` flag (default false, `POST /__test/state {requireAuth:true}`; `MOCK_REQUIRE_AUTH=1` in the environment of
 *    the mock server turns it on for every tenant from the start and after every reset): every non-public path answers
 *    401 `{detail:'Not authenticated'}` unless `Authorization: Bearer <issued token>` is present. The public list mirrors
 *    PUBLIC_RULES of the real backend (core_functions/auth_policy.py), including the methods.
 *  - `revokeTokens` test action (`POST /__test/state {revokeTokens:true}`): every token issued so far answers 401
 *    `{detail:'Token expired'}` from then on (tokens issued afterwards are valid).
 *  - `POST /auth/logout` revokes the presented token (when it is one this tenant issued).
 */
const crypto = require('node:crypto');

const EXPIRES_IN = 7776000;

// Mirror of PUBLIC_RULES (core_functions/auth_policy.py). Every method unless a method is given (`GET /profile-photo/{id}`:
// reading the URL is public, uploading is not).
const PUBLIC_EXACT = new Set([
  '/', '/health', '/ready', '/docs', '/docs/oauth2-redirect', '/redoc', '/openapi.json', '/version/check',
  '/auth/config', '/auth/generate-otp', '/auth/validate-otp', '/auth/verify-device-token', '/auth/login', '/auth/employee-login',
  '/auth/register', '/auth/register-company', '/auth/logout', '/auth/admin-login', '/auth/admin-login/verify-otp',
]);
const PUBLIC_PREFIXES = ['/auth/check-mobile/', '/auth/check-email/', '/auth/org-logo/', '/auth/session-events/', '/webhook/'];
const PUBLIC_BY_METHOD = [
  ['GET', /^\/profile-photo\/[^/]+$/],
  ['GET', /^\/invoice\/download$/],
  ['GET', /^\/referral\/validate$/],
  ['POST', /^\/requests\/device-change\/submit$/],
];

function isPublicPath(pathname, method = 'GET') {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (PUBLIC_EXACT.has(p) || PUBLIC_PREFIXES.some((prefix) => p.startsWith(prefix))) return true;
  const m = String(method).toUpperCase();
  return PUBLIC_BY_METHOD.some(([method2, re]) => method2 === m && re.test(p));
}

function issueToken(s, userId) {
  const access_token = `tok-${userId}-${crypto.randomBytes(8).toString('hex')}`;
  s.tokens[access_token] = { userId, revoked: false };
  return { access_token, expires_in: EXPIRES_IN };
}

const bearerOf = (req) => {
  const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '').trim());
  return m ? m[1].trim() : null;
};

/** Token string from the Authorization header, or (WebSocket upgrades) the `token` query param. */
function presentedToken(req, url) {
  return bearerOf(req) || (url ? url.searchParams.get('token') : null) || null;
}

/** null = allowed, else `{ status, detail }`. Always allowed while `requireAuth` is off or for public paths. */
// `MOCK_REQUIRE_AUTH` runs (the app never sends `x-e2e-tenant`; the spec helpers that call the mock directly do, and are not
// the system under test, so index.js lets them through without a token): specs boot already signed in (support/auth.ts `loginAs` seeds a session without calling the login
// endpoints), so the token `tok-seed-<userId>` of a seeded session is accepted too (revocable like an issued one).
const SEED_TOKEN = /^tok-seed-(.+)$/;
const seedTokensOn = () => /^(1|true|yes|on)$/i.test(process.env.MOCK_REQUIRE_AUTH || '');

function authFailure(s, pathname, token, method = 'GET') {
  if (!s.flags.requireAuth || isPublicPath(pathname, method)) return null;
  if (!token) return { status: 401, detail: 'Not authenticated' };
  const seed = seedTokensOn() ? SEED_TOKEN.exec(token) : null;
  if (seed && !s.tokens[token]) s.tokens[token] = { userId: seed[1], revoked: false };
  const rec = s.tokens[token];
  if (!rec) return { status: 401, detail: 'Not authenticated' };
  if (rec.revoked) return { status: 401, detail: 'Token expired' };
  return null;
}

function revokeAll(s) {
  for (const rec of Object.values(s.tokens)) rec.revoked = true;
}

module.exports = { EXPIRES_IN, seedTokensOn, isPublicPath, issueToken, bearerOf, presentedToken, authFailure, revokeAll };
