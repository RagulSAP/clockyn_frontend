import {
  INTERVAL_TOLERANCE,
  LocationError,
  TRACKING_INTERVAL_MS,
  buildLocationPayload,
  isForbiddenError,
  parsePersistedTracking,
  selectFixesToSend,
  shouldSendFix,
  toLogBody,
  withTimeout,
} from '../locationLogic';

const fix = (t: number, lat = 1, lng = 2) => ({ latitude: lat, longitude: lng, timestamp: t });

describe('tracking interval', () => {
  it('is 20 seconds', () => {
    expect(TRACKING_INTERVAL_MS).toBe(20_000);
  });

  it('always sends the first fix', () => {
    expect(shouldSendFix(null, 1_000)).toBe(true);
  });

  it('waits for one interval (with jitter tolerance)', () => {
    expect(shouldSendFix(0, 5_000)).toBe(false);
    expect(shouldSendFix(0, 20_000 * INTERVAL_TOLERANCE - 1)).toBe(false);
    expect(shouldSendFix(0, 20_000 * INTERVAL_TOLERANCE)).toBe(true);
    expect(shouldSendFix(0, 20_000)).toBe(true);
  });
});

describe('selectFixesToSend', () => {
  it('drops fixes that arrive faster than the cadence (iOS ignores timeInterval)', () => {
    const { toSend, lastSentAt } = selectFixesToSend([fix(0), fix(1_000), fix(2_000), fix(21_000)], null);
    expect(toSend.map((f) => f.timestamp)).toEqual([0, 21_000]);
    expect(lastSentAt).toBe(21_000);
  });

  it('delivers a whole background batch (v1 sent only the first fix)', () => {
    const batch = [fix(0), fix(20_000), fix(40_000), fix(60_000)];
    expect(selectFixesToSend(batch, null).toSend).toHaveLength(4);
  });

  it('orders by time and honours the previous watermark', () => {
    const { toSend } = selectFixesToSend([fix(30_000), fix(10_000)], 5_000);
    expect(toSend.map((f) => f.timestamp)).toEqual([30_000]);
  });

  it('keeps the watermark when nothing qualifies', () => {
    expect(selectFixesToSend([fix(1_000)], 0)).toEqual({ toSend: [], lastSentAt: 0 });
  });
});

describe('buildLocationPayload', () => {
  it('uses the ISO time of the fix and falls back to the user id for org', () => {
    const p = buildLocationPayload('u1', '', fix(Date.UTC(2026, 0, 2, 3, 4, 5), 12.9, 80.2));
    expect(p).toEqual({ userId: 'u1', orgId: 'u1', latitude: 12.9, longitude: 80.2, timestamp: '2026-01-02T03:04:05.000Z' });
  });
  it('maps to the wire body', () => {
    expect(toLogBody(buildLocationPayload('u1', 'o1', fix(0)))).toEqual({
      user_id: 'u1',
      org_id: 'o1',
      latitude: 1,
      longitude: 2,
      timestamp: '1970-01-01T00:00:00.000Z',
    });
  });
});

describe('isForbiddenError', () => {
  it('detects status 403 only', () => {
    expect(isForbiddenError({ status: 403 })).toBe(true);
    expect(isForbiddenError(Object.assign(new Error('x'), { status: 403 }))).toBe(true);
    expect(isForbiddenError({ status: 500 })).toBe(false);
    expect(isForbiddenError(new Error('403'))).toBe(false);
    expect(isForbiddenError(null)).toBe(false);
  });
});

describe('parsePersistedTracking', () => {
  it('parses a valid value and rejects everything else', () => {
    expect(parsePersistedTracking('{"userId":"u","orgId":"o","startedAt":5}')).toEqual({ userId: 'u', orgId: 'o', startedAt: 5 });
    expect(parsePersistedTracking('true')).toBeNull();
    expect(parsePersistedTracking('false')).toBeNull();
    expect(parsePersistedTracking('{bad json')).toBeNull();
    expect(parsePersistedTracking('{"userId":"","orgId":"o"}')).toBeNull();
    expect(parsePersistedTracking(null)).toBeNull();
  });
});

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves when the promise wins', async () => {
    await expect(withTimeout(Promise.resolve(7), 1_000)).resolves.toBe(7);
  });

  it('rejects with a timeout LocationError when it takes too long', async () => {
    const p = withTimeout(new Promise<number>(() => undefined), 1_000);
    const assertion = expect(p).rejects.toMatchObject({ code: 'timeout' });
    jest.advanceTimersByTime(1_001);
    await assertion;
    await expect(p).rejects.toBeInstanceOf(LocationError);
  });

  it('propagates the original rejection', async () => {
    await expect(withTimeout(Promise.reject(new LocationError('denied')), 1_000)).rejects.toMatchObject({ code: 'denied' });
  });
});
