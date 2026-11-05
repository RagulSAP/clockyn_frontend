/**
 * Client for the mock backend's `/__test` control surface, bound to one tenant (= one Playwright worker origin).
 * Specs get it as the `mock` fixture (see support/test.ts); it is reset to the seed before every test.
 */
const ports = require('../ports.js') as { MOCK_URL: string; WEB_PORT: number; WEB_PORTS: number };
import type { PlanState } from './fixtures';

export const MOCK_URL: string = ports.MOCK_URL;
export const WEB_PORT: number = ports.WEB_PORT;

/** Web origin of a worker slot; it doubles as the mock tenant key. */
export const originForSlot = (slot: number): string => `http://127.0.0.1:${ports.WEB_PORT + (slot % ports.WEB_PORTS)}`;

export interface RecordedRequest {
  id: number;
  ts: string;
  method: string;
  path: string;
  query: Record<string, string>;
  /** JSON body, or the text fields of a form / multipart body. */
  body?: Record<string, unknown>;
  /** Multipart file parts (field, filename, mimetype, size). */
  files?: { field: string; filename: string; mimetype: string; size: number }[];
  status: number;
  injected?: boolean;
  /** `Authorization` header the app sent (null when none). WebSocket rows: `token=<value>` of the query. */
  auth?: string | null;
}

export interface FailRule {
  /** Exact path, `prefix*`, or `re:<regex>`. */
  path: string;
  method?: string;
  /** HTTP status to answer with (default 500). */
  status?: number;
  /** Response body (default `{detail: 'Injected failure (test)'}`). */
  body?: unknown;
  /** How many matching requests fail (default 1, -1 = until cleared). */
  times?: number;
  /** Drop the connection instead of answering (the app sees a network error). */
  networkError?: boolean;
}

export interface MockFlags {
  plan: PlanState;
  latencyMs: number;
  forceLogout: string[];
  faceMismatch: boolean;
  otp: string;
  today: string;
  clock: string | null;
  tenant: string;
  failNext: FailRule[];
  [k: string]: unknown;
}

export interface FixturesSnapshot {
  today: string;
  staff: { user_id: string; name: string; emp_id: string; mobile: string; role_id: number; status: number; field: boolean; branch_id: string | null; dept_id: string | null; shift_id: number; deviceToken: string | null }[];
  branches: { id: string; name: string; lat: number; lng: number; radius: number }[];
  departments: { id: string; name: string }[];
  shifts: { id: number; name: string }[];
  requests: { id: string; type: 'leave' | 'permission' | 'shift_change' | 'device_change'; userId: string; status: string }[];
  leads: { id: string; status: string; work: string | null; assignedTo: string | null }[];
  groups: { id: string; name: string }[];
  announcements: { id: string; target: string }[];
  payslips: { id: string; name: string }[];
  plan: PlanState;
  [k: string]: unknown;
}

