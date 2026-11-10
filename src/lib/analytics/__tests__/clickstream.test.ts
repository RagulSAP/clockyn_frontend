import { cleanLabel, createClickstream, FLUSH_AT, MAX_BATCH, MAX_QUEUE, screenName, SESSION_IDLE_MS, type ClickstreamBatch } from '../clickstream';
import { setTapHandler, trackTap } from '../tap';

const ME = { userId: 'u1', orgId: 'o1', roleId: 1 };

function setup(over: { fail?: boolean } = {}) {
  let t = 1_000_000;
  let ids = 0;
  const sent: ClickstreamBatch[] = [];
  const state = { fail: !!over.fail };
  const cs = createClickstream({
    send: async (b) => {
      if (state.fail) throw new Error('offline');
      sent.push(b);
    },
    platform: 'android',
    appVersion: '1.2.3',
    now: () => t,
    newId: () => `session-${++ids}`,
  });
  return { cs, sent, state, advance: (ms: number) => void (t += ms) };
}

describe('screenName', () => {
  it('drops route groups and keeps dynamic segments as patterns', () => {
    expect(screenName(['admin', '(tabs)', 'home'])).toBe('/admin/home');
    expect(screenName(['admin', 'staff', 'edit'])).toBe('/admin/staff/edit');
    expect(screenName(['staff', 'chat', '[id]'])).toBe('/staff/chat/[id]');
    expect(screenName([])).toBe('/');
  });
});

describe('cleanLabel', () => {
  it('trims, collapses spaces and caps the length', () => {
    expect(cleanLabel('  Add   Staff ')).toBe('Add Staff');
    expect(cleanLabel('x'.repeat(200))).toHaveLength(80);
  });
  it('drops anything empty or personal-looking', () => {
    expect(cleanLabel('')).toBeNull();
    expect(cleanLabel(undefined)).toBeNull();
    expect(cleanLabel(42)).toBeNull();
    expect(cleanLabel('Call priya@acme.in')).toBeNull();
    expect(cleanLabel('Call 9876543210')).toBeNull();
    expect(cleanLabel('Step 3')).toBe('Step 3');
  });
});

describe('clickstream', () => {
  it('records nothing until someone is signed in', async () => {
    const { cs, sent } = setup();
    cs.screenView('/admin/home');
    cs.click('Save');
    await cs.flush();
    expect(cs.pending()).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('sends a session start, screens and taps with the right context', async () => {
    const { cs, sent } = setup();
    cs.setIdentity(ME);
    cs.screenView('/admin/home');
    cs.click('Add Staff');
    await cs.flush();
    expect(sent).toHaveLength(1);
    const b = sent[0];
    expect(b).toMatchObject({ session_id: 'session-2', platform: 'android', app_version: '1.2.3', user_id: 'u1', org_id: 'o1', role_id: 1 });
    expect(b.events.map((e) => [e.type, e.name, e.screen])).toEqual([
      ['session', 'start', undefined],
      ['screen', '/admin/home', undefined],
      ['click', 'Add Staff', '/admin/home'],
    ]);
    expect(cs.pending()).toBe(0);
  });

  it('ignores the same screen twice in a row and personal labels', async () => {
    const { cs, sent } = setup();
    cs.setIdentity(ME);
    cs.screenView('/a');
    cs.screenView('/a');
    cs.click('Call 9876543210');
    await cs.flush();
    expect(sent[0].events.filter((e) => e.type !== 'session')).toHaveLength(1);
  });

  it('keeps events when the send fails and retries them later', async () => {
    const { cs, sent, state } = setup({ fail: true });
    cs.setIdentity(ME);
    cs.screenView('/a');
    await cs.flush();
    expect(cs.pending()).toBe(2);
    state.fail = false;
    await cs.flush();
    expect(cs.pending()).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('caps the queue and the batch size', async () => {
    const { cs, sent, state } = setup({ fail: true });
    cs.setIdentity(ME);
    for (let i = 0; i < MAX_QUEUE + 40; i++) cs.screenView(`/s${i}`);
    expect(cs.pending()).toBe(MAX_QUEUE);
    await cs.flush(); // the automatic attempt made on the way has failed too
    state.fail = false;
    await cs.flush();
    expect(sent.every((b) => b.events.length <= MAX_BATCH)).toBe(true);
    expect(sent.reduce((n, b) => n + b.events.length, 0)).toBe(MAX_QUEUE);
  });

  it('flushes by itself once the queue is long enough', async () => {
    const { cs, sent } = setup();
    cs.setIdentity(ME);
    for (let i = 0; i < FLUSH_AT; i++) cs.screenView(`/s${i}`);
    await cs.flush();
    expect(sent.length).toBeGreaterThan(0);
  });

  it('starts a new session after a long pause, on the screen the person is already on', () => {
    const { cs, advance } = setup();
    cs.setIdentity(ME);
    cs.screenView('/admin/home');
    const first = cs.currentSession();
    expect(cs.pending()).toBe(2); // session start + the screen
    advance(SESSION_IDLE_MS + 1000);
    cs.resume();
    expect(cs.currentSession()).not.toBe(first);
    expect(cs.pending()).toBe(4); // + new session start + the screen again
  });

  it('drops the queue on sign-out and starts clean for the next user', async () => {
    const { cs, sent } = setup();
    cs.setIdentity(ME);
    cs.screenView('/a');
    cs.setIdentity(null);
    expect(cs.pending()).toBe(0);
    cs.screenView('/b');
    expect(cs.pending()).toBe(0);
    cs.setIdentity({ userId: 'u2', orgId: 'o2', roleId: 3 });
    cs.screenView('/b');
    await cs.flush();
    expect(sent[0].user_id).toBe('u2');
    expect(sent[0].events.map((e) => e.name)).toEqual(['start', '/b']);
  });

  it('does not reset when the same user is set again', () => {
    const { cs } = setup();
    cs.setIdentity(ME);
    cs.screenView('/a');
    cs.setIdentity({ ...ME });
    expect(cs.pending()).toBe(2);
  });
});

describe('tap hook point', () => {
  afterEach(() => setTapHandler(null));
  it('does nothing without a handler and never throws', () => {
    expect(() => trackTap('Save')).not.toThrow();
  });
  it('passes the label to the installed handler and survives a throwing one', () => {
    const seen: unknown[] = [];
    setTapHandler((l) => void seen.push(l));
    trackTap('Save');
    expect(seen).toEqual(['Save']);
    setTapHandler(() => {
      throw new Error('boom');
    });
    expect(() => trackTap('Save')).not.toThrow();
  });
});
