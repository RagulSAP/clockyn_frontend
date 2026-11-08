#!/usr/bin/env node
'use strict';
/**
 * Clockyn mock backend for browser E2E tests.
 *
 *   node e2e/mock-server/index.js            (port from MOCK_PORT / PORT, default 8787)
 *
 * Implements every endpoint family the app calls with in-memory, stateful fixtures and the real backend's response
 * envelopes. Control surface (all under /__test): reset, state, requests, push, fixtures, sockets, pushes, tenants, health, live-chat/support-reply, live-chat/support-read.
 *
 * Tenancy: every browser origin (and every `x-e2e-tenant` header / `?__tenant=` value) gets its OWN independent state,
 * request log and WebSocket registry. Playwright workers use one web origin each, so specs can run in parallel
 * without touching each other's data. Callers without an origin (curl, the selfcheck) share the `default` tenant.
 * See e2e/README.md.
 */
const http = require('node:http');
const { WebSocketServer } = require('ws');

const { HttpError, Raw, Router, parseBody, sendJson, sendRaw, CORS } = require('./lib/http');
const T = require('./lib/time');
const { makePng } = require('./lib/png');
const { createState } = require('./state');
const authz = require('./lib/authz');
const F = require('./fixtures');

const PORT = Number(process.env.MOCK_PORT || process.env.PORT || 8787);
const HOST = process.env.MOCK_HOST || '127.0.0.1';
const MAX_LOG = 3000;

// ─── tenants ─────────────────────────────────────────────────────────────────────────────────────────
const tenants = new Map();

function createTenant(key, clock) {
  T.clock.offsetMs = 0;
  if (clock) T.setClock(clock); // a pinned clock also moves the seed: the attendance history is built relative to that day
  const state = createState();
  return { key, state, clockOffsetMs: T.clock.offsetMs, requestLog: [], logSeq: 0, pushLog: [], sockets: new Map(), socketMeta: new WeakMap(), lastUsed: Date.now() };
}

function tenantKey(req, url) {
  const raw = req.headers['x-e2e-tenant'] || url.searchParams.get('__tenant') || req.headers.origin || 'default';
  const key = String(raw).trim().toLowerCase();
  return !key || key === 'null' ? 'default' : key;
}

function tenantFor(req, url) {
  const key = tenantKey(req, url);
  let t = tenants.get(key);
  if (!t) {
    t = createTenant(key);
    tenants.set(key, t);
  }
  t.lastUsed = Date.now();
  T.clock.offsetMs = t.clockOffsetMs; // handlers are synchronous: no other tenant can interleave until they return
  return t;
}

// ─── realtime ────────────────────────────────────────────────────────────────────────────────────────
function pushTo(t, userId, frame) {
  const set = t.sockets.get(userId);
  const text = typeof frame === 'string' ? frame : JSON.stringify(frame);
  let delivered = 0;
  if (set) {
    for (const ws of set) {
      if (ws.readyState === ws.OPEN) {
        ws.send(text);
        delivered += 1;
      }
    }
  }
  t.pushLog.push({ ts: T.isoNow(), userId, frame, delivered });
  if (t.pushLog.length > 500) t.pushLog.shift();
  return delivered;
}

const isOnlineIn = (t, userId) => !!(t.sockets.get(userId) && [...t.sockets.get(userId)].some((w) => w.readyState === w.OPEN));

// ─── routes ──────────────────────────────────────────────────────────────────────────────────────────
const router = new Router();
for (const mod of ['auth', 'home', 'org', 'staff', 'attendance', 'requests', 'expenses', 'comms', 'liveChat', 'crm', 'payroll', 'reports', 'billing']) {
  require(`./routes/${mod}`).register(router);
}

const PNG = makePng();

