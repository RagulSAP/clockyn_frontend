'use strict';
/* OPERATOR-CONSOLE MOCK (admin web console, UI_ADMIN_APP). Separate from the Expo-app mock in e2e/mock-server (do not merge them).
 *
 * Implements just enough of the platform-operator API to test js/operator-session.js:
 *   POST /auth/admin-login                  -> {success:true}
 *   POST /auth/admin-login/verify-otp       -> OTP 123456; answers {success,email,role_id} plus {access_token,token_type,expires_in}
 *                                              unless the mode is "old" (old backend: no token fields)
 *   GET  /gen-dashboard/* , /company/* , /auth/gen-admin-users , /plans/coupons , /invoice/*   (operator routes)
 *   WS   /ws/support-ops?token= | ?admin_id=
 *
 * Control (POST /__op/state, JSON): { mode: 'token' | 'old', enforce: bool, expiresIn: seconds, force: {path, status, body, times?} | null, reset: true }
 *   mode 'token'  the login issues a token. enforce=false = "new backend in legacy mode": routes accept anything.
 *   mode 'old'    the login issues no token (old backend). Routes never look at credentials.
 *   enforce=true  operator routes answer 401 {"detail":"Not authenticated"} without a valid Bearer token, 401 "Token expired" for an
 *                 expired one (revoke: POST {revoke:true} makes every issued token expired).
 * GET /__op/requests -> recorded calls: {method, path, auth: 'bearer-valid'|'bearer-invalid'|'none', adminId, status}
 *                       (the token itself is never recorded)
 */
const http = require('node:http');
const { WebSocketServer } = require('ws');

const OTP = '123456';
const EMAIL_ROLE = { 'admin@clockyn.test': 1, 'staff@clockyn.test': 2 };

function createOperatorMock() {
  let seq = 0;
  const st = { mode: 'token', enforce: false, expiresIn: 43200, force: null, revoked: false, tokens: new Map(), log: [] };

  function resetState() {
    st.mode = 'token'; st.enforce = false; st.expiresIn = 43200; st.force = null; st.revoked = false;
    st.tokens = new Map(); st.log = []; seq = 0;
  }

  function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-id, x-role-id, x-operator-key, Authorization');
  }

  function send(res, status, body) {
    cors(res);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  }

  function readBody(req) {
    return new Promise((resolve) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    });
  }

  /* 'valid' | 'expired' | 'invalid' | 'none' */
  function bearerState(header) {
    const m = /^Bearer (.+)$/i.exec(header || '');
    if (!m) return 'none';
    const t = st.tokens.get(m[1]);
    if (!t) return 'invalid';
    if (st.revoked || Date.now() >= t.exp) return 'expired';
    return 'valid';
  }

  function isOperatorRoute(path) {
    return /^\/(gen-dashboard|company|plans|invoice)(\/|$)/.test(path) || /^\/auth\/gen-admin-users/.test(path);
  }

  function sampleBody(path) {
    if (path === '/gen-dashboard/me') return { name: 'Test Operator', email: 'admin@clockyn.test', role: 'Admin' };
    if (path === '/gen-dashboard/live-chat/unread-count') return { unread_messages: 0 };
    if (path === '/auth/gen-admin-users') return { success: true, users: [{ name: 'Test Operator', email: 'admin@clockyn.test', role_id: 1 }] };
    if (path.indexOf('/gen-dashboard/') === 0) return {};
    return [];
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;
    if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }

    if (path === '/__op/state' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.reset) resetState();
      if (b.mode) st.mode = b.mode;
      if (typeof b.enforce === 'boolean') st.enforce = b.enforce;
      if (b.expiresIn) st.expiresIn = Number(b.expiresIn);
      if ('force' in b) st.force = b.force ? Object.assign({ times: -1 }, b.force) : null;
      if (b.revoke) st.revoked = true;
      return send(res, 200, { ok: true });
    }
    if (path === '/__op/requests') return send(res, 200, st.log);
    if (path === '/__op/health') return send(res, 200, { ok: true });

    const rec = { method: req.method, path, auth: 'none', adminId: req.headers['x-admin-id'] || '', status: 0 };
    const bs = bearerState(req.headers.authorization);
    rec.auth = bs === 'valid' ? 'bearer-valid' : bs === 'none' ? 'none' : 'bearer-invalid';
    const done = (status, body) => { rec.status = status; st.log.push(rec); send(res, status, body); };

    if (path === '/auth/admin-login' && req.method === 'POST') return done(200, { success: true, message: 'OTP sent' });

    if (path === '/auth/admin-login/verify-otp' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.otp !== OTP) return done(400, { success: false, detail: 'Invalid OTP.' });
      const email = String(b.email || '').toLowerCase();
      const out = { success: true, email, role_id: EMAIL_ROLE[email] || 1 };
      if (st.mode === 'token') {
        seq += 1;
        const token = 'optok-' + seq + '-' + Math.random().toString(36).slice(2, 10);
        st.tokens.set(token, { exp: Date.now() + st.expiresIn * 1000, email });
        out.access_token = token; out.token_type = 'Bearer'; out.expires_in = st.expiresIn;
      }
      return done(200, out);
    }

    if (isOperatorRoute(path)) {
      if (st.force && (st.force.path === path || (st.force.path.endsWith('*') && path.indexOf(st.force.path.slice(0, -1)) === 0))) {
        const f = st.force;
        if (f.times > 0) { f.times -= 1; if (f.times === 0) st.force = null; }
        return done(f.status, f.body || { detail: 'forced' });
      }
      if (st.mode === 'token' && st.enforce) {
        if (bs === 'expired') return done(401, { detail: 'Token expired' });
        if (bs !== 'valid') return done(401, { detail: 'Not authenticated' });
      }
      return done(200, sampleBody(path));
    }
    return done(404, { detail: 'Not Found' });
  }

  function attachWs(server) {
    const wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url, 'http://x');
      if (url.pathname !== '/ws/support-ops') { socket.destroy(); return; }
      const token = url.searchParams.get('token');
      const adminId = url.searchParams.get('admin_id') || '';
      const bs = bearerState(token ? 'Bearer ' + token : '');
      st.log.push({ method: 'WS', path: url.pathname, auth: token ? (bs === 'valid' ? 'token-valid' : 'token-invalid') : 'none', adminId, status: 101 });
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.on('message', (m) => { if (String(m) === 'ping') ws.send('pong'); });
      });
    });
  }

  function listen(port) {
    const server = http.createServer((req, res) => { handle(req, res).catch(() => { try { send(res, 500, { detail: 'mock error' }); } catch { /* ignore */ } }); });
    attachWs(server);
    return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
  }

  return { listen };
}

module.exports = { createOperatorMock, OTP };
