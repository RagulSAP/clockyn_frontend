'use strict';
/**
 * Live Chat (org admin <-> Clockyn support), APP side (spec section 3) plus the operator-side behaviour the tests need
 * (`supportReply`, driven by `POST /__test/live-chat/support-reply`, and `setStatus`). One thread per organisation,
 * messages in `s.liveChat.messages`; frames go to every admin socket of the organisation (spec section 5).
 */
const { fail, bizFail } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');

const ok = (extra) => ({ success: true, ...extra });
const kindOf = (mime) => (/^image\//i.test(mime || '') ? 'image' : 'file');

function thread(s, orgId, create) {
  const lc = s.liveChat;
  if (!lc.threads[orgId] && create) lc.threads[orgId] = { thread_id: `lct-${orgId}`, status: 'open' };
  return lc.threads[orgId] || null;
}

/** The caller must be a role-1 user of the organisation (the real backend answers 403 otherwise). */
function requireOrgAdmin(c, orgId, userId) {
  const u = userId ? D.user(c.s, userId) : null;
  if (!u || u.role_id !== 1 || u.status !== 1 || u.org_id !== D.resolveOrg(c.s, orgId)) fail(403, 'Forbidden');
  return u;
}

function wire(c, m) {
  return {
    message_id: m.message_id,
    timestamp: m.timestamp,
    message_type: m.message_type,
    message: m.message,
    file_url: D.abs(c.origin, m.file_url),
    file_name: m.file_name,
    content_type: m.content_type,
    sender_type: m.sender_type,
    sender_id: m.sender_id,
    sender_name: m.sender_name,
    is_read: m.is_read,
    is_delivered: true,
  };
}

const orgMessages = (c, orgId) => c.s.liveChat.messages.filter((m) => m.org_id === orgId);
const adminIds = (c, orgId) => c.s.users.filter((u) => u.org_id === orgId && u.role_id === 1 && u.status === 1).map((u) => u.user_id);

function addMessage(c, orgId, { senderType, senderId, senderName, text, type, fileUrl, fileName, contentType }) {
  const lc = c.s.liveChat;
  const th = thread(c.s, orgId, true);
  lc.seq += 1;
  const m = {
    message_id: `lcm-${lc.seq}`, org_id: orgId, thread_id: th.thread_id, sender_type: senderType, sender_id: senderId, sender_name: senderName,
    message_type: type, message: text, file_url: fileUrl || null, file_name: fileName || null, content_type: contentType || null,
    timestamp: T.isoNow(), is_read: false,
  };
  lc.messages.push(m);
  if (senderType === 'org') th.status = 'open'; // an org message reopens a closed thread
  const frame = { type: 'live_chat_message', data: { ...wire(c, m), org_id: orgId } };
  for (const uid of adminIds(c, orgId)) c.push(uid, frame);
  return wire(c, m);
}

function orgSend(c, { orgId, userId, text, type, fileUrl, fileName, contentType }) {
  const u = requireOrgAdmin(c, orgId, userId);
  return addMessage(c, D.resolveOrg(c.s, orgId), { senderType: 'org', senderId: u.user_id, senderName: u.name, text, type, fileUrl, fileName, contentType });
}

/** Test hook: a support agent writes into an organisation's thread (creates it when needed). */
function supportReply(c, body) {
  const orgId = D.resolveOrg(c.s, body.org_id);
  const agent = body.agent_name || 'Priya (Clockyn Support)';
  if (body.status) {
    const th = thread(c.s, orgId, true);
    th.status = body.status === 'closed' ? 'closed' : 'open';
  }
  if (!body.message && !body.file_name) return { ok: true, status: thread(c.s, orgId, false) ? thread(c.s, orgId, false).status : null };
  const fileName = body.file_name || null;
  const msg = addMessage(c, orgId, {
    senderType: 'support', senderId: 'agent@clockyn.test', senderName: agent, text: body.message || fileName,
    type: fileName ? kindOf(body.content_type) : 'text', fileUrl: fileName ? `/files/live-chat/${encodeURIComponent(fileName)}` : null, fileName, contentType: body.content_type,
  });
  if (body.status === 'closed') thread(c.s, orgId, true).status = 'closed';
  return { ok: true, message: msg, status: thread(c.s, orgId, false).status };
}

/** Test hook: the support agent read the org's messages (ticks turn blue on the app). */
function supportRead(c, body) {
  const orgId = D.resolveOrg(c.s, body.org_id);
  let marked = 0;
  for (const m of orgMessages(c, orgId)) if (m.sender_type === 'org' && !m.is_read) { m.is_read = true; marked += 1; }
  for (const uid of adminIds(c, orgId)) c.push(uid, { type: 'live_chat_read', data: { org_id: orgId, reader: 'support' } });
  return { ok: true, marked };
}

/** Test hook: the admin console deletes a message; the org's admins get `live_chat_message_deleted` and history no longer has it. */
function supportDelete(c, body) {
  const orgId = D.resolveOrg(c.s, body.org_id);
  const lc = c.s.liveChat;
  const idx = lc.messages.findIndex((m) => m.org_id === orgId && m.message_id === body.message_id);
  if (idx < 0) return { ok: false, error: 'no such message' };
  lc.messages.splice(idx, 1);
  const rest = orgMessages(c, orgId);
  const last = rest[rest.length - 1];
  const frame = { type: 'live_chat_message_deleted', data: { org_id: orgId, message_id: body.message_id, last_message: last ? last.message : '', last_message_at: last ? last.timestamp : '' } };
  for (const uid of adminIds(c, orgId)) c.push(uid, frame);
  return { ok: true };
}

function register(r) {
  r.get('/live-chat/messages/:org', (c) => {
    requireOrgAdmin(c, c.p.org, c.q.user_id);
    const orgId = D.resolveOrg(c.s, c.p.org);
    const msgs = orgMessages(c, orgId);
    const th = thread(c.s, orgId, false);
    return ok({
      status: th ? th.status : null,
      unread: msgs.filter((m) => m.sender_type === 'support' && !m.is_read).length,
      messages: msgs.map((m) => wire(c, m)),
    });
  });

  r.get('/live-chat/unread/:org', (c) => {
    requireOrgAdmin(c, c.p.org, c.q.user_id);
    return ok({ unread: orgMessages(c, D.resolveOrg(c.s, c.p.org)).filter((m) => m.sender_type === 'support' && !m.is_read).length });
  });

  r.post('/live-chat/send', (c) => {
    requireOrgAdmin(c, c.b.org_id, c.b.user_id);
    const text = String(c.b.message || '').trim();
    if (!text) return bizFail('Message cannot be empty');
    if (text.length > 4000) fail(422, 'Message is too long');
    return ok(orgSend(c, { orgId: c.b.org_id, userId: c.b.user_id, text, type: 'text' }));
  });

  r.post('/live-chat/send-file', (c) => {
    requireOrgAdmin(c, c.b.org_id, c.b.user_id);
    const f = c.files.find((x) => x.field === 'file');
    if (!f) fail(422, 'file is required');
    return ok(orgSend(c, {
      orgId: c.b.org_id, userId: c.b.user_id, text: f.filename, type: kindOf(f.mimetype), fileUrl: `/files/live-chat/${encodeURIComponent(f.filename)}`, fileName: f.filename, contentType: f.mimetype,
    }));
  });

  r.put('/live-chat/mark-read', (c) => {
    requireOrgAdmin(c, c.b.org_id, c.b.user_id);
    let marked = 0;
    for (const m of orgMessages(c, D.resolveOrg(c.s, c.b.org_id))) if (m.sender_type === 'support' && !m.is_read) { m.is_read = true; marked += 1; }
    return ok({ marked });
  });
}

module.exports = { register, supportReply, supportRead, supportDelete };
