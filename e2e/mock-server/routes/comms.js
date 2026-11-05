'use strict';
/** 1:1 chat, group chat (REST side; WebSocket pushes go through `c.push`) and announcements. */
const { fail, bizFail } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');

const ok = (extra) => ({ success: true, ...extra });
const byTime = (a, b) => String(a).localeCompare(String(b));

function fileMessageType(mime) {
  return /^image\//i.test(mime || '') ? 'image' : 'file';
}

function chatWire(c, m) {
  const sender = D.user(c.s, m.sender_id);
  return { message_id: m.message_id, sender_id: m.sender_id, receiver_id: m.receiver_id, message: m.message, message_type: m.message_type, file_url: D.abs(c.origin, m.file_url), timestamp: m.timestamp, is_read: m.is_read, is_delivered: m.is_delivered, sender_name: sender ? sender.name : m.sender_name };
}

function pairMessages(c, a, b) {
  return c.s.messages.filter((m) => ((m.sender_id === a && m.receiver_id === b) || (m.sender_id === b && m.receiver_id === a)) && !(m.deleted_for || []).includes(a));
}

function createChatMessage(c, { senderId, receiverId, text, type, fileUrl }) {
  const sender = D.user(c.s, senderId);
  const receiver = D.user(c.s, receiverId);
  if (!sender || !receiver) fail(404, 'User not found');
  c.s.seq.msg += 1;
  const m = { message_id: `msg-${c.s.seq.msg}`, sender_id: senderId, receiver_id: receiverId, message: text, message_type: type, file_url: fileUrl || null, timestamp: T.isoNow(), is_read: false, is_delivered: true, sender_name: sender.name };
  c.s.messages.push(m);
  const wire = chatWire(c, m);
  c.push(receiverId, { type: 'new_message', data: wire });
  return wire;
}

function groupWire(c, g, m, viewerId) {
  const sender = D.user(c.s, m.sender_id);
  const readers = (m.read_by || []).filter((x) => x !== m.sender_id);
  return {
    message_id: m.message_id, group_id: m.group_id, sender_id: m.sender_id, sender_name: sender ? sender.name : m.sender_name, message: m.message, message_type: m.message_type, file_url: D.abs(c.origin, m.file_url),
    timestamp: m.timestamp, is_read: viewerId ? (m.read_by || []).includes(viewerId) : false, read_count: readers.length, total_members: Math.max(0, g.members.length - 1), // real backend: active members minus the sender
  };
}

function groupById(c, id) {
  const g = c.s.groups.find((x) => x.group_id === id);
  if (!g) fail(404, 'Group not found');
  return g;
}

function sendGroupMessage(c, g, senderId, text, type, fileUrl) {
  if (!g.members.includes(senderId)) fail(403, 'You are not a member of this group');
  c.s.seq.msg += 1;
  const sender = D.user(c.s, senderId);
  const m = { message_id: `gmsg-${c.s.seq.msg}`, group_id: g.group_id, sender_id: senderId, sender_name: sender ? sender.name : '', message: text, message_type: type, file_url: fileUrl || null, timestamp: T.isoNow(), read_by: [senderId] };
  c.s.groupMessages.push(m);
  const wire = groupWire(c, g, m, senderId);
  for (const uid of g.members) if (uid !== senderId) c.push(uid, { type: 'new_group_message', data: wire });
  return wire;
}