export class MockClient {
  constructor(readonly tenant: string) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${MOCK_URL}${path}`, {
      method,
      headers: { 'x-e2e-tenant': this.tenant, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`mock ${method} ${path} -> ${res.status} ${text}`);
    return (text ? JSON.parse(text) : null) as T;
  }

  /** Back to the seed (also clears failure rules, latency, clock, recorded requests). Optional state patch applied after. */
  async reset(patch?: Partial<{ plan: PlanState; latencyMs: number; faceMismatch: boolean; forceLogout: string[]; clock: string | null }>): Promise<void> {
    await this.call('POST', '/__test/reset', patch ?? {});
  }

  state(): Promise<MockFlags> {
    return this.call('GET', '/__test/state');
  }

  /** Raw `POST /__test/state` (plan, latencyMs, failNext, clearFailures, clock, forceLogout, faceMismatch, otp, noCoupon, version). */
  setState(patch: Record<string, unknown>): Promise<MockFlags> {
    return this.call('POST', '/__test/state', patch);
  }

  /** Bearer-token mode: every non-public path answers 401 unless the request carries a token this mock issued. */
  requireAuth(on = true): Promise<MockFlags> {
    return this.setState({ requireAuth: on });
  }

  /** Every token issued so far now answers 401 'Token expired' (tokens issued afterwards are valid). */
  revokeTokens(): Promise<MockFlags> {
    return this.setState({ revokeTokens: true });
  }

  /** Simulate a plan: elite | prime | core (paid), trial (free trial), expired, none (no plan at all). */
  setPlan(plan: PlanState): Promise<MockFlags> {
    return this.setState({ plan });
  }

  /** Make the next matching request(s) fail: `mock.failNext('/home/branches', { status: 503 })`. */
  failNext(path: string, opts: Omit<FailRule, 'path'> = {}): Promise<MockFlags> {
    return this.setState({ failNext: { path, ...opts } });
  }

  clearFailures(): Promise<MockFlags> {
    return this.setState({ clearFailures: true });
  }

  setLatency(ms: number): Promise<MockFlags> {
    return this.setState({ latencyMs: ms });
  }

  /** Server answers `force_logout` on the next `check-session` of these users. */
  forceLogout(userIds: string[]): Promise<MockFlags> {
    return this.setState({ forceLogout: userIds });
  }

  /** Freeze/shift the server clock (ISO string, e.g. '2026-10-19T09:00:00+05:30'); null restores real time. */
  setClock(iso: string | null): Promise<MockFlags> {
    return this.setState({ clock: iso });
  }

  /**
   * Simulate the same account signing in on ANOTHER device: issues a new trusted-device token for `mobile`, so the
   * session watcher of the browser under test gets `force_logout` (single active device).
   */
  async takeOverDevice(mobile: string, newToken = 'other-device-token'): Promise<void> {
    await this.call('POST', '/auth/generate-otp', { contact: mobile, purpose: 'login', role_id: 3 });
    const state = await this.state();
    await this.call('POST', '/auth/validate-otp', { contact: mobile, otp_code: state.otp as string, purpose: 'login', device_token: newToken });
  }

  fixtures(): Promise<FixturesSnapshot> {
    return this.call('GET', '/__test/fixtures');
  }

  /** Recorded calls (this tenant only), oldest first. `path` is a substring, or a `prefix*`. */
  requests(filter: { path?: string; method?: string; since?: number } = {}): Promise<RecordedRequest[]> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v !== undefined) q.set(k, String(v));
    return this.call('GET', `/__test/requests${q.size ? `?${q}` : ''}`);
  }

  clearRequests(): Promise<void> {
    return this.call('DELETE', '/__test/requests');
  }

  async lastRequest(path: string, method?: string): Promise<RecordedRequest | undefined> {
    const rows = await this.requests({ path, method });
    return rows[rows.length - 1];
  }

  /** Poll until a request matching `path` (substring) / `method` / `predicate` was recorded. */
  async waitForRequest(path: string, opts: { method?: string; timeout?: number; predicate?: (r: RecordedRequest) => boolean } = {}): Promise<RecordedRequest> {
    const deadline = Date.now() + (opts.timeout ?? 10_000);
    for (;;) {
      const rows = await this.requests({ path, method: opts.method });
      const hit = rows.find((r) => !opts.predicate || opts.predicate(r));
      if (hit) return hit;
      if (Date.now() > deadline) throw new Error(`mock: no ${opts.method ?? ''} ${path} request recorded within ${opts.timeout ?? 10_000}ms (saw ${rows.length} matching before predicate)`);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  /** Push a WebSocket frame to one user's open socket(s): `mock.push('adm-0001', { type: 'request_submitted' })`. */
  push(userId: string | string[], event: unknown): Promise<{ delivered: number; targets: number }> {
    return this.call('POST', '/__test/push', Array.isArray(userId) ? { userIds: userId, event } : { userId, event });
  }

  /** Abruptly terminate this tenant's open WebSockets (all, or one user's): the app has to reconnect. */
  dropSockets(userId?: string): Promise<{ dropped: number }> {
    return this.call('POST', '/__test/drop-sockets', userId ? { userId } : {});
  }

  /** Open WebSocket connections of this tenant. */
  sockets(): Promise<{ userId: string; path: string; state: number }[]> {
    return this.call('GET', '/__test/sockets');
  }

  /** Poll until `userId` has an open socket (the app opens it after sign-in). */
  async waitForSocket(userId: string, timeout = 10_000): Promise<void> {
    const deadline = Date.now() + timeout;
    for (;;) {
      if ((await this.sockets()).some((s) => s.userId === userId && s.state === 1)) return;
      if (Date.now() > deadline) throw new Error(`mock: no open WebSocket for ${userId} within ${timeout}ms`);
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}