// ─── control endpoints ───────────────────────────────────────────────────────────────────────────────
function patchState(t, b) {
  const f = t.state.flags;
  if (b.plan !== undefined) {
    if (!['elite', 'prime', 'core', 'trial', 'expired', 'none'].includes(b.plan)) throw new HttpError(400, `Unknown plan state '${b.plan}' (elite|prime|core|trial|expired|none)`);
    f.plan = b.plan;
  }
  // Billing set-up (additive): `catalogue` = replacement plan tiers [{plan_id, plan_name, plan_amount, plan_month}],
  // `subscription` = patch of the paid subscription row {plan_id, start_date, end_date, staff_limit, status}.
  if (b.catalogue !== undefined) f.catalogue = Array.isArray(b.catalogue) && b.catalogue.length ? b.catalogue : null;
  if (b.subscription && typeof b.subscription === 'object') Object.assign(t.state.subscription, b.subscription);
  // `coupon` = patch of the (single) coupon row, e.g. a flat / capped / minimum-amount rule for `POST /orders/quote`:
  // { coupon_name: 'FLAT500', discount: 0, discount_type: 'flat', flat_amount: 500, max_discount: null, min_amount: null }.
  if (b.coupon && typeof b.coupon === 'object') Object.assign(t.state.coupon, b.coupon);
  if (b.latencyMs !== undefined) f.latencyMs = Math.max(0, Number(b.latencyMs) || 0);
  if (b.clearFailures) f.failNext = [];
  if (b.failNext !== undefined) {
    const rules = Array.isArray(b.failNext) ? b.failNext : [b.failNext];
    for (const rule of rules) {
      const r = typeof rule === 'string' ? { path: rule } : rule;
      if (!r || !r.path) throw new HttpError(400, 'failNext needs a path');
      f.failNext.push({ method: r.method ? String(r.method).toUpperCase() : null, path: r.path, status: r.status || 500, body: r.body, times: r.times === undefined ? 1 : r.times, networkError: !!r.networkError });
    }
  }
  if (b.clock !== undefined) {
    T.setClock(b.clock);
    t.clockOffsetMs = T.clock.offsetMs;
  }
  if (b.forceLogout !== undefined) {
    if (Array.isArray(b.forceLogout)) f.forceLogout = [...b.forceLogout];
    else {
      if (b.forceLogout.add) f.forceLogout = [...new Set([...f.forceLogout, ...b.forceLogout.add])];
      if (b.forceLogout.remove) f.forceLogout = f.forceLogout.filter((x) => !b.forceLogout.remove.includes(x));
    }
  }
  for (const k of ['faceMismatch', 'otp', 'userAuth', 'noCoupon', 'locationLogStatus', 'version', 'birthdays', 'dupLeadRows']) if (b[k] !== undefined) f[k] = b[k];
  // Bearer-token auth (see lib/authz.js): `requireAuth` gates every non-public path; `revokeTokens: true` makes every token
  // issued so far answer 401 'Token expired' (an action, not a flag: tokens issued afterwards are valid).
  if (b.requireAuth !== undefined) f.requireAuth = !!b.requireAuth;
  if (b.revokeTokens) authz.revokeAll(t.state);
  // Raw row patch (additive, used by specs to set up preconditions): { userPatch: { 'stf-0001': { face_registered: false } } }
  if (b.userPatch && typeof b.userPatch === 'object') {
    for (const [uid, fields] of Object.entries(b.userPatch)) {
      const u = t.state.users.find((x) => x.user_id === uid);
      if (!u) throw new HttpError(400, `userPatch: unknown user '${uid}'`);
      Object.assign(u, fields);
    }
  }
}

function publicFlags(t) {
  return { ...t.state.flags, clock: t.clockOffsetMs ? T.isoNow() : null, today: T.today(), tenant: t.key, failNext: t.state.flags.failNext.map((x) => ({ ...x })) };
}