function register(r) {
  // ── 1:1 chat ───────────────────────────────────────────────────────────────────────────────────
  r.get('/chat/list/:uid', (c) => {
    D.requireFeature(c.s, 'chat', { wrap: true });
    const me = D.user(c.s, c.p.uid);
    if (!me) fail(404, 'User not found');
    const orgId = D.resolveOrg(c.s, c.q.org_id || me.org_id);
    return c.s.users
      .filter((u) => u.org_id === orgId && u.user_id !== me.user_id && u.status === 1)
      .map((u) => {
        const msgs = pairMessages(c, me.user_id, u.user_id).sort((a, b) => byTime(a.timestamp, b.timestamp));
        const last = msgs[msgs.length - 1];
        return {
          user_id: u.user_id, name: u.name, role_name: D.roleName(u), dept_name: (D.dept(c.s, u.dept_id) || {}).dept_name || '', branch_name: (D.branch(c.s, u.branch_id) || {}).branch_name || '',
          last_message: last ? last.message : null, last_message_type: last ? last.message_type : null, last_message_time: last ? last.timestamp : null,
          unread_count: msgs.filter((m) => m.receiver_id === me.user_id && !m.is_read).length, is_online: c.isOnline(u.user_id), profile_photo_url: D.abs(c.origin, u.photo_url),
        };
      })
      .sort((a, b) => byTime(b.last_message_time || '', a.last_message_time || '') || a.name.localeCompare(b.name));
  });

  r.get('/chat/search/:uid', (c) => {
    const me = D.user(c.s, c.p.uid);
    if (!me) fail(404, 'User not found');
    const q = String(c.q.q || '').trim().toLowerCase();
    return c.s.users
      .filter((u) => u.org_id === me.org_id && u.user_id !== me.user_id && u.status === 1 && (!q || u.name.toLowerCase().includes(q)))
      .map((u) => ({ user_id: u.user_id, name: u.name, role_name: D.roleName(u), dept_name: (D.dept(c.s, u.dept_id) || {}).dept_name || '', branch_name: (D.branch(c.s, u.branch_id) || {}).branch_name || '', profile_photo_url: D.abs(c.origin, u.photo_url) }));
  });

  r.get('/chat/messages/:uid/:other', (c) => pairMessages(c, c.p.uid, c.p.other).sort((a, b) => byTime(a.timestamp, b.timestamp)).map((m) => chatWire(c, m)));

  r.post('/chat/send', (c) => {
    if (!String(c.b.message || '').trim()) fail(400, 'Message cannot be empty');
    return ok(createChatMessage(c, { senderId: c.b.sender_id, receiverId: c.b.receiver_id, text: String(c.b.message), type: 'text' }));
  });

  r.post('/chat/send-file', (c) => {
    const f = c.files.find((x) => x.field === 'file');
    if (!f) fail(422, 'file is required');
    const id = c.s.seq.msg + 1;
    return ok(createChatMessage(c, { senderId: c.b.sender_id, receiverId: c.b.receiver_id, text: f.filename, type: fileMessageType(f.mimetype), fileUrl: `/files/chat/${id}-${encodeURIComponent(f.filename)}` }));
  });

  r.put('/chat/mark-read', (c) => {
    for (const m of c.s.messages) if (m.sender_id === c.b.sender_id && m.receiver_id === c.b.receiver_id) m.is_read = true;
    c.push(c.b.sender_id, { type: 'read_update', data: { reader_id: c.b.receiver_id, sender_id: c.b.sender_id } });
    return ok({ message: 'Messages marked as read' });
  });

  r.delete('/chat/delete/:uid/:other', (c) => {
    for (const m of pairMessages(c, c.p.uid, c.p.other)) (m.deleted_for = m.deleted_for || []).push(c.p.uid);
    return ok({ message: 'Conversation deleted' });
  });

  // ── group chat ─────────────────────────────────────────────────────────────────────────────────
  r.get('/group-chat/list/:uid', (c) => {
    D.requireFeature(c.s, 'chat', { wrap: true });
    return c.s.groups
      .filter((g) => g.members.includes(c.p.uid))
      .map((g) => {
        const msgs = c.s.groupMessages.filter((m) => m.group_id === g.group_id).sort((a, b) => byTime(a.timestamp, b.timestamp));
        const last = msgs[msgs.length - 1];
        return {
          group_id: g.group_id, group_name: g.group_name, created_by: g.created_by, member_count: g.members.length, last_message: last ? last.message : null,
          last_message_sender: last ? last.sender_name : null, last_message_time: last ? last.timestamp : null, unread_count: msgs.filter((m) => m.sender_id !== c.p.uid && !(m.read_by || []).includes(c.p.uid)).length,
        };
      })
      .sort((a, b) => byTime(b.last_message_time || '', a.last_message_time || ''));
  });

  r.post('/group-chat/create', (c) => {
    const name = String(c.b.group_name || '').trim();
    const members = [...new Set(c.b.member_ids || [])];
    if (!name) fail(400, 'Group name is required');
    if (members.length < 2) fail(400, 'A group needs at least 2 members');
    c.s.seq.group += 1;
    const g = { group_id: `grp-${c.s.seq.group}`, group_name: name, created_by: c.b.created_by, org_id: D.resolveOrg(c.s, c.b.org_id), members, created_at: T.isoNow() };
    c.s.groups.push(g);
    for (const uid of members) if (uid !== c.b.created_by) c.push(uid, { type: 'group_created', data: { group_id: g.group_id, group_name: g.group_name, created_by: g.created_by } });
    return ok({ group_id: g.group_id, group_name: g.group_name, created_by: g.created_by, member_count: members.length, message: 'Group created successfully' });
  });

  r.get('/group-chat/messages/:gid', (c) => {
    const g = groupById(c, c.p.gid);
    return c.s.groupMessages.filter((m) => m.group_id === g.group_id).sort((a, b) => byTime(a.timestamp, b.timestamp)).map((m) => groupWire(c, g, m, c.q.user_id));
  });

  r.post('/group-chat/send', (c) => {
    const g = groupById(c, c.b.group_id);
    if (!String(c.b.message || '').trim()) fail(400, 'Message cannot be empty');
    return ok(sendGroupMessage(c, g, c.b.sender_id, String(c.b.message), 'text'));
  });

  r.post('/group-chat/send-file', (c) => {
    const g = groupById(c, c.b.group_id);
    const f = c.files.find((x) => x.field === 'file');
    if (!f) fail(422, 'file is required');
    return ok(sendGroupMessage(c, g, c.b.sender_id, f.filename, fileMessageType(f.mimetype), `/files/chat/g-${Date.now()}-${encodeURIComponent(f.filename)}`));
  });

  r.get('/group-chat/members/:gid', (c) => {
    const g = groupById(c, c.p.gid);
    return g.members.map((id) => D.user(c.s, id)).filter(Boolean).map((u) => ({ user_id: u.user_id, name: u.name, emp_id: u.emp_id, role_name: D.roleName(u), dept_name: (D.dept(c.s, u.dept_id) || {}).dept_name || '', branch_name: (D.branch(c.s, u.branch_id) || {}).branch_name || '', is_admin: u.user_id === g.created_by ? 1 : 0 }));
  });

  r.post('/group-chat/add-members', (c) => {
    const g = groupById(c, c.b.group_id);
    for (const id of c.b.member_ids || []) if (!g.members.includes(id) && D.user(c.s, id)) g.members.push(id);
    return ok({ message: 'Members added successfully' });
  });

  r.put('/group-chat/mark-read', (c) => {
    const g = groupById(c, c.b.group_id);
    for (const m of c.s.groupMessages) if (m.group_id === g.group_id && !(m.read_by || []).includes(c.b.user_id)) (m.read_by = m.read_by || []).push(c.b.user_id);
    for (const uid of g.members) if (uid !== c.b.user_id) c.push(uid, { type: 'read_update', data: { reader_id: c.b.user_id, group_id: g.group_id } });
    return ok({ message: 'Messages marked as read' });
  });

  // ── announcements ──────────────────────────────────────────────────────────────────────────────
  const annWire = (c, a) => {
    const sender = D.user(c.s, a.sent_by);
    return {
      id: a.id, announcement_id: a.id, title: a.title, message: a.message, target: a.target, branch_id: a.branch_id, dept_id: a.dept_id,
      branch_name: a.branch_id ? (D.branch(c.s, a.branch_id) || {}).branch_name || null : null, dept_name: a.dept_id ? (D.dept(c.s, a.dept_id) || {}).dept_name || null : null,
      sent_by: sender ? sender.name : a.sent_by, created_at: a.created_at, recipient_count: D.recipientsOf(c.s, a).length,
    };
  };

  r.post('/api/announcements', (c) => {
    const b = c.b;
    const sender = D.user(c.s, b.sent_by_id);
    if (!sender || sender.role_id !== 1) fail(403, 'Only admins can send announcements');
    if (!String(b.title || '').trim() || !String(b.message || '').trim()) return bizFail('Title and message are required');
    if (!['all', 'selected', 'branch', 'dept'].includes(b.target)) return bizFail('Invalid target');
    if (b.target === 'selected' && !(b.selected_user_ids || []).length) return bizFail('Select at least one recipient');
    c.s.seq.ann += 1;
    const a = { id: `ann-${c.s.seq.ann}`, org_id: D.resolveOrg(c.s, b.org_id), title: String(b.title).trim(), message: String(b.message).trim(), target: b.target, branch_id: b.target === 'branch' ? Number(b.branch_id) : null, dept_id: b.target === 'dept' ? b.dept_id : null, selected_user_ids: b.target === 'selected' ? b.selected_user_ids : [], sent_by: sender.user_id, created_at: T.isoNow() };
    c.s.announcements.unshift(a);
    const recipients = D.recipientsOf(c.s, a);
    for (const uid of recipients) c.push(uid, { type: 'announcement', target: a.target, data: { announcement_id: a.id, title: a.title, target: a.target } });
    return ok({ message: 'Announcement sent successfully', announcement_id: a.id, recipient_count: recipients.length });
  });

  r.get('/api/announcements/employee/:uid', (c) => ok({ data: c.s.announcements.filter((a) => D.recipientsOf(c.s, a).includes(c.p.uid)).sort((a, b) => byTime(b.created_at, a.created_at)).map((a) => annWire(c, a)) }));

  r.get('/api/announcements/:org', (c) => ok({ data: c.s.announcements.filter((a) => a.org_id === D.resolveOrg(c.s, c.p.org)).sort((a, b) => byTime(b.created_at, a.created_at)).map((a) => annWire(c, a)) }));

  r.delete('/api/announcements/:id', (c) => {
    const a = c.s.announcements.find((x) => x.id === c.p.id);
    if (!a) return bizFail('Announcement not found');
    c.s.announcements = c.s.announcements.filter((x) => x !== a);
    return ok({ message: 'Announcement deleted' });
  });
}

module.exports = { register };
