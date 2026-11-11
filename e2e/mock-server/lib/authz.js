'use strict';
/**
 * Bearer-token model of the mock backend (counterpart of the real server's token auth).
 *
 *  - `issueToken(s, userId)`  -> `{ access_token: 'tok-<userId>-<random>', expires_in: 7776000 }` (90 days), remembered per tenant.
 *  - `requireAuth` flag (default false, `POST /__test/state {requireAuth:true}`): every non-public path answers
 *    401 `{detail:'Not authenticated'}` unless `Authorization: Bearer <issued token>` is present.
 *  - `revokeTokens` test action (`POST /__test/state {revokeTokens:true}`): every token issued so far answers 401
 *    `{detail:'Token expired'}` from then on (tokens issued afterwards are valid).
 *  - `POST /auth/logout` revokes the presented token (when it is one this tenant issued).
 */
const crypto = require('node:crypto');

const EXPIRES_IN = 7776000;

const PUBLIC_EXACT = new Set([
  '/auth/config', '/auth/generate-otp', '/auth/validate-otp', '/auth/verify-device-token', '/auth/login', '/auth/employee-login',
  '/auth/register', '/referral/validate', '/version/check', '/health', '/ready', '/',
]);
const PUBLIC_PREFIXES = ['/auth/check-mobile/', '/auth/check-email/', '/auth/org-logo/', '/profile-photo/', '/files/', '/static/', '/uploads/', '/webhook/'];

function isPublicPath(pathname) {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PUBLIC_EXACT.has(p) || PUBLIC_PREFIXES.some((prefix) => p.startsWith(prefix));
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
function authFailure(s, pathname, token) {
  if (!s.flags.requireAuth || isPublicPath(pathname)) return null;
  if (!token) return { status: 401, detail: 'Not authenticated' };
  const rec = s.tokens[token];
  if (!rec) return { status: 401, detail: 'Not authenticated' };
  if (rec.revoked) return { status: 401, detail: 'Token expired' };
  return null;
}

function revokeAll(s) {
  for (const rec of Object.values(s.tokens)) rec.revoked = true;
}

module.exports = { EXPIRES_IN, isPublicPath, issueToken, bearerOf, presentedToken, authFailure, revokeAll };
