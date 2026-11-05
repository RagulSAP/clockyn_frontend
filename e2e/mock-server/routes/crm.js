'use strict';
/** CRM: leads, categories, assignment, work/pipeline status and carry-forward requests (`/api/leads/*`). */
const { fail, bizFail } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');

const ok = (extra) => ({ success: true, ...extra });
const PIPELINE = ['new', 'contacted', 'interested', 'converted', 'not_interested'];
const WORK = ['pending', 'working', 'completed', 'carry_forward'];

function leadWire(l) {
  const { org_id: _org, ...rest } = l;
  return rest;
}

function findLead(c, id) {
  const l = c.s.leads.find((x) => x.leads_id === id);
  if (!l) fail(404, 'Lead not found');
  return l;
}

function assignTo(c, lead, userId, opts = {}) {
  const u = D.user(c.s, userId);
  if (!u) fail(404, 'Employee not found');
  lead.assigned_user_id = u.user_id;
  lead.assigned_user_name = u.name;
  lead.assigned_at = T.isoNow();
  lead.work_status = lead.work_status && opts.keepStatus ? lead.work_status : 'pending';
  if (opts.requestDate) lead.created_date = opts.requestDate;
  if (opts.remarks) lead.remarks = opts.remarks;
  if (!lead.created_date) lead.created_date = T.today();
}

const cfrWire = (x) => ({ request_id: x.request_id, leads_id: x.leads_id, user_id: x.user_id, employee_name: x.employee_name, description: x.description, request_date: x.request_date, status: x.status, created_at: x.created_at, client_name: x.client_name, lead_date: x.lead_date });

