'use strict';
/** Reports (PDF bytes, overtime), salary breakdown / monthly paid list / advances. */
const { fail, bizFail, Raw } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');
const { makePdf } = require('../lib/pdf');

const ok = (extra) => ({ success: true, ...extra });

function pdf(name, title, lines) {
  const raw = new Raw(makePdf(title, lines), 'application/pdf', { 'Content-Disposition': `attachment; filename="${name}"` });
  return raw;
}

/** Salary components of one staff member for a month (deterministic, derived from the seeded templates). */
function breakdown(c, u, month, year) {
  const s = c.s;
  const prefix = T.monthPrefix(year, month);
  const present = Object.entries(s.att[u.user_id] || {}).filter(([d, r]) => d.startsWith(prefix) && r.sessions.length).length;
  const payslip = s.payslips.find((p) => p.pay_slip_id === s.payslipAssign[u.user_id]);
  const wage = s.wageTemplates.find((w) => (s.wageAssign[w.id] || []).includes(u.user_id));
  const inc = (kind) => s.incentives.find((i) => i.kind === kind && (s.incentiveAssign[i.incentive_id] || []).includes(u.user_id));
  const net = payslip ? payslip.basic_pay + payslip.hra + payslip.custom_earnings.reduce((a, i) => a + i.amount, 0) - (payslip.epf + payslip.professional_tax + payslip.health_insurance + payslip.custom_deductions.reduce((a, i) => a + i.amount, 0)) : 0;
  const km = s.readings.filter((x) => x.user_id === u.user_id && x.status === 'approved' && x.reading_date.startsWith(prefix)).reduce((a, x) => a + (x.distance_km || 0), 0);
  const ticket = s.expenses.filter((x) => x.user_id === u.user_id && x.status === 'approved' && x.expense_type === 'TRAVEL' && x.expense_date.startsWith(prefix)).reduce((a, x) => a + x.amount, 0);
  const bills = s.expenses.filter((x) => x.user_id === u.user_id && x.status === 'approved' && x.expense_type === 'BILL' && x.expense_date.startsWith(prefix)).reduce((a, x) => a + x.amount, 0);
  const advance = s.advances.filter((a) => a.user_id === u.user_id && a.date.startsWith(prefix)).reduce((a, x) => a + x.advance_amt, 0);
  const countInc = inc('count');
  const turnInc = inc('turnover');
  const otInc = inc('overtime');
  const bonusInc = inc('bonus');
  const basic = payslip ? net : 0;
  const incentiveCount = countInc ? countInc.each_incentive * Math.max(0, 25 - countInc.count_upto_basic_salary) : 0;
  const incentiveTurnover = turnInc ? Math.round(turnInc.after_target_incentive_percent * 1000) : 0;
  const overtime = otInc ? otInc.amount * 2 : 0;
  const bonus = bonusInc ? Math.round((basic * bonusInc.bonus_percent) / 100) : 0;
  const dailyWages = wage && wage.kind === 'daily' ? wage.amount * present : 0;
  const hourlyCalc = wage && wage.kind === 'hourly' ? wage.amount * present * 8 : 0;
  const odometer = km * s.allowanceRate;
  const fine = 0;
  const incentive = incentiveCount + incentiveTurnover;
  const netSalary = basic + incentive + overtime + bonus + odometer + ticket + bills + dailyWages + hourlyCalc - fine - advance;
  return {
    user_id: u.user_id, name: u.name, emp_id: u.emp_id, role_name: D.roleName(u), branch_name: (D.branch(s, u.branch_id) || {}).branch_name || '', salary_type: payslip ? 'Monthly' : wage ? (wage.kind === 'daily' ? 'Daily' : 'Hourly') : 'Not assigned',
    basic_salary: basic, incentive, incentive_count: incentiveCount, incentive_turnover: incentiveTurnover, overtime, bonus, fine, travel_allowance: odometer + ticket, odometer, travel_ticket: ticket, advance, other_bills: bills,
    daily_wages: dailyWages, hourly_calc: hourlyCalc, net_salary: netSalary, profile_photo_url: D.abs(c.origin, u.photo_url),
  };
}