function fixturesSnapshot(t) {
  const s = t.state;
  return {
    ...F,
    today: T.today(),
    orgs: s.orgs.map((o) => ({ org_id: o.org_id, org_name: o.org_name })),
    staff: s.users.map((u) => ({ user_id: u.user_id, name: u.name, emp_id: u.emp_id, mobile: u.mobile_number, role_id: u.role_id, status: u.status, field: !!u.is_field_staff, branch_id: u.branch_id, dept_id: u.dept_id, shift_id: u.shift_id, deviceToken: u.device_token })),
    branches: s.branches.map((b) => ({ id: b.branch_id, name: b.branch_name, lat: b.branch_latitude, lng: b.branch_longitude, radius: b.punch_radius })),
    departments: s.departments.map((d) => ({ id: d.dept_id, name: d.dept_name })),
    shifts: s.shifts.filter((x) => x.status === 1).map((x) => ({ id: x.shift_id, name: x.shift_name })),
    requests: s.requests.map((q) => ({ id: q.request_id, type: q.request_type, userId: q.user_id, status: q.status })),
    leads: s.leads.map((l) => ({ id: l.leads_id, status: l.lead_status, work: l.work_status, assignedTo: l.assigned_user_id })),
    groups: s.groups.map((g) => ({ id: g.group_id, name: g.group_name })),
    announcements: s.announcements.map((a) => ({ id: a.id, target: a.target })),
    payslips: s.payslips.map((p) => ({ id: p.pay_slip_id, name: p.payslip_name })),
    plan: s.flags.plan,
  };
}

async function control(req, res, t, pathname, query) {
  const method = req.method;
  const act = () => { T.clock.offsetMs = t.clockOffsetMs; }; // re-activate this tenant's clock after an await
  if (pathname === '/__test/health') return sendJson(res, 200, { ok: true, port: PORT, today: T.today(), tenant: t.key });
  if (pathname === '/__test/tenants') return sendJson(res, 200, [...tenants.values()].map((x) => ({ tenant: x.key, requests: x.requestLog.length, sockets: x.sockets.size, plan: x.state.flags.plan })));
  if (pathname === '/__test/reset' && method === 'POST') {
    const { body } = await parseBody(req);
    act();
    const fresh = createTenant(t.key, body && body.clock);
    Object.assign(t, { state: fresh.state, clockOffsetMs: fresh.clockOffsetMs, requestLog: [], pushLog: [] });
    T.clock.offsetMs = fresh.clockOffsetMs;
    if (body && Object.keys(body).length) patchState(t, body);
    return sendJson(res, 200, { ok: true, flags: publicFlags(t) });
  }
  if (pathname === '/__test/state') {
    if (method === 'GET') return sendJson(res, 200, publicFlags(t));
    if (method === 'POST') {
      const { body } = await parseBody(req);
      act();
      patchState(t, body || {});
      return sendJson(res, 200, publicFlags(t));
    }
  }
  if (pathname === '/__test/requests') {
    if (method === 'DELETE') {
      t.requestLog = [];
      return sendJson(res, 200, { ok: true });
    }
    let rows = t.requestLog;
    if (query.method) rows = rows.filter((x) => x.method === String(query.method).toUpperCase());
    if (query.path) rows = rows.filter((x) => (String(query.path).endsWith('*') ? x.path.startsWith(String(query.path).slice(0, -1)) : x.path.includes(query.path)));
    if (query.since) rows = rows.filter((x) => x.id > Number(query.since));
    return sendJson(res, 200, rows);
  }
  if (pathname === '/__test/push' && method === 'POST') {
    const { body } = await parseBody(req);
    act();
    const ids = body.userIds || (body.userId ? [body.userId] : [...t.sockets.keys()]);
    const frame = body.event !== undefined ? body.event : body.frame;
    if (frame === undefined) throw new HttpError(400, 'push needs { userId | userIds, event }');
    let delivered = 0;
    for (const id of ids) delivered += pushTo(t, id, frame);
    return sendJson(res, 200, { delivered, targets: ids.length });
  }
  // Live Chat: the support side of the conversation (the web console is not part of this mock).
  //   POST /__test/live-chat/support-reply { org_id, message?, agent_name?, status?, file_name?, content_type? }
  //   POST /__test/live-chat/support-read  { org_id }   (the agent read the org's messages: ticks turn blue)
  if ((pathname === '/__test/live-chat/support-reply' || pathname === '/__test/live-chat/support-read') && method === 'POST') {
    const { body } = await parseBody(req);
    act();
    const orgId = body && body.org_id;
    if (!orgId) throw new HttpError(400, 'needs { org_id }');
    const ctx = { s: t.state, origin: `http://${req.headers.host || `${HOST}:${PORT}`}`, push: (uid, frame) => pushTo(t, uid, frame) };
    const liveChat = require('./routes/liveChat');
    return sendJson(res, 200, pathname.endsWith('support-read') ? liveChat.supportRead(ctx, body) : liveChat.supportReply(ctx, body));
  }
  if (pathname === '/__test/sockets') {
    const rows = [];
    for (const [userId, set] of t.sockets) for (const ws of set) rows.push({ userId, path: (t.socketMeta.get(ws) || {}).path, state: ws.readyState });
    return sendJson(res, 200, rows);
  }
  if (pathname === '/__test/drop-sockets' && method === 'POST') {
    // Simulates a network drop: abruptly terminates this tenant's open sockets (optionally only one user's) so the app must reconnect.
    const { body } = await parseBody(req);
    const ids = body && body.userId ? [body.userId] : [...t.sockets.keys()];
    let dropped = 0;
    for (const id of ids) for (const ws of [...(t.sockets.get(id) || [])]) { ws.terminate(); dropped += 1; }
    return sendJson(res, 200, { dropped });
  }
  if (pathname === '/__test/pushes') return sendJson(res, 200, t.pushLog);
  if (pathname === '/__test/fixtures') return sendJson(res, 200, fixturesSnapshot(t));
  throw new HttpError(404, `Unknown control endpoint ${pathname}`);
}

