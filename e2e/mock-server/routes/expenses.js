'use strict';
/** Odometer readings, travel tickets and bills (employee side) plus the admin review endpoints. */
const { fail, bizFail } = require('../lib/http');
const D = require('../domain');
const T = require('../lib/time');

const ok = (extra) => ({ success: true, ...extra });

function readingWire(c, x) {
  const u = D.user(c.s, x.user_id);
  return {
    id: x.readings_id, readings_id: x.readings_id, user_id: x.user_id, org_id: x.org_id, user_name: u ? u.name : x.user_name, reading_date: x.reading_date, start_km: x.start_km, stop_km: x.stop_km,
    distance_km: x.distance_km, status: x.status, start_photo_url: D.abs(c.origin, x.start_photo_url), stop_photo_url: D.abs(c.origin, x.stop_photo_url), allowance_rate: c.s.allowanceRate, created_at: x.created_at, updated_at: x.updated_at || x.created_at,
  };
}

function expenseWire(c, x) {
  const u = D.user(c.s, x.user_id);
  return { ...x, user_name: u ? u.name : x.user_name, photo_url: D.abs(c.origin, x.photo_url), updated_at: x.updated_at || x.created_at };
}

const photoKey = (uid, date, type) => `${uid}|${date}|${type}`;

function register(r) {
  const pp = (c) => (c.s.pendingPhotos = c.s.pendingPhotos || new Map()); // photos uploaded before the km was submitted

  r.get('/expenses/odometer/readings', (c) => {
    let rows = c.s.readings.filter((x) => x.user_id === c.q.user_id);
    if (c.q.reading_date) rows = rows.filter((x) => x.reading_date === c.q.reading_date);
    rows = rows.slice().sort((a, b) => b.reading_date.localeCompare(a.reading_date)).slice(0, 30);
    return ok({ data: rows.map((x) => readingWire(c, x)) });
  });

  r.post('/expenses/odometer/start', (c) => {
    const u = D.user(c.s, c.b.user_id);
    if (!u) fail(404, 'User not found');
    const km = Number(c.b.start_km);
    if (!Number.isFinite(km) || km < 0) fail(400, 'start_km must be a positive number');
    if (c.s.readings.some((x) => x.user_id === u.user_id && x.reading_date === c.b.reading_date && x.start_km !== null)) return bizFail('Start reading already recorded for this date');
    c.s.seq.reading += 1;
    c.s.readings.push({ readings_id: `odo-${c.s.seq.reading}`, user_id: u.user_id, org_id: u.org_id, user_name: u.name, reading_date: c.b.reading_date, start_km: km, stop_km: null, distance_km: null, status: 'pending', start_photo_url: pp(c).get(photoKey(u.user_id, c.b.reading_date, 'start')) || null, stop_photo_url: null, created_at: T.isoNow() });
    return ok({ message: 'Start reading saved' });
  });

  r.post('/expenses/odometer/stop', (c) => {
    const x = c.s.readings.find((y) => y.user_id === c.b.user_id && y.reading_date === c.b.reading_date && y.start_km !== null);
    if (!x) return bizFail('No start reading found for this date');
    const km = Number(c.b.stop_km);
    if (!Number.isFinite(km)) fail(400, 'stop_km must be a number');
    if (km < x.start_km) return bizFail('Stop reading cannot be less than the start reading');
    x.stop_km = km;
    x.distance_km = km - x.start_km;
    x.stop_photo_url = pp(c).get(photoKey(x.user_id, x.reading_date, 'stop')) || x.stop_photo_url;
    x.updated_at = T.isoNow();
    return ok({ message: 'Stop reading saved', distance: x.distance_km });
  });

  r.post('/expenses/odometer/upload-photo', (c) => {
    if (!c.files.some((f) => f.field === 'file')) fail(422, 'file is required');
    const type = c.q.photo_type === 'stop' ? 'stop' : 'start';
    const url = `/files/odometer/${c.q.user_id}-${c.q.reading_date}-${type}.png`;
    pp(c).set(photoKey(c.q.user_id, c.q.reading_date, type), url);
    const x = c.s.readings.find((y) => y.user_id === c.q.user_id && y.reading_date === c.q.reading_date);
    if (x) x[`${type}_photo_url`] = url;
    return ok({ message: 'Photo uploaded', photo_url: D.abs(c.origin, url) });
  });

  r.post('/expenses/travel-bill/submit', (c) => {
    const u = D.user(c.s, c.b.user_id);
    if (!u) fail(404, 'User not found');
    const amount = Number(c.b.amount);
    if (!Number.isFinite(amount) || amount <= 0) return bizFail('Amount must be greater than 0');
    const type = String(c.b.expense_type || '').toUpperCase() === 'BILL' ? 'BILL' : 'TRAVEL';
    c.s.seq.expense += 1;
    const id = `exp-${c.s.seq.expense}`;
    c.s.expenses.push({ expense_id: id, id, user_id: u.user_id, org_id: u.org_id, user_name: u.name, expense_date: c.b.expense_date, expense_type: type, amount, status: 'pending', photo_url: null, created_at: T.isoNow() });
    return ok({ message: 'Expense submitted successfully', expense_id: id });
  });

  r.post('/expenses/travel-bill/upload-photo', (c) => {
    const x = c.s.expenses.find((y) => y.expense_id === c.q.expense_id && y.user_id === c.q.user_id);
    if (!x) return bizFail('Expense not found');
    if (!c.files.some((f) => f.field === 'file')) fail(422, 'file is required');
    x.photo_url = `/files/expense/${x.expense_id}.png`;
    return ok({ message: 'Photo uploaded', photo_url: D.abs(c.origin, x.photo_url) });
  });

  r.get('/expenses/travel-bill/expenses', (c) => {
    let rows = c.s.expenses.filter((x) => x.user_id === c.q.user_id);
    if (c.q.expense_type) rows = rows.filter((x) => x.expense_type === String(c.q.expense_type).toUpperCase());
    if (c.q.expense_date) rows = rows.filter((x) => x.expense_date === c.q.expense_date);
    rows = rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30);
    return ok({ data: rows.map((x) => expenseWire(c, x)) });
  });

  // ── admin ──────────────────────────────────────────────────────────────────────────────────────
  r.get('/expenses/admin/odometer-readings/:org', (c) => {
    const orgId = D.resolveOrg(c.s, c.p.org);
    return ok({ data: c.s.readings.filter((x) => x.org_id === orgId).slice().sort((a, b) => b.reading_date.localeCompare(a.reading_date)).map((x) => readingWire(c, x)) });
  });

  r.put('/expenses/admin/odometer-readings/:id/status', (c) => {
    const x = c.s.readings.find((y) => y.readings_id === c.p.id);
    if (!x) return bizFail('Reading not found');
    if (!['approved', 'rejected'].includes(c.b.status)) fail(400, 'status must be approved or rejected');
    x.status = c.b.status;
    x.updated_at = T.isoNow();
    return ok({ message: `Reading ${c.b.status}` });
  });

  r.get('/expenses/admin/travel-bill/:org', (c) => {
    const orgId = D.resolveOrg(c.s, c.p.org);
    let rows = c.s.expenses.filter((x) => x.org_id === orgId);
    if (c.q.expense_type) rows = rows.filter((x) => x.expense_type === String(c.q.expense_type).toUpperCase());
    return ok({ data: rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map((x) => expenseWire(c, x)) });
  });

  r.put('/expenses/admin/travel-bill/:id/status', (c) => {
    const x = c.s.expenses.find((y) => y.expense_id === c.p.id);
    if (!x) return bizFail('Expense not found');
    if (!['approved', 'rejected'].includes(c.b.status)) fail(400, 'status must be approved or rejected');
    x.status = c.b.status;
    x.updated_at = T.isoNow();
    return ok({ message: `Expense ${c.b.status}` });
  });

  r.get('/expenses/admin/allowance-rate/:org', (c) => ok({ rate: c.s.allowanceRate }));
  r.post('/expenses/admin/allowance-rate', (c) => {
    const rate = Number(c.b.rate);
    if (!Number.isInteger(rate) || rate < 1) return bizFail('Rate must be a whole number of at least 1');
    c.s.allowanceRate = rate;
    return ok({ message: 'Allowance rate saved' });
  });
}

module.exports = { register };
