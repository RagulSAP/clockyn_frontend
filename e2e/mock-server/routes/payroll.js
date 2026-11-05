'use strict';
/** Payroll set-up: payslip templates, daily wages / hourly charges, wage assignment and the four incentive families. */
const { bizFail } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');

const ok = (extra) => ({ success: true, ...extra });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const sum = (items) => (items || []).reduce((a, i) => a + (Number(i.amount) || 0), 0);

function totals(p) {
  const earnings = p.basic_pay + p.hra + sum(p.custom_earnings);
  const deductions = p.epf + p.professional_tax + p.health_insurance + sum(p.custom_deductions);
  return { total_earnings: earnings, total_deductions: deductions, net_salary: earnings - deductions };
}

function payslipWire(c, p) {
  return { ...p, ...totals(p), assigned_count: Object.values(c.s.payslipAssign).filter((x) => x === p.pay_slip_id).length };
}

function payslipFromBody(b, base) {
  const items = (l) => (Array.isArray(l) ? l.filter((i) => i && String(i.name || '').trim()).map((i) => ({ name: String(i.name).trim(), amount: Number(i.amount) || 0 })) : []);
  return { ...base, payslip_name: String(b.payslip_name || (base && base.payslip_name) || '').trim(), basic_pay: Number(b.basic_pay) || 0, hra: Number(b.hra) || 0, epf: Number(b.epf) || 0, professional_tax: Number(b.professional_tax) || 0, health_insurance: Number(b.health_insurance) || 0, custom_earnings: items(b.custom_earnings), custom_deductions: items(b.custom_deductions) };
}

const personRow = (c, u) => ({ user_id: u.user_id, name: u.name, emp_id: u.emp_id, branch_name: (D.branch(c.s, u.branch_id) || {}).branch_name || '', dept_name: (D.dept(c.s, u.dept_id) || {}).dept_name || '' });