function matchFailure(t, method, pathname) {
  const rules = t.state.flags.failNext;
  for (let i = 0; i < rules.length; i += 1) {
    const r = rules[i];
    if (r.method && r.method !== method) continue;
    const hit = r.path.startsWith('re:') ? new RegExp(r.path.slice(3)).test(pathname) : r.path.endsWith('*') ? pathname.startsWith(r.path.slice(0, -1)) : pathname.replace(/\/+$/, '') === r.path.replace(/\/+$/, '');
    if (!hit) continue;
    if (r.times !== -1) {
      r.times -= 1;
      if (r.times <= 0) rules.splice(i, 1);
    }
    return r;
  }
  return null;
}

// ─── main handler ────────────────────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const pathname = url.pathname;
  const query = {};
  for (const [k, v] of url.searchParams) if (k !== '__tenant') query[k] = v;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  try {
    if (pathname.startsWith('/files/') && req.method === 'GET') {
      sendRaw(res, new Raw(PNG, 'image/png', { 'Cache-Control': 'public, max-age=60' }));
      return;
    }
    if (pathname === '/' && req.method === 'GET') {
      sendJson(res, 200, { name: 'clockyn-mock-backend', control: '/__test/health' });
      return;
    }

    const t = tenantFor(req, url);

    if (pathname.startsWith('/__test/')) {
      await control(req, res, t, pathname, query);
      return;
    }

    const entry = { id: (t.logSeq += 1), ts: T.isoNow(), method: req.method, path: pathname, query, body: undefined, files: undefined, status: 0, auth: req.headers.authorization || null };
    t.requestLog.push(entry);
    if (t.requestLog.length > MAX_LOG) t.requestLog.shift();

    if (t.state.flags.latencyMs) await new Promise((r) => setTimeout(r, t.state.flags.latencyMs));

    const parsed = await parseBody(req).catch((e) => {
      if (e instanceof HttpError) throw e;
      return { body: {}, files: [], raw: Buffer.alloc(0) };
    });
    entry.body = parsed.body;
    entry.files = parsed.files.length ? parsed.files : undefined;

    // Re-activate the tenant clock after the awaits above (another tenant may have run in between).
    T.clock.offsetMs = t.clockOffsetMs;

    // Bearer-token gate (only when the spec turned `requireAuth` on): 401 before anything else, like the real middleware.
    const denied = authz.authFailure(t.state, pathname, authz.bearerOf(req));
    if (denied) {
      entry.status = denied.status;
      sendJson(res, denied.status, { detail: denied.detail });
      return;
    }

    const failure = matchFailure(t, req.method, pathname);
    if (failure) {
      entry.status = failure.networkError ? 0 : failure.status;
      entry.injected = true;
      if (failure.networkError) {
        req.socket.destroy();
        return;
      }
      sendJson(res, failure.status, failure.body !== undefined ? failure.body : { detail: 'Injected failure (test)' });
      return;
    }

    const m = router.match(req.method, pathname);
    if (!m) {
      entry.status = router.pathExists(pathname) ? 405 : 404;
      sendJson(res, entry.status, { detail: entry.status === 405 ? 'Method Not Allowed' : 'Not Found', path: pathname });
      return;
    }

    const origin = `http://${req.headers.host || `${HOST}:${PORT}`}`;
    const c = {
      s: t.state, q: query, p: m.params, b: parsed.body && typeof parsed.body === 'object' ? parsed.body : {}, files: parsed.files, req, origin,
      push: (uid, frame) => pushTo(t, uid, frame), isOnline: (uid) => isOnlineIn(t, uid),
    };
    let out;
    try {
      out = await m.route.handler(c);
    } catch (e) {
      if (e instanceof HttpError) {
        entry.status = e.status;
        sendJson(res, e.status, e.body);
        return;
      }
      throw e;
    }
    if (out instanceof Raw) {
      entry.status = out.status;
      sendRaw(res, out);
    } else {
      entry.status = 200;
      sendJson(res, 200, out);
    }
  } catch (e) {
    if (e instanceof HttpError) {
      sendJson(res, e.status, e.body);
      return;
    }
    console.error('[mock] unhandled error', req.method, pathname, e);
    if (!res.headersSent) sendJson(res, 500, { detail: `Mock server error: ${e && e.message}` });
  }
});