function register(r) {
  const att = (c) => `attendance_${c.p.month}.pdf`;
  r.get('/api/reports/monthly-attendance-all/:org/:month', (c) => pdf(`attendance_all_${c.p.month}.pdf`, `Monthly attendance (all staff) ${c.p.month}`, [`Organisation: ${c.p.org}`, `Staff: ${D.activeStaff(c.s, D.resolveOrg(c.s, c.p.org)).length}`]));
  r.get('/api/reports/monthly-attendance/:uid/:month', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u) fail(404, 'Staff not found');
    return pdf(att(c), `Attendance ${c.p.month}`, [`Employee: ${u.name} (${u.emp_id})`]);
  });
  r.get('/api/reports/manager/:mid/monthly-attendance-all/:month', (c) => pdf(`attendance_all_${c.p.month}.pdf`, `Team attendance ${c.p.month}`, [`Manager: ${c.p.mid}`]));
  r.get('/api/reports/manager/:mid/monthly-attendance/:uid/:month', (c) => {
    const u = D.user(c.s, c.p.uid);
    if (!u) fail(404, 'Staff not found');
    return pdf(att(c), `Attendance ${c.p.month}`, [`Employee: ${u.name} (${u.emp_id})`, `Manager: ${c.p.mid}`]);
  });

  r.get('/api/incentive/overtime-report/:org', (c) => {
    const s = c.s;
    const ids = new Set(s.incentives.filter((i) => i.kind === 'overtime').flatMap((i) => s.incentiveAssign[i.incentive_id] || []));
    const rows = [...ids].map((uid, i) => ({ user_id: uid, ot_days: 3 + i, ot_minutes: 60 * (3 + i) + 15, ot_amount: 150 * (3 + i) }));
    return ok({ data: rows });
  });

  r.get('/api/salary/staff-breakdown', (c) => {
    D.requireFeature(c.s, 'salary_structure');
    const orgId = D.resolveOrg(c.s, c.q.org_id);
    return D.activeStaff(c.s, orgId).map((u) => breakdown(c, u, Number(c.q.month), Number(c.q.year)));
  });

  const paidKey = (m, y) => `${Number(m)}-${Number(y)}`;
  r.get('/salary/monthly-list', (c) => {
    const orgId = D.resolveOrg(c.s, c.q.org_id);
    const paid = c.s.paid[paidKey(c.q.month, c.q.year)] || {};
    return ok({
      data: D.activeStaff(c.s, orgId).map((u) => {
        const b = breakdown(c, u, Number(c.q.month), Number(c.q.year));
        return { user_id: u.user_id, name: u.name, emp_id: u.emp_id, dept_name: (D.dept(c.s, u.dept_id) || {}).dept_name || '', branch_name: b.branch_name, salary_type: b.salary_type, basic_salary: b.basic_salary, net_salary: b.net_salary, paid: !!paid[u.user_id], paid_date: paid[u.user_id] || null };
      }),
    });
  });

  r.post('/salary/mark-paid', (c) => {
    const ids = Array.isArray(c.b.user_ids) ? c.b.user_ids : [];
    if (!ids.length) return bizFail('Select at least one employee');
    const key = paidKey(c.b.month, c.b.year);
    c.s.paid[key] = c.s.paid[key] || {};
    for (const id of ids) c.s.paid[key][id] = T.today();
    return ok({ message: `Salary marked as paid for ${ids.length} employee(s)` });
  });

  const advWire = (c, a) => {
    const u = D.user(c.s, a.user_id) || {};
    return { id: a.id, advance_id: a.id, user_id: a.user_id, employee_name: u.name || '', emp_id: u.emp_id || '', advance_amt: a.advance_amt, date: a.date, created_by: a.created_by, created_by_name: (D.user(c.s, a.created_by) || {}).name || '' };
  };
  r.get('/api/advance/user/:uid/:org', (c) => ok({ data: c.s.advances.filter((a) => a.user_id === c.p.uid).map((a) => advWire(c, a)) }));
  r.get('/api/advance/org/:org', (c) => ok({ data: c.s.advances.filter((a) => a.org_id === D.resolveOrg(c.s, c.p.org)).map((a) => advWire(c, a)) }));
  r.post('/api/advance', (c) => {
    const by = D.user(c.s, c.b.created_by);
    if (!by || by.role_id !== 1) fail(403, 'Only admins can record advances');
    const amt = Number(c.b.advance_amt);
    if (!Number.isFinite(amt) || amt <= 0) return bizFail('Advance amount must be greater than 0');
    if (!D.user(c.s, c.b.user_id)) return bizFail('Staff not found');
    c.s.seq.advance += 1;
    const row = { id: `adv-${c.s.seq.advance}`, org_id: D.resolveOrg(c.s, c.b.org_id), user_id: c.b.user_id, advance_amt: amt, date: c.b.date || T.today(), created_by: by.user_id };
    c.s.advances.push(row);
    return ok({ message: 'Advance recorded successfully', data: advWire(c, row) });
  });
  r.delete('/api/advance/:id/:org', (c) => {
    const a = c.s.advances.find((x) => x.id === c.p.id);
    if (!a) return bizFail('Advance not found');
    c.s.advances = c.s.advances.filter((x) => x !== a);
    return ok({ message: 'Advance deleted successfully' });
  });
}

module.exports = { register };
