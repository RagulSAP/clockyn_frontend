/**
 * Clickstream: which screens people open and which buttons they tap, so Clockyn can see how the product is used.
 *
 * Privacy by design: only the ROUTE PATTERN of a screen (never the real ids in the URL) and the LABEL of a button are
 * recorded. Typed text is never read. A label that looks like an e-mail address or a long number is dropped on the device
 * (the server redacts it again). The user / organisation come from the signed-in token on the server.
 *
 * Events are queued in memory and sent in small batches (every 15 s, when the queue is large, and when the app goes to the
 * background). A failed send keeps the events for the next try; the queue is capped, so a long offline period cannot grow
 * without bound. Nothing here can throw into the app.
 *
 * `createClickstream` is the pure core (tested); `clickstream` is the one instance the app uses, switched on by
 * `useClickstream` (components/layout/bootstrap) while someone is signed in.
 */

export type ClickstreamEventType = 'session' | 'screen' | 'click';

export type ClickstreamEvent = { type: ClickstreamEventType; name?: string; screen?: string; t: number };

export type ClickstreamBatch = {
  session_id: string;
  platform: string;
  app_version: string;
  user_id?: string;
  org_id?: string;
  role_id?: number;
  events: ClickstreamEvent[];
};

export const FLUSH_INTERVAL_MS = 15_000;
export const FLUSH_AT = 20;
export const MAX_QUEUE = 200;
export const MAX_BATCH = 50;
export const SESSION_IDLE_MS = 30 * 60_000;
export const RETRY_AFTER_MS = 30_000; // after a failed send, the queue size alone does not trigger another try for this long
const MAX_LABEL = 80;
const MAX_SCREEN = 120;

const GROUP_SEGMENT = /^\(.*\)$/;
const PERSONAL = /@|\d{6,}/;

/** `['admin', '(tabs)', 'home']` -> `/admin/home`; no segments -> `/`. Dynamic parts stay as `[id]`, never real values. */
export function screenName(segments: readonly string[]): string {
  const parts = segments.filter((s) => s && !GROUP_SEGMENT.test(s));
  return ('/' + parts.join('/')).slice(0, MAX_SCREEN);
}

/** A label that is safe to record, or `null` when it is empty or looks personal (e-mail, long number). */
export function cleanLabel(raw: unknown, limit: number = MAX_LABEL): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text || PERSONAL.test(text)) return null;
  return text.slice(0, limit);
}

export type ClickstreamDeps = {
  send: (batch: ClickstreamBatch) => Promise<unknown>;
  platform: string;
  appVersion: string;
  now?: () => number;
  newId?: () => string;
};

export type Identity = { userId: string; orgId: string; roleId: number };

const defaultId = (): string => {
  const rand = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `${Date.now().toString(36)}-${rand()}${rand()}`.slice(0, 36);
};

export function createClickstream(deps: ClickstreamDeps) {
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? defaultId;
  let queue: ClickstreamEvent[] = [];
  let sessionId = newId();
  let lastActivity = now();
  let screen = '';
  let identity: Identity | null = null;
  let enabled = false;
  let sending: Promise<void> | null = null;
  let retryAt = 0;

  const push = (event: ClickstreamEvent) => {
    queue.push(event);
    if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE); // oldest go first
  };

  /** Activity after a long pause starts a new session. */
  const touch = () => {
    const t = now();
    if (t - lastActivity > SESSION_IDLE_MS) {
      sessionId = newId();
      push({ type: 'session', name: 'start', t });
      if (screen) push({ type: 'screen', name: screen, t }); // the new session starts on the screen the person is already on
    }
    lastActivity = t;
  };

  async function flush(): Promise<void> {
    if (!enabled || !identity) return;
    if (sending) return sending;
    sending = (async () => {
      try {
        while (queue.length > 0 && enabled && identity) {
          const events = queue.slice(0, MAX_BATCH);
          try {
            await deps.send({
              session_id: sessionId,
              platform: deps.platform,
              app_version: deps.appVersion,
              user_id: identity.userId,
              org_id: identity.orgId,
              role_id: identity.roleId,
              events,
            });
          } catch {
            retryAt = now() + RETRY_AFTER_MS;
            return; // keep the events, try again at the next flush
          }
          queue = queue.slice(events.length);
        }
      } finally {
        sending = null;
      }
    })();
    return sending;
  }

  /** A long queue sends itself, unless the last try failed a moment ago (no request per event while offline). */
  const flushIfLong = () => {
    if (queue.length >= FLUSH_AT && now() >= retryAt) void flush();
  };

  return {
    /** Starts recording for a signed-in user (a new session) or stops it (`null`: the queue is dropped). */
    setIdentity(next: Identity | null): void {
      const same = !!next && !!identity && next.userId === identity.userId && next.orgId === identity.orgId;
      identity = next;
      if (same) return;
      queue = [];
      screen = '';
      enabled = !!next;
      if (next) {
        sessionId = newId();
        lastActivity = now();
        push({ type: 'session', name: 'start', t: lastActivity });
      }
    },
    screenView(name: string): void {
      if (!enabled || !name || name === screen) return;
      touch();
      screen = name;
      push({ type: 'screen', name: name.slice(0, MAX_SCREEN), t: now() });
      flushIfLong();
    },
    click(label: unknown): void {
      const clean = cleanLabel(label);
      if (!enabled || !clean) return;
      touch();
      push({ type: 'click', name: clean, screen, t: now() });
      flushIfLong();
    },
    /** The app came back to the foreground: a long absence starts a new session. */
    resume(): void {
      if (enabled) touch();
    },
    flush,
    /** Test helpers. */
    pending: (): number => queue.length,
    currentSession: (): string => sessionId,
  };
}
