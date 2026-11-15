'use strict';
/* Mock of "support starts a conversation" for e2e/console/orgchat.spec.js (hooked into operator-mock.js with ONE line).
 * Active ONLY after POST /gen-dashboard/__orgchat/state {reset: true}; before that every handler returns null so the generic
 * operator mock and the other mocks (shell-mock, expiry-mock) answer exactly as before.
 *
 * Backend contract it implements:
 *   GET  /gen-dashboard/organizations                           -> the seeded organizations (list view)
 *   GET  /gen-dashboard/live-chat/threads                       -> only organizations that HAVE a thread (>= 1 message)
 *   GET  /gen-dashboard/live-chat/unread-count                  -> {unread_messages}
 *   GET  /gen-dashboard/live-chat/threads/{org}/messages        -> no thread yet: 200 {success, thread:{..., status:'open', unread_count:0, last_message:null, exists:false}, messages:[]}
 *                                                                  thread:        same as before plus exists:true
 *                                                                  unknown / deleted organization: 404 {detail:'Organization not found'}
 *   POST /gen-dashboard/live-chat/threads/{org}/messages        -> creates the thread on the first message, returns the message payload;
 *                                                                  409 {detail:'This organization has no active admin to chat with'}; 404 'Organization not found'
 *   PUT  .../read , .../status
 * Control: POST /gen-dashboard/__orgchat/state {reset:true} (on) or {off:true}; GET /gen-dashboard/__orgchat/log -> the POSTed messages. */

const NO_ADMIN = 'This organization has no active admin to chat with';
const NOT_FOUND = 'Organization not found';

function iso(minutesAgo) { return new Date(Date.now() - minutesAgo * 60000).toISOString(); }

function seedOrgs() {
  const org = (id, name, over) => Object.assign({
    org_id: id, org_name: name, org_address: '1 Main Road', gst_number: '', state: 'Tamil Nadu', district: 'Chennai', pincode: '600001',
    email: id + '@example.com', mobile: '9000000000', emp_count: 12, attendance_activity_count: 3, sub_status: 'ACTIVE', plan_name: 'Prime',
    joined: '01 Nov 2026', start_date: '2026-11-01', end_date: '2027-11-01', free_trial_end_date: null, free_trial_end: null,
    payment_status: 'paid', org_status: 1, _admin: true,
  }, over || {});
  return [
    org('org-a', 'Acme Traders', { admin_name: 'Asha', email: 'asha@acme.test', mobile: '9000000001' }),
    org('org-b', 'Beta Foods', { admin_name: 'Bala', email: 'bala@beta.test', mobile: '9000000002' }),
    org('org-c', 'Gamma Noadmin', { admin_name: '', email: '—', mobile: '—', _admin: false }),
    org('org-d', 'Delta Deleted', { org_status: 2, sub_status: 'EXPIRED', plan_name: 'Core', payment_status: 'unpaid' }),
  ];
}

const state = { on: false, since: 0, orgs: [], threads: {}, seq: 0, log: [], delaySend: 0 };
const MAX_ACTIVE_MS = 15 * 60 * 1000;     /* a forgotten activation (aborted run on a reused server) switches itself off */

/* true while the mock answers: after its own reset (and until {off:true} or MAX_ACTIVE_MS without a new reset) */
function active() { return state.on && Date.now() - state.since < MAX_ACTIVE_MS; }

function reset(body) {
  state.on = true; state.since = Date.now(); state.orgs = seedOrgs(); state.seq = 0; state.log = []; state.delaySend = Number(body && body.delaySend) || 0;
  /* Acme already wrote to us: one conversation with history */
  state.threads = {
    'org-a': { status: 'open', unread_count: 0, messages: [
      { message_id: 'a-0', timestamp: iso(40), sender_type: 'org', sender_id: 'u-a', sender_name: 'Asha', message_type: 'text', message: 'Hello, how do I add staff?', is_read: true, is_delivered: true },
      { message_id: 'a-1', timestamp: iso(35), sender_type: 'support', sender_id: 'admin@clockyn.test', sender_name: 'Clockyn Support', message_type: 'text', message: 'Open Staff, then Add.', is_read: true, is_delivered: true },
    ] },
  };
}

function orgOf(id) { return state.orgs.find((o) => o.org_id === id); }
function usable(o) { return o && o.org_status !== 2; }

function header(o, t) {
  const last = t && t.messages.length ? t.messages[t.messages.length - 1] : null;
  return {
    org_id: o.org_id, org_name: o.org_name, admin_name: o.admin_name || '', admin_email: o._admin ? o.email : '', admin_mobile: o._admin ? o.mobile : '',
    status: t ? t.status : 'open', unread_count: t ? t.unread_count : 0,
    last_message: last ? last.message : null, last_message_type: last ? last.message_type : null,
    last_sender_type: last ? last.sender_type : null, last_message_at: last ? last.timestamp : null, exists: !!t,
  };
}

/* -> [status, body] or null (not ours) */
function handle(method, path, params, body) {
  if (path === '/gen-dashboard/__orgchat/state' && method === 'POST') {
    if (body && body.off) state.on = false; else reset(body);
    return [200, { ok: true }];
  }
  if (!active()) return null;
  if (path === '/gen-dashboard/__orgchat/log' && method === 'GET') return [200, state.log];
  if (path === '/gen-dashboard/organizations' && method === 'GET') {
    return [200, state.orgs.map((o) => { const c = Object.assign({}, o); delete c._admin; return c; })];
  }
  if (path === '/gen-dashboard/live-chat/unread-count' && method === 'GET') {
    return [200, { unread_messages: Object.values(state.threads).reduce((n, t) => n + t.unread_count, 0) }];
  }
  if (path === '/gen-dashboard/live-chat/threads' && method === 'GET') {
    return [200, Object.keys(state.threads).map((id) => header(orgOf(id), state.threads[id]))];
  }
  const m = /^\/gen-dashboard\/live-chat\/threads\/([^/]+)\/(messages|read|status)$/.exec(path);
  if (!m) return null;
  const id = decodeURIComponent(m[1]);
  const o = orgOf(id);
  if (!usable(o)) return [404, { detail: NOT_FOUND }];
  const t = state.threads[id];
  if (m[2] === 'messages' && method === 'GET') return [200, { success: true, thread: header(o, t), messages: t ? t.messages : [] }];
  if (m[2] === 'read' && method === 'PUT') { if (t) t.unread_count = 0; return [200, { success: true }]; }
  if (m[2] === 'status' && method === 'PUT') {
    if (!t) return [404, { detail: 'No conversation for this organization' }];
    t.status = body && body.status === 'closed' ? 'closed' : 'open';
    return [200, { success: true, status: t.status }];
  }
  if (m[2] === 'messages' && method === 'POST') {
    state.log.push({ org_id: id, message: body && body.message });
    if (!o._admin) return [409, { detail: NO_ADMIN }];
    state.seq += 1;
    const msg = { message_id: 'op-' + state.seq, timestamp: new Date().toISOString(), sender_type: 'support', sender_id: 'admin@clockyn.test',
      sender_name: 'Clockyn Support', message_type: 'text', message: String((body && body.message) || ''), is_read: false, is_delivered: true };
    const th = state.threads[id] || (state.threads[id] = { status: 'open', unread_count: 0, messages: [] });
    th.messages.push(msg);
    if (th.status === 'closed') th.status = 'open';
    return [200, msg];
  }
  return null;
}

module.exports = { handle, active };