function registerSalary(r) {
  r.get('/api/salary/templates/:org', (c) => {
    D.requireFeature(c.s, 'salary_structure');
    return ok({ data: c.s.payslips.filter((p) => p.org_id === D.resolveOrg(c.s, c.p.org)).map((p) => payslipWire(c, p)) });
  });

  r.post('/api/salary/template', (c) => {
    D.requireFeature(c.s, 'salary_structure');
    if (!String(c.b.payslip_name || '').trim()) return bizFail('Template name is required');
    const orgId = D.resolveOrg(c.s, c.b.org_id);
    if (c.s.payslips.some((p) => p.org_id === orgId && p.payslip_name.toLowerCase() === String(c.b.payslip_name).trim().toLowerCase())) return bizFail('A template with this name already exists');
    c.s.seq.payslip += 1;
    const p = payslipFromBody(c.b, { pay_slip_id: `ps-${c.s.seq.payslip}`, org_id: orgId, created_at: T.isoNow() });
    c.s.payslips.push(p);
    return ok({ message: 'Payslip template saved successfully', pay_slip_id: p.pay_slip_id, updated_templates: c.s.payslips.filter((x) => x.org_id === orgId).map((x) => payslipWire(c, x)) });
  });

  r.get('/api/salary/template/:id', (c) => {
    const p = c.s.payslips.find((x) => x.pay_slip_id === c.p.id);
    if (!p) return bizFail('Template not found');
    return ok({ data: payslipWire(c, p) });
  });

  r.put('/api/salary/template/:id', (c) => {
    const i = c.s.payslips.findIndex((x) => x.pay_slip_id === c.p.id);
    if (i < 0) return bizFail('Template not found');
    c.s.payslips[i] = payslipFromBody(c.b, c.s.payslips[i]);
    return ok({ message: 'Payslip template updated successfully', pay_slip_id: c.p.id, updated_templates: c.s.payslips.map((x) => payslipWire(c, x)) });
  });

  r.delete('/api/salary/template/:id', (c) => {
    const p = c.s.payslips.find((x) => x.pay_slip_id === c.p.id);
    if (!p) return bizFail('Template not found');
    c.s.payslips = c.s.payslips.filter((x) => x !== p);
    for (const [uid, id] of Object.entries(c.s.payslipAssign)) if (id === p.pay_slip_id) delete c.s.payslipAssign[uid];
    return ok({ message: 'Payslip template deleted successfully' });
  });

  r.get('/api/salary/branches/:org', (c) => c.s.branches.filter((b) => b.org_id === D.resolveOrg(c.s, c.p.org)).map((b) => ({ branch_id: b.branch_id, branch_name: b.branch_name })));
  r.get('/api/salary/departments/:org', (c) => c.s.departments.filter((d) => d.org_id === D.resolveOrg(c.s, c.p.org)).map((d) => ({ department_id: d.dept_id, department_name: d.dept_name })));

  r.get('/api/salary/staff/:org', (c) => {
    const orgId = D.resolveOrg(c.s, c.p.org);
    const rows = D.activeStaff(c.s, orgId, { branchId: c.q.branch_id, deptId: c.q.department_id }).map((u) => ({
      staff_id: u.user_id, staff_name: u.name, emp_id: u.emp_id, branch_name: (D.branch(c.s, u.branch_id) || {}).branch_name || '', department_name: (D.dept(c.s, u.dept_id) || {}).dept_name || '',
      is_assigned: !!c.q.pay_slip_id && c.s.payslipAssign[u.user_id] === c.q.pay_slip_id,
    }));
    return ok({ data: rows });
  });

  r.post('/api/salary/assign', (c) => {
    const u = D.user(c.s, c.b.staff_id);
    const p = c.s.payslips.find((x) => x.pay_slip_id === c.b.pay_slip_id);
    if (!u || !p) return bizFail('Staff or template not found');
    const existing = c.s.payslipAssign[u.user_id];
    if (existing && existing !== p.pay_slip_id) {
      const other = c.s.payslips.find((x) => x.pay_slip_id === existing);
      return bizFail(`${u.name} already has a payslip assigned`, { payslip_name: other ? other.payslip_name : '' });
    }
    c.s.payslipAssign[u.user_id] = p.pay_slip_id;
    return ok({ message: 'Payslip assigned successfully' });
  });

  r.get('/api/salary/employee/:org/:staff', (c) => {
    const id = c.s.payslipAssign[c.p.staff];
    return id ? ok({ pay_slip_id: id }) : bizFail('No payslip assigned');
  });

  r.get('/api/salary/preview/:org/:staff/:ps', (c) => {
    const u = D.user(c.s, c.p.staff);
    const p = c.s.payslips.find((x) => x.pay_slip_id === c.p.ps);
    if (!u || !p) return bizFail('Payslip not found');
    const t = totals(p);
    const now = T.ist();
    return ok({
      org_name: (D.org(c.s, u.org_id) || {}).org_name || '', payslip_name: p.payslip_name, month: MONTHS[now.month - 1], year: now.year, staff_name: u.name, emp_id: u.emp_id,
      department: (D.dept(c.s, u.dept_id) || {}).dept_name || '', branch: (D.branch(c.s, u.branch_id) || {}).branch_name || '', account_number: u.acc_no, ifsc_code: u.ifsc_code,
      earnings: [{ name: 'Basic Pay', amount: p.basic_pay }, { name: 'HRA', amount: p.hra }, ...p.custom_earnings], total_earnings: t.total_earnings,
      deductions: [{ name: 'EPF', amount: p.epf }, { name: 'Professional Tax', amount: p.professional_tax }, { name: 'Health Insurance', amount: p.health_insurance }, ...p.custom_deductions], total_deductions: t.total_deductions, net_pay: t.net_salary,
    });
  });
}