// ─── WebSocket upgrade ───────────────────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });
const WS_PATTERNS = [
  { re: /^\/ws\/chat\/([^/]+)\/?$/, user: 1, kind: 'chat' },
  { re: /^\/ws\/group-chat\/([^/]+)\/([^/]+)\/?$/, user: 2, kind: 'group' },
  { re: /^\/ws\/badge\/([^/]+)\/?$/, user: 1, kind: 'badge' },
];

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  const pathname = url.pathname;
  for (const p of WS_PATTERNS) {
    const m = p.re.exec(pathname);
    if (!m) continue;
    const userId = decodeURIComponent(m[p.user]);
    const t = tenantFor(req, url);
    // Browsers cannot set headers on a WebSocket: with `requireAuth` the token must come as `?token=`.
    const wsToken = authz.presentedToken(req, url);
    const wsDenied = authz.authFailure(t.state, '/ws', wsToken);
    if (wsDenied) {
      t.requestLog.push({ id: (t.logSeq += 1), ts: T.isoNow(), method: 'WS', path: pathname, query: {}, body: undefined, status: wsDenied.status, auth: wsToken ? `token=${wsToken}` : null });
      socket.write(`HTTP/1.1 ${wsDenied.status} Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`);
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      t.socketMeta.set(ws, { path: pathname, userId, since: T.isoNow(), kind: p.kind });
      if (!t.sockets.has(userId)) t.sockets.set(userId, new Set());
      t.sockets.get(userId).add(ws);
      t.requestLog.push({ id: (t.logSeq += 1), ts: T.isoNow(), method: 'WS', path: pathname, query: wsToken ? { token: wsToken } : {}, body: undefined, status: 101, auth: wsToken ? `token=${wsToken}` : null });
      ws.on('message', (data) => {
        // The real chat sockets ignore client frames; the badge socket answers pings.
        if (p.kind === 'badge' && String(data) === 'ping') ws.send('pong');
      });
      ws.on('close', () => {
        const set = t.sockets.get(userId);
        if (set) {
          set.delete(ws);
          if (!set.size) t.sockets.delete(userId);
        }
      });
      ws.on('error', () => undefined);
    });
    return;
  }
  socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.destroy();
});

server.listen(PORT, HOST, () => {
  console.log(`[mock] Clockyn mock backend listening on http://${HOST}:${PORT} (admin ${F.USERS.admin.mobile}, manager ${F.USERS.manager.mobile}, staff ${F.USERS.staff.mobile}, OTP ${F.OTP})`);
});

function shutdown() {
  for (const t of tenants.values()) for (const set of t.sockets.values()) for (const ws of set) ws.terminate();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
