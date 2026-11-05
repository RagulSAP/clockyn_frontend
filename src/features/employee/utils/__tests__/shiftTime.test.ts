import {
  calcRemaining,
  calcWorkingHours,
  fmtMins,
  istSecondsOfDay,
  progressTone,
  remainDisplay,
  sessionSeconds,
  shiftTotalSeconds,
  toClock,
  workedSeconds,
} from '../shiftTime';

const hms = (h: number, m = 0, s = 0) => h * 3600 + m * 60 + s;

describe('istSecondsOfDay', () => {
  it('converts an instant to IST seconds of the day, whatever the device zone', () => {
    // 07:00 UTC = 12:30 IST
    expect(istSecondsOfDay(Date.UTC(2026, 9, 18, 7, 0, 0))).toBe(hms(12, 30));
    // 19:00 UTC = 00:30 IST next day
    expect(istSecondsOfDay(Date.UTC(2026, 9, 18, 19, 0, 0))).toBe(hms(0, 30));
  });
});

describe('toClock / fmtMins', () => {
  it('zero-pads and lets hours exceed two digits', () => {
    expect(toClock(hms(5, 30))).toEqual({ hh: '05', mm: '30', ss: '00' });
    expect(toClock(hms(100, 1, 1))).toEqual({ hh: '100', mm: '01', ss: '01' });
    expect(toClock(-61)).toEqual({ hh: '00', mm: '01', ss: '01' });
  });
  it('formats minutes as h:mm hrs and clamps invalid values to 0', () => {
    expect(fmtMins(185)).toBe('3:05 hrs');
    expect(fmtMins(-5)).toBe('0:00 hrs');
    expect(fmtMins(Number.NaN)).toBe('0:00 hrs');
  });
});

describe('shiftTotalSeconds', () => {
  it('rolls an earlier end over to the next day and treats a 00:00 end consistently', () => {
    expect(shiftTotalSeconds('09:00', '18:00')).toBe(hms(9));
    expect(shiftTotalSeconds('22:00', '06:00')).toBe(hms(8));
    expect(shiftTotalSeconds('18:00', '00:00')).toBe(hms(6));
    expect(shiftTotalSeconds('09:00', '09:00')).toBe(hms(24));
  });
  it('returns null for a missing, invalid or zero-length shift', () => {
    expect(shiftTotalSeconds(undefined, '18:00')).toBeNull();
    expect(shiftTotalSeconds('bad', '18:00')).toBeNull();
    expect(shiftTotalSeconds('00:00', '00:00')).toBeNull();
  });
});

describe('sessionSeconds / workedSeconds', () => {
  it('measures a closed session', () => {
    expect(sessionSeconds('09:00', '13:00', false, 0)).toBe(hms(4));
  });
  it('keeps the real length of a session that crosses midnight (v1 clamped it to 0)', () => {
    expect(sessionSeconds('22:00', '02:00', false, 0)).toBe(hms(4));
    // still open at 01:00 IST the next day
    expect(sessionSeconds('22:00', undefined, true, hms(1))).toBe(hms(3));
  });
  it('treats a tiny negative open duration (clock skew) as zero, not 24 h', () => {
    expect(sessionSeconds('12:05', undefined, true, hms(12, 2))).toBe(0);
  });
  it('counts nothing for an unclosed session of someone who is not punched in', () => {
    expect(sessionSeconds('09:00', undefined, false, hms(12))).toBe(0);
  });
  it('sums two sessions (09:00-13:00 and 14:00-open at 16:00 = 6 h)', () => {
    const worked = workedSeconds({
      sessions: [
        { punchIn: '09:00', punchOut: '13:00' },
        { punchIn: '14:00', punchOut: undefined },
      ],
      isPunchedIn: true,
      nowS: hms(16),
    });
    expect(worked).toBe(hms(6));
  });
  it('falls back to the first-in / last-out pair without sessions', () => {
    expect(workedSeconds({ punchIn: '09:00', punchOut: '10:30', sessions: [], isPunchedIn: false, nowS: 0 })).toBe(hms(1, 30));
    expect(workedSeconds({ sessions: [], isPunchedIn: false, nowS: 0 })).toBe(0);
  });
});