function registerWages(r) {
  const kinds = [['/api/daily-wages', 'daily', 'dw'], ['/api/hourly-charges', 'hourly', 'hc']];
  for (const [base, kind, prefix] of kinds) {
    const wire = (c, w) => ({ id: w.id, template_name: null, amount: w.amount, assigned_count: (c.s.wageAssign[w.id] || []).length });
    r.get(`${base}/templates/:org`, (c) => ok({ data: c.s.wageTemplates.filter((w) => w.kind === kind).map((w) => wire(c, w)) }));
    r.post(`${base}/template`, (c) => {
      const amount = Number(c.b.amount);
      if (!Number.isFinite(amount) || amount <= 0) return bizFail('Amount must be greater than 0');
      if (c.s.wageTemplates.some((w) => w.kind === kind && w.amount === amount)) return bizFail('A template with this amount already exists');
      c.s.seq.wage += 1;
      const w = { id: `${prefix}-${c.s.seq.wage}`, kind, amount };
      c.s.wageTemplates.push(w);
      c.s.wageAssign[w.id] = [];
      return ok({ message: 'Template saved successfully', id: w.id });
    });
    r.put(`${base}/template/:id`, (c) => {
      const w = c.s.wageTemplates.find((x) => x.id === c.p.id && x.kind === kind);
      if (!w) return bizFail('Template not found');
      const amount = Number(c.b.amount);
      if (!Number.isFinite(amount) || amount <= 0) return bizFail('Amount must be greater than 0');
      w.amount = amount;
      return ok({ message: 'Template updated successfully' });
    });
    r.delete(`${base}/template/:id`, (c) => {
      const w = c.s.wageTemplates.find((x) => x.id === c.p.id && x.kind === kind);
      if (!w) return bizFail('Template not found');
      c.s.wageTemplates = c.s.wageTemplates.filter((x) => x !== w);
      delete c.s.wageAssign[w.id];
      return ok({ message: 'Template deleted successfully' });
    });
  }

  const assignedTo = (c, id) => c.s.wageAssign[id] || [];
  const kindOf = (c, id) => (c.s.wageTemplates.find((w) => w.id === id) || {}).kind;
  r.get('/api/wages/assigned/:org/:tid', (c) => ok({ data: assignedTo(c, c.p.tid).map((id) => D.user(c.s, id)).filter((u) => u && u.status === 1).map((u) => personRow(c, u)) }));
  r.get('/api/wages/unassigned/:org/:tid', (c) => {
    const kind = kindOf(c, c.p.tid);
    const taken = new Set(c.s.wageTemplates.filter((w) => w.kind === kind).flatMap((w) => assignedTo(c, w.id)));
    return ok({ data: D.activeStaff(c.s, D.resolveOrg(c.s, c.p.org)).filter((u) => !taken.has(u.user_id)).map((u) => personRow(c, u)) });
  });
  r.post('/api/wages/assign', (c) => {
    const kind = kindOf(c, c.b.temp_id);
    if (!kind) return bizFail('Template not found');
    const ids = Array.isArray(c.b.user_ids) ? c.b.user_ids : [];
    for (const w of c.s.wageTemplates.filter((x) => x.kind === kind)) c.s.wageAssign[w.id] = assignedTo(c, w.id).filter((id) => !ids.includes(id));
    c.s.wageAssign[c.b.temp_id] = [...assignedTo(c, c.b.temp_id), ...ids];
    return ok({ message: 'Staff assigned successfully' });
  });
  r.delete('/api/wages/unassign/:org/:uid/:tid', (c) => {
    c.s.wageAssign[c.p.tid] = assignedTo(c, c.p.tid).filter((id) => id !== c.p.uid);
    return ok({ message: 'Staff unassigned successfully' });
  });
}

