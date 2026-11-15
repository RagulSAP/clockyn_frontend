'use strict';
/* Shell mock for e2e/console/shell.spec.js (hooked into operator-mock.js with one line).
 *
 * What the console shell reads:
 *   GET  /gen-dashboard/live-chat/unread-count            -> {unread_messages}  (sum of the seeded threads' unread, else state.unread)
 *   GET  /company/deletion-requests , /company/suggest-feature   -> arrays of state.deletions / state.suggestions items (sidebar badges)
 *   GET  /gen-dashboard/live-chat/threads?status=all       -> the seeded threads (none by default)
 *   GET  /gen-dashboard/live-chat/threads/{org}/messages   -> {thread, messages}
 *   PUT  /gen-dashboard/live-chat/threads/{org}/read       -> clears that thread's unread
 *   POST /gen-dashboard/live-chat/threads/{org}/messages   -> stores and returns the support reply {message}
 * Control (operator route so the console server answers it): POST /gen-dashboard/__shell/state
 *   { reset: true, unread: n, deletions: n, suggestions: n, threads: true }   (threads: true seeds two conversations)
 * With nothing set every answer equals the generic operator-mock answer, so the other console specs are not affected. */

function iso(minutesAgo) { return new Date(Date.now() - minutesAgo * 60000).toISOString(); }

function seedThreads() {
  const mk = (id, org, ms) => ms.map((m, i) => Object.assign({ message_id: id + '-' + i, timestamp: iso(30 - i), sender_id: m.sender_type === 'org' ? 'u-' + id : 'admin@clockyn.test',
    sender_name: m.sender_type === 'org' ? 'Owner of ' + org : 'Clockyn Support', message_type: 'text', is_read: m.sender_type !== 'org', is_delivered: true }, m));
  return [
    { org_id: 'org-a', org_name: 'Acme Traders', admin_name: 'Asha', admin_email: 'asha@acme.test', admin_mobile: '9000000001', status: 'open', unread_count: 2,
      messages: mk('a', 'Acme Traders', [{ sender_type: 'org', message: 'Hello, how do I add staff?' }, { sender_type: 'support', message: 'Open Staff > Add.' }, { sender_type: 'org', message: 'Thanks, one more question about payroll' }]) },
    { org_id: 'org-b', org_name: 'Beta Foods', admin_name: 'Bala', admin_email: 'bala@beta.test', admin_mobile: '9000000002', status: 'open', unread_count: 0,
      messages: mk('b', 'Beta Foods', [{ sender_type: 'org', message: 'Invoice question' }, { sender_type: 'support', message: 'Sent it by e-mail.' }]) },
  ];
}

function view(t) {
  const last = t.messages[t.messages.length - 1] || null;
  return { org_id: t.org_id, org_name: t.org_name, admin_name: t.admin_name, admin_email: t.admin_email, admin_mobile: t.admin_mobile, status: t.status,
    unread_count: t.unread_count, last_message: last ? last.message : null, last_message_type: last ? last.message_type : null,
    last_sender_type: last ? last.sender_type : null, last_message_at: last ? last.timestamp : null };
}

const state = { unread: 0, deletions: 0, suggestions: 0, threads: [], seq: 0 };

function reset() { state.unread = 0; state.deletions = 0; state.suggestions = 0; state.threads = []; state.seq = 0; }
function unreadTotal() { return state.threads.length ? state.threads.reduce((n, t) => n + t.unread_count, 0) : state.unread; }
const items = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

/* -> [status, body] or null (not ours) */
function handle(method, path, params, body) {
  if (path === '/gen-dashboard/__shell/state' && method === 'POST') {
    if (body.reset) reset();
    for (const k of ['unread', 'deletions', 'suggestions']) if (typeof body[k] === 'number') state[k] = body[k];
    if (body.threads === true) state.threads = seedThreads();
    return [200, { ok: true }];
  }
  if (path === '/gen-dashboard/live-chat/unread-count' && method === 'GET') return [200, { unread_messages: unreadTotal() }];
  if (path === '/company/deletion-requests' && method === 'GET') return [200, items(state.deletions)];
  if (path === '/company/suggest-feature' && method === 'GET') return [200, items(state.suggestions)];
  if (path === '/gen-dashboard/live-chat/threads' && method === 'GET') return [200, state.threads.map(view)];
  const m = /^\/gen-dashboard\/live-chat\/threads\/([^/]+)\/(messages|read)$/.exec(path);
  if (!m) return null;
  const t = state.threads.find((x) => x.org_id === decodeURIComponent(m[1]));
  if (!t) return [404, { detail: 'Conversation not found' }];
  if (m[2] === 'messages' && method === 'GET') return [200, { thread: view(t), messages: t.messages }];
  if (m[2] === 'read' && method === 'PUT') { t.unread_count = 0; return [200, { ok: true }]; }
  if (m[2] === 'messages' && method === 'POST') {
    state.seq += 1;
    const msg = { message_id: 'sent-' + state.seq, timestamp: new Date().toISOString(), sender_type: 'support', sender_id: 'admin@clockyn.test', sender_name: 'Clockyn Support',
      message_type: 'text', message: String(body.message || ''), is_read: false, is_delivered: true };
    t.messages.push(msg);
    return [200, msg];
  }
  return null;
}

module.exports = { handle, reset };