describe('calcRemaining', () => {
  const base = { shiftStart: '09:00', shiftEnd: '18:00', isDone: false, isPunchedIn: false, sessions: [] as { punchIn?: string; punchOut?: string }[], nowS: 0 };

  it('is idle with -- parts when there is no shift', () => {
    const r = calcRemaining({ ...base, shiftStart: undefined, shiftEnd: undefined });
    expect(r).toMatchObject({ state: 'idle', hh: '--', mm: '--', ss: '--' });
  });

  it('shows the total shift length before the first punch', () => {
    expect(calcRemaining(base)).toMatchObject({ state: 'idle', hh: '09', mm: '00', ss: '00' });
  });

  it('counts down: punched in 09:00, now 12:30 -> 05:30:00 working', () => {
    const r = calcRemaining({ ...base, punchIn: '09:00', isPunchedIn: true, sessions: [{ punchIn: '09:00' }], nowS: hms(12, 30) });
    expect(r).toMatchObject({ state: 'working', hh: '05', mm: '30', ss: '00' });
  });

  it('turns into overtime: now 18:10 still punched in -> +00:10:00', () => {
    const r = calcRemaining({ ...base, punchIn: '09:00', isPunchedIn: true, sessions: [{ punchIn: '09:00' }], nowS: hms(18, 10) });
    expect(r).toMatchObject({ state: 'overtime', hh: '00', mm: '10', ss: '00' });
    expect(remainDisplay(r)).toMatchObject({ title: 'OVERTIME', prefix: '+', tone: 'warning' });
  });

  it('exactly zero remaining is overtime +00:00:00 (v1 rule)', () => {
    const r = calcRemaining({ ...base, punchIn: '09:00', isPunchedIn: true, sessions: [{ punchIn: '09:00' }], nowS: hms(18) });
    expect(r.state).toBe('overtime');
  });

  it('handles a night shift 22:00-06:00 across midnight (no clamp)', () => {
    const r = calcRemaining({
      shiftStart: '22:00',
      shiftEnd: '06:00',
      punchIn: '22:00',
      isDone: false,
      isPunchedIn: true,
      sessions: [{ punchIn: '22:00' }],
      nowS: hms(1),
    });
    expect(r).toMatchObject({ state: 'working', hh: '05', mm: '00', ss: '00' });
  });

  it('handles a 00:00 shift end like any other overnight end', () => {
    const r = calcRemaining({ shiftStart: '18:00', shiftEnd: '00:00', punchIn: '18:00', isDone: false, isPunchedIn: true, sessions: [{ punchIn: '18:00' }], nowS: hms(20) });
    expect(r).toMatchObject({ state: 'working', hh: '04', mm: '00', ss: '00' });
  });

  it('done: shows the remaining time, or "SHIFT COMPLETE" when it reads 00:00:00', () => {
    const partial = calcRemaining({ ...base, punchIn: '09:00', punchOut: '13:00', isDone: true, sessions: [{ punchIn: '09:00', punchOut: '13:00' }] });
    expect(partial).toMatchObject({ state: 'done', hh: '05', mm: '00', ss: '00', shiftComplete: false });
    expect(remainDisplay(partial)).toMatchObject({ title: 'SHIFT DURATION', label: 'Time Remaining', tone: 'success' });

    const full = calcRemaining({ ...base, punchIn: '09:00', punchOut: '18:00', isDone: true, sessions: [{ punchIn: '09:00', punchOut: '18:00' }] });
    expect(full.shiftComplete).toBe(true);
    expect(remainDisplay(full)).toMatchObject({ title: 'SHIFT COMPLETE', tone: 'success' });
  });

  it('uses every session: 4 h closed + 2 h open leaves 3 h of a 9 h shift', () => {
    const r = calcRemaining({
      ...base,
      punchIn: '09:00',
      isPunchedIn: true,
      sessions: [
        { punchIn: '09:00', punchOut: '13:00' },
        { punchIn: '14:00' },
      ],
      nowS: hms(16),
    });
    expect(r).toMatchObject({ state: 'working', hh: '03', mm: '00', ss: '00' });
  });

  it('maps every state to its copy', () => {
    expect(remainDisplay({ state: 'idle', hh: '09', mm: '00', ss: '00', shiftComplete: false })).toEqual({ title: 'SHIFT DURATION', label: 'Total Shift Time', tone: 'neutral', prefix: '' });
    expect(remainDisplay({ state: 'working', hh: '05', mm: '30', ss: '00', shiftComplete: false })).toEqual({ title: 'REMAINING TIME', label: 'Time Remaining', tone: 'info', prefix: '' });
  });
});

describe('calcWorkingHours / progressTone', () => {
  const base = { shiftStart: '09:00', shiftEnd: '18:00', isPunchedIn: true, punchIn: '09:00', sessions: [{ punchIn: '09:00' }] };

  it('reports 3:30 hrs / 9:00 hrs at 12:30 (~39 %, amber)', () => {
    const w = calcWorkingHours({ ...base, nowS: hms(12, 30) });
    expect(w.label).toBe('3:30 hrs');
    expect(w.totalLabel).toBe('9:00 hrs');
    expect(Math.round(w.pct * 100)).toBe(39);
    expect(progressTone(w.pct)).toBe('warning');
  });

  it('caps at 100 % (green) once the shift is worked', () => {
    const w = calcWorkingHours({ ...base, nowS: hms(18, 10) });
    expect(w.pct).toBe(1);
    expect(progressTone(w.pct)).toBe('success');
  });

  it('is blue from 50 %', () => {
    expect(progressTone(0.5)).toBe('info');
    expect(progressTone(0.49)).toBe('warning');
  });

  it('shows -- before the first punch and for a missing shift total', () => {
    expect(calcWorkingHours({ ...base, punchIn: undefined, sessions: [], isPunchedIn: false, nowS: hms(12) })).toMatchObject({ label: '--', pct: 0, totalLabel: '9:00 hrs' });
    expect(calcWorkingHours({ ...base, shiftStart: undefined, shiftEnd: undefined, nowS: hms(12) })).toMatchObject({ totalLabel: '--', pct: 0 });
  });

  it('uses the same shift length for a 00:00 end (v1 returned -- here)', () => {
    const w = calcWorkingHours({ shiftStart: '18:00', shiftEnd: '00:00', isPunchedIn: true, punchIn: '18:00', sessions: [{ punchIn: '18:00' }], nowS: hms(21) });
    expect(w.totalLabel).toBe('6:00 hrs');
    expect(w.label).toBe('3:00 hrs');
  });
});