function register(r) {
  r.get('/api/leads/categories/:org', (c) => ok({ data: c.s.categories.filter((x) => x.org_id === D.resolveOrg(c.s, c.p.org)).map(({ category_id, category_name }) => ({ category_id, category_name })) }));

  r.post('/api/leads/categories', (c) => {
    const name = String(c.q.category_name || '').trim();
    if (!name) return bizFail('Category name is required');
    const orgId = D.resolveOrg(c.s, c.q.org_id);
    if (c.s.categories.some((x) => x.org_id === orgId && x.category_name.toLowerCase() === name.toLowerCase())) return bizFail('Category already exists');
    c.s.seq.category += 1;
    const row = { category_id: `cat-${c.s.seq.category}`, category_name: name, org_id: orgId };
    c.s.categories.push(row);
    return ok({ message: 'Category added', category_id: row.category_id });
  });

  r.delete('/api/leads/categories/:id', (c) => {
    const row = c.s.categories.find((x) => x.category_id === c.p.id);
    if (!row) return bizFail('Category not found');
    c.s.categories = c.s.categories.filter((x) => x !== row);
    return ok({ message: 'Category deleted' });
  });

  r.get('/api/leads/employee/:org/:uid', (c) => {
    D.requireFeature(c.s, 'crm');
    const today = T.today();
    return ok({ data: c.s.leads.filter((l) => l.assigned_user_id === c.p.uid && (!l.created_date || l.created_date === today)).map(leadWire) });
  });

  r.get('/api/leads/carry-forward/requests/:org', (c) => ok({ data: c.s.carryForward.map(cfrWire) }));

  r.get('/api/leads/carry-forward/my/:org/:uid', (c) =>
    ok({
      data: c.s.carryForward.filter((x) => x.user_id === c.p.uid).map((x) => {
        const lead = c.s.leads.find((l) => l.leads_id === x.leads_id) || {};
        return { request_id: x.request_id, leads_id: x.leads_id, description: x.description, request_date: x.created_at, status: x.status, actioned_at: x.actioned_at, client_name: x.client_name, forwarded_date: x.request_date, mobile_number: lead.mobile_number || '', client_address: lead.client_address || '', category_name: lead.category_name || '', work_status: lead.work_status || null };
      }),
    }),
  );

  r.post('/api/leads/carry-forward/request', (c) => {
    const lead = c.s.leads.find((x) => x.leads_id === c.q.leads_id);
    if (!lead) return bizFail('Lead not found');
    const u = D.user(c.s, c.q.user_id);
    if (!u) return bizFail('Employee not found');
    if (!String(c.q.description || '').trim()) return bizFail('Description is required');
    c.s.seq.cfr += 1;
    const row = { request_id: `cfr-${c.s.seq.cfr}`, leads_id: lead.leads_id, user_id: u.user_id, employee_name: u.name, description: String(c.q.description).trim(), request_date: c.q.forward_date || T.addDays(T.today(), 1), status: 'pending', created_at: T.isoNow(), client_name: lead.client_name, lead_date: lead.created_date, actioned_at: null };
    c.s.carryForward.unshift(row);
    return ok({ message: 'Carry forward request submitted', request_id: row.request_id });
  });

  r.put('/api/leads/carry-forward/:rid/action', (c) => {
    const x = c.s.carryForward.find((y) => y.request_id === c.p.rid);
    if (!x) return bizFail('Request not found');
    if (!['approved', 'rejected'].includes(c.q.action)) return bizFail('Invalid action');
    x.status = c.q.action;
    x.actioned_at = T.isoNow();
    if (c.q.action === 'approved') {
      const lead = c.s.leads.find((l) => l.leads_id === x.leads_id);
      if (lead) { lead.created_date = x.request_date; lead.work_status = 'pending'; }
    }
    return ok({ message: `Request ${c.q.action}` });
  });

  r.post('/api/leads/create', (c) => {
    D.requireFeature(c.s, 'crm');
    const b = c.b;
    if (!String(b.name || '').trim()) return bizFail('Client name is required');
    if (!/^\d{10}$/.test(String(b.mobile || '').trim())) return bizFail('Enter a valid 10-digit mobile number');
    c.s.seq.lead += 1;
    const id = `lead-${c.s.seq.lead}`;
    c.s.leads.push({ leads_id: id, org_id: D.resolveOrg(c.s, b.org_id), client_name: String(b.name).trim(), mobile_number: String(b.mobile).trim(), client_address: b.address || '', category_name: b.category || 'General', remarks: b.remarks || '', created_date: b.required_date || null, created_at: T.isoNow(), assigned_user_id: null, assigned_user_name: null, work_status: null, assigned_at: null, lead_status: 'new' });
    return ok({ message: 'Lead saved successfully', leads_id: id });
  });

  r.post('/api/leads/assign', (c) => {
    D.requireFeature(c.s, 'crm');
    const lead = c.s.leads.find((x) => x.leads_id === c.q.leads_id);
    if (!lead) return bizFail('Lead not found');
    if (lead.assigned_user_id) return bizFail('Lead is already assigned');
    assignTo(c, lead, c.q.user_id, { requestDate: c.q.request_date, remarks: c.q.remarks });
    return ok({ message: 'Lead assigned successfully' });
  });

  r.put('/api/leads/assignment/:id', (c) => {
    const lead = findLead(c, c.p.id);
    assignTo(c, lead, c.q.user_id);
    return ok({ message: 'Lead reassigned successfully' });
  });

  r.put('/api/leads/:id/work-status', (c) => {
    const lead = findLead(c, c.p.id);
    if (!WORK.includes(String(c.q.work_status).replace(/\s+/g, '_').toLowerCase())) return bizFail('Invalid work status');
    lead.work_status = String(c.q.work_status).replace(/\s+/g, '_').toLowerCase();
    return ok({ message: 'Status updated' });
  });

  r.put('/api/leads/:id/status', (c) => {
    const lead = findLead(c, c.p.id);
    if (!PIPELINE.includes(c.q.status)) return bizFail('Invalid lead status');
    lead.lead_status = c.q.status;
    return ok({ message: 'Lead status updated' });
  });

  r.put('/api/leads/:id', (c) => {
    const lead = findLead(c, c.p.id);
    const b = c.b;
    if (b.name !== undefined) lead.client_name = String(b.name).trim();
    if (b.mobile !== undefined) lead.mobile_number = String(b.mobile).trim();
    if (b.address !== undefined) lead.client_address = b.address;
    if (b.category !== undefined) lead.category_name = b.category;
    if (b.remarks !== undefined) lead.remarks = b.remarks;
    if (b.required_date !== undefined) lead.created_date = b.required_date;
    return ok({ message: 'Lead updated successfully' });
  });

  r.delete('/api/leads/:id', (c) => {
    const lead = findLead(c, c.p.id);
    c.s.leads = c.s.leads.filter((x) => x !== lead);
    return ok({ message: 'Lead deleted successfully' });
  });

  r.get('/api/leads/:org', (c) => {
    D.requireFeature(c.s, 'crm');
    const rows = c.s.leads.filter((l) => l.org_id === D.resolveOrg(c.s, c.p.org)).map(leadWire);
    // Test hook (state flag `dupLeadRows` = { leadId: otherUserId }): like the real backend's SELECT DISTINCT, emit one extra
    // row per (lead x assignment) for multi-assignee leads.
    const dup = c.s.flags.dupLeadRows || {};
    for (const [leadId, uid] of Object.entries(dup)) {
      const base = rows.find((x) => x.leads_id === leadId);
      const u = D.user(c.s, uid);
      if (base && u) rows.push({ ...base, assigned_user_id: u.user_id, assigned_user_name: u.name });
    }
    return ok({ data: rows });
  });
}

module.exports = { register };