function registerIncentives(r) {
  const wire = (c, x) => {
    const base = { incentive_id: x.incentive_id, template_name: x.template_name, assigned_count: (c.s.incentiveAssign[x.incentive_id] || []).length, created_at: x.created_at };
    switch (x.kind) {
      case 'count': return { ...base, count_upto_basic_salary: x.count_upto_basic_salary, next_count: x.next_count, each_incentive: x.each_incentive };
      case 'turnover': return { ...base, turnover_upto_basic_salary: x.turnover_upto_basic_salary, after_target_incentive_percent: x.after_target_incentive_percent };
      case 'overtime': return { ...base, duration_minutes: x.duration_minutes, amount: x.amount };
      default: return { ...base, bonus_percent: x.bonus_percent, month: x.month, year: x.year, user_ids: c.s.incentiveAssign[x.incentive_id] || [] };
    }
  };
  const create = (c, kind, fields) => {
    c.s.seq.inc += 1;
    const x = { incentive_id: `inc-${kind[0]}${c.s.seq.inc}`, kind, template_name: String(c.b.template_name || String(c.s.incentives.filter((i) => i.kind === kind).length + 1)), created_at: T.isoNow(), ...fields };
    c.s.incentives.push(x);
    c.s.incentiveAssign[x.incentive_id] = [];
    return ok({ message: 'Incentive saved successfully', incentive_id: x.incentive_id });
  };
  const find = (c, kind, id) => c.s.incentives.find((x) => x.incentive_id === id && x.kind === kind);
  const num = (v) => Number(v);

  for (const kind of ['count', 'turnover', 'overtime', 'bonus']) {
    r.get(`/api/incentive/${kind}/details/:id`, (c) => {
      const x = find(c, kind, c.p.id);
      return x ? ok({ data: [wire(c, x)] }) : bizFail('Incentive not found');
    });
    r.get(`/api/incentive/${kind}/:org`, (c) => ok({ data: c.s.incentives.filter((x) => x.kind === kind).map((x) => wire(c, x)) }));
  }

  r.post('/api/incentive/count', (c) => create(c, 'count', { count_upto_basic_salary: num(c.b.count_upto), next_count: num(c.b.next_count), each_incentive: num(c.b.each_incentive) }));
  r.post('/api/incentive/turnover', (c) => create(c, 'turnover', { turnover_upto_basic_salary: num(c.b.turnover_upto), after_target_incentive_percent: num(c.b.incentive_percent) }));
  r.post('/api/incentive/overtime', (c) => create(c, 'overtime', { duration_minutes: num(c.b.duration_minutes), amount: num(c.b.amount) }));
  r.post('/api/incentive/bonus', (c) => create(c, 'bonus', { bonus_percent: num(c.b.bonus_percent), month: c.b.month, year: num(c.b.year) }));

  r.put('/api/incentive/count/:id', (c) => {
    const x = find(c, 'count', c.p.id);
    if (!x) return bizFail('Incentive not found');
    Object.assign(x, { count_upto_basic_salary: num(c.b.count_upto), next_count: num(c.b.next_count), each_incentive: num(c.b.each_incentive) });
    return ok({ message: 'Incentive updated successfully' });
  });
  r.put('/api/incentive/turnover/:id', (c) => {
    const x = find(c, 'turnover', c.p.id);
    if (!x) return bizFail('Incentive not found');
    Object.assign(x, { turnover_upto_basic_salary: num(c.b.turnover_upto), after_target_incentive_percent: num(c.b.incentive_percent) });
    return ok({ message: 'Incentive updated successfully' });
  });
  r.put('/api/incentive/overtime/:id', (c) => {
    const x = find(c, 'overtime', c.p.id);
    if (!x) return bizFail('Incentive not found');
    Object.assign(x, { duration_minutes: num(c.b.duration_minutes), amount: num(c.b.amount) });
    return ok({ message: 'Incentive updated successfully' });
  });
  r.put('/api/incentive/bonus/:id', (c) => {
    const x = find(c, 'bonus', c.p.id);
    if (!x) return bizFail('Incentive not found');
    x.bonus_percent = num(c.b.bonus_percent);
    if (c.b.month) x.month = c.b.month;
    if (c.b.year) x.year = num(c.b.year);
    return ok({ message: 'Incentive updated successfully' });
  });

  const staffSide = (c, id, assigned) => {
    const x = c.s.incentives.find((i) => i.incentive_id === id);
    if (!x) return bizFail('Incentive not found');
    const mine = c.s.incentiveAssign[id] || [];
    if (assigned) return ok({ data: mine.map((uid) => D.user(c.s, uid)).filter((u) => u && u.status === 1).map((u) => personRow(c, u)) });
    const taken = new Set(c.s.incentives.filter((i) => i.kind === x.kind).flatMap((i) => c.s.incentiveAssign[i.incentive_id] || []));
    return ok({ data: D.activeStaff(c.s, x.org_id || D.resolveOrg(c.s, c.p.org)).filter((u) => !taken.has(u.user_id)).map((u) => personRow(c, u)) });
  };
  r.get('/api/incentive/assigned/:org/:id', (c) => staffSide(c, c.p.id, true));
  r.get('/api/incentive/unassigned/:org/:id', (c) => staffSide(c, c.p.id, false));
  r.get('/api/incentive/unassigned-all/:org', (c) => {
    const taken = new Set(Object.values(c.s.incentiveAssign).flat());
    return ok({ data: D.activeStaff(c.s, D.resolveOrg(c.s, c.p.org)).filter((u) => !taken.has(u.user_id)).map((u) => personRow(c, u)) });
  });

  r.post('/api/incentive/assign', (c) => {
    const x = c.s.incentives.find((i) => i.incentive_id === c.b.incentive_id);
    if (!x) return bizFail('Incentive not found');
    const ids = Array.isArray(c.b.user_ids) ? c.b.user_ids : [];
    for (const i of c.s.incentives.filter((y) => y.kind === x.kind)) c.s.incentiveAssign[i.incentive_id] = (c.s.incentiveAssign[i.incentive_id] || []).filter((id) => !ids.includes(id));
    c.s.incentiveAssign[x.incentive_id] = [...(c.s.incentiveAssign[x.incentive_id] || []), ...ids];
    return ok({ message: 'Staff assigned successfully' });
  });
  r.delete('/api/incentive/unassign/:org/:uid/:id', (c) => {
    c.s.incentiveAssign[c.p.id] = (c.s.incentiveAssign[c.p.id] || []).filter((id) => id !== c.p.uid);
    return ok({ message: 'Staff unassigned successfully' });
  });

  r.delete('/api/incentive/:kind/:id', (c) => {
    const x = find(c, c.p.kind, c.p.id);
    if (!x) return bizFail('Incentive not found');
    c.s.incentives = c.s.incentives.filter((i) => i !== x);
    delete c.s.incentiveAssign[x.incentive_id];
    return ok({ message: 'Incentive deleted successfully' });
  });
}

function register(r) {
  registerSalary(r);
  registerWages(r);
  registerIncentives(r);
}

module.exports = { register };
