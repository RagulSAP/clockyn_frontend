/**
 * The one HTTP client. Everything that talks to the backend goes through `api.*` (domain modules live in `@/api/*`).
 *
 *  - Base URL from `@/config/env`; JSON in/out by default; safe JSON parsing (empty / non-JSON bodies never throw).
 *  - Failures are ALWAYS `ApiError` (network/timeout => `isNetwork`; 500-wrapped "403: msg" => status 403, `wrapped`).
 *  - Query strings skip undefined/null values. Timeout default 30s via AbortController.
 *  - Bearer token: every request to a non-public path carries `Authorization: Bearer <session.accessToken>` when the
 *    signed-in session has one (read through the store getter, never React). No token (older server / never issued) = no header.
 *  - A `401` from a non-public path means the token is no longer valid: `configureApi({ onUnauthorized })` is called ONCE
 *    per session (the app bootstrap signs out and shows the welcome screen); the client stays decoupled from the router.
 *  - Request / response bodies and query values are never logged.
 */
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { getSession } from '@/store/auth';

import {
  abortedError,
  apiErrorFromResponse,
  ApiError,
  networkError,
  timeoutError,
} from './errors';

export { ApiError, getErrorMessage, isApiError } from './errors';

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_UPLOAD_TIMEOUT_MS = 60_000;

// ─── configuration hook ─────────────────────────────────────────────────────────────────────

export type HeaderMap = Record<string, string>;

export interface ApiConfig {
  /** Extra headers for every request (e.g. a future `Authorization`). May be async. */
  getHeaders?: () => HeaderMap | undefined | Promise<HeaderMap | undefined>;
  /** Override the base URL (tests / staging switch). Defaults to `env.apiBaseUrl`. */
  baseUrl?: string;
  /** Called for every ApiError thrown by the client (central 401/forced-logout handling). Must not throw. */
  onError?: (error: ApiError) => void;
  /**
   * A non-public request answered 401 while a session was active (expired / revoked token). Called at most once per
   * session, however many requests fail together. Must not throw.
   */
  onUnauthorized?: (error: ApiError) => void;
}

let config: ApiConfig = {};
/** Session key (`userId|token`) the expiry handler already ran for. */
let handledSessionKey: string | null = null;

export function configureApi(next: ApiConfig): void {
  config = { ...config, ...next };
}

export function resetApiConfig(): void {
  config = {};
  handledSessionKey = null;
}

const getBaseUrl = (): string => (config.baseUrl ?? env.apiBaseUrl).replace(/\/+$/, '');

// ─── bearer token / public paths ────────────────────────────────────────────────────────────

const PUBLIC_EXACT = new Set([
  '/auth/config',
  '/auth/generate-otp',
  '/auth/validate-otp',
  '/auth/verify-device-token',
  '/auth/login',
  '/auth/employee-login',
  '/auth/register',
  '/referral/validate',
  '/version/check',
  '/health',
  '/ready',
]);
const PUBLIC_PREFIXES = ['/auth/check-mobile/', '/auth/check-email/', '/auth/org-logo/', '/files/', '/static/', '/uploads/', '/webhook/'];

/** Server-relative path (no query / hash) for a client path or an absolute URL on the API host; null for foreign hosts. */
function serverPath(path: string): string | null {
  let p = path;
  if (/^https?:\/\//i.test(p)) {
    const base = getBaseUrl();
    if (!p.toLowerCase().startsWith(base.toLowerCase())) return null;
    p = p.slice(base.length);
  }
  p = p.split('#')[0].split('?')[0];
  p = p.startsWith('/') ? p : `/${p}`;
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

/** Paths that work without a bearer token (the server never answers 401 for them). */
export function isPublicPath(path: string): boolean {
  const p = serverPath(path);
  if (p === null) return true; // not our server: never send the token, never treat a 401 as ours
  return PUBLIC_EXACT.has(p) || PUBLIC_PREFIXES.some((prefix) => p.startsWith(prefix) || `${p}/` === prefix);
}

/** `Authorization` header value for the current session (undefined when there is none). */
function bearerFor(path: string, explicit?: string): string | undefined {
  if (explicit) return `Bearer ${explicit}`;
  if (isPublicPath(path)) return undefined;
  const token = getSession()?.accessToken;
  return token ? `Bearer ${token}` : undefined;
}

/**
 * `{ Authorization }` for a request made outside the client (file downloads from the API host); `{}` for public paths,
 * foreign hosts (chat attachments, CDN links) and when no token exists.
 */
export function authHeadersFor(url: string): HeaderMap {
  const bearer = bearerFor(url);
  return bearer ? { Authorization: bearer } : {};
}

const sessionKey = (): string | null => {
  const s = getSession();
  return s ? `${s.userId}|${s.accessToken ?? ''}` : null;
};

/** A 401 for a request that was sent by the session identified by `sentKey`. Fires the app handler once per session. */
function notifyUnauthorized(path: string, sentKey: string | null, error: ApiError): void {
  if (error.status !== 401 || isPublicPath(path) || serverPath(path) === '/auth/logout') return;
  if (!config.onUnauthorized) return;
  if (!sentKey || sentKey !== sessionKey() || sentKey === handledSessionKey) return; // no session, a newer session, or already handled
  handledSessionKey = sentKey;
  try {
    config.onUnauthorized?.(error);
  } catch {
    // the expiry handler must never break the request pipeline
  }
}

// ─── URL building ───────────────────────────────────────────────────────────────────────────

export type QueryPrimitive = string | number | boolean;
export type QueryValue = QueryPrimitive | null | undefined | readonly QueryPrimitive[];
export type Query = Record<string, QueryValue>;

/** 'a=1&b=x%20y'. Skips undefined / null (and undefined array items); arrays repeat the key. */
export function buildQueryString(query?: Query): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    const items: readonly QueryPrimitive[] = Array.isArray(value) ? (value as readonly QueryPrimitive[]) : [value as QueryPrimitive];
    for (const item of items) {
      if (item === undefined || item === null) continue;
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
    }
  }
  return parts.join('&');
}

/** Join base URL + path + query. Absolute URLs pass through. */
export function buildUrl(path: string, query?: Query): string {
  const base = /^https?:\/\//i.test(path) ? path : `${getBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
  const qs = buildQueryString(query);
  if (!qs) return base;
  return `${base}${base.includes('?') ? '&' : '?'}${qs}`;
}

// ─── response parsing ───────────────────────────────────────────────────────────────────────

/** Parse a response body text without ever throwing: '' -> null, JSON -> value, anything else -> the text. */
export function safeParseBody(text: string): unknown {
  if (text.trim() === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ─── core request ───────────────────────────────────────────────────────────────────────────

export interface RequestOptions {
  headers?: HeaderMap;
  /** Milliseconds; default 30 000. `0` disables the timeout. */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** 'json' (default) | 'text' | 'blob'. Error bodies are always parsed as JSON/text. */
  responseType?: 'json' | 'text' | 'blob';
  /** Query string for any method (POST/PUT/PATCH/DELETE endpoints that take query params). */
  query?: Query;
  /** Body for `api.delete` / `api.request`. */
  body?: unknown;
  /** Bearer token to send instead of the session's (calls made before the session exists, e.g. during login / registration). */
  accessToken?: string;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const isFormData = (b: unknown): b is FormData => typeof FormData !== 'undefined' && b instanceof FormData;
const isBlob = (b: unknown): b is Blob => typeof Blob !== 'undefined' && b instanceof Blob;
const isRawBody = (b: unknown): boolean =>
  typeof b === 'string' ||
  isFormData(b) ||
  isBlob(b) ||
  (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) ||
  (typeof ArrayBuffer !== 'undefined' && b instanceof ArrayBuffer);

async function resolveHeaders(extra?: HeaderMap, auth?: { path: string; accessToken?: string }): Promise<HeaderMap> {
  let hook: HeaderMap | undefined;
  try {
    hook = await config.getHeaders?.();
  } catch {
    hook = undefined;
  }
  const bearer = auth ? bearerFor(auth.path, auth.accessToken) : undefined;
  return { Accept: 'application/json', ...(bearer ? { Authorization: bearer } : {}), ...(hook ?? {}), ...(extra ?? {}) };
}

function emit(error: ApiError): ApiError {
  try {
    config.onError?.(error);
  } catch {
    // an error observer must never break the request pipeline
  }
  return error;
}

async function request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = buildUrl(path, opts.query);
  const sentKey = sessionKey();
  const headers = await resolveHeaders(opts.headers, { path, accessToken: opts.accessToken });

  let body: BodyInit | undefined;
  if (method !== 'GET' && opts.body !== undefined && opts.body !== null) {
    if (isRawBody(opts.body)) {
      body = opts.body as BodyInit; // FormData: let the runtime set the multipart boundary (never set Content-Type by hand)
    } else {
      body = JSON.stringify(opts.body);
      if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
    }
  }

  const controller = new AbortController();
  let timedOut = false;
  let userAborted = false;
  const timer = timeoutMs > 0 ? setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs) : undefined;
  const onUserAbort = (): void => { userAborted = true; controller.abort(); };
  if (opts.signal) {
    if (opts.signal.aborted) onUserAbort();
    else opts.signal.addEventListener('abort', onUserAbort);
  }

  try {
    let response: Response;
    try {
      response = await fetch(url, { method, headers, body, signal: controller.signal });
    } catch {
      throw emit(timedOut ? timeoutError() : userAborted ? abortedError() : networkError());
    }

    let parsed: unknown;
    try {
      if (response.ok && opts.responseType === 'blob') parsed = await response.blob();
      else if (response.ok && opts.responseType === 'text') parsed = await response.text();
      else parsed = safeParseBody(await response.text());
    } catch {
      throw emit(timedOut ? timeoutError() : userAborted ? abortedError() : networkError());
    }

    if (!response.ok) {
      const error = emit(apiErrorFromResponse(response.status, parsed));
      notifyUnauthorized(path, sentKey, error);
      throw error;
    }
    return parsed as T;
  } finally {
    if (timer) clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onUserAbort);
  }
}

export const api = {
  /** `api.get<T>('/home/branches', { user_id: orgId })` */
  get<T = unknown>(path: string, query?: Query, opts: RequestOptions = {}): Promise<T> {
    return request<T>('GET', path, { ...opts, query: { ...(opts.query ?? {}), ...(query ?? {}) } });
  },
  post<T = unknown>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    return request<T>('POST', path, { ...opts, body });
  },
  put<T = unknown>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    return request<T>('PUT', path, { ...opts, body });
  },
  patch<T = unknown>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    return request<T>('PATCH', path, { ...opts, body });
  },
  /** `api.delete<T>(path, query?, opts?)` — pass `opts.body` for the rare DELETE with a body. */
  delete<T = unknown>(path: string, query?: Query, opts: RequestOptions = {}): Promise<T> {
    return request<T>('DELETE', path, { ...opts, query: { ...(opts.query ?? {}), ...(query ?? {}) } });
  },
  upload,
  /** Escape hatch with an explicit method. */
  request<T = unknown>(method: Method, path: string, opts?: RequestOptions): Promise<T> {
    return request<T>(method, path, opts);
  },
};

// ─── uploads (multipart with progress) ──────────────────────────────────────────────────────

export type UploadFieldValue = string | number | boolean | null | undefined;

export interface UploadFile {
  /** `file://`, `content://`, `blob:` or `data:` uri from the picker / camera. */
  fileUri: string;
  /** Multipart field name — differs per endpoint (`file`, `photo`, `logo`, `face`, `faces` …). */
  fieldName: string;
  fileName: string;
  mimeType: string;
}

export type UploadInput =
  | FormData
  | (UploadFile & { fields?: Record<string, UploadFieldValue> })
  | { files: UploadFile[]; fields?: Record<string, UploadFieldValue> };

export interface UploadOptions {
  /** Called with 0-100 as bytes are sent (may not fire when the length is not computable). */
  onProgress?: (percent: number, loaded: number, total: number) => void;
  /** Default POST. */
  method?: 'POST' | 'PUT' | 'PATCH';
  /** Default 60 000. `0` disables. */
  timeoutMs?: number;
  headers?: HeaderMap;
  signal?: AbortSignal;
  /** Query string (several upload endpoints take `user_id`, `expense_id`, … in the query). */
  query?: Query;
  /** Bearer token to send instead of the session's (see `RequestOptions.accessToken`). */
  accessToken?: string;
}

async function appendFile(form: FormData, f: UploadFile): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(f.fileUri)).blob();
    const typed = blob.type ? blob : new Blob([blob], { type: f.mimeType });
    form.append(f.fieldName, typed, f.fileName);
  } else {
    // React Native's FormData accepts `{ uri, name, type }` file descriptors (not part of the DOM typings).
    form.append(f.fieldName, { uri: f.fileUri, name: f.fileName, type: f.mimeType } as unknown as Blob);
  }
}

/** Build a multipart body from a file descriptor (native: `{uri,name,type}`; web: a real Blob). FormData passes through. */
export async function buildFormData(input: UploadInput): Promise<FormData> {
  if (isFormData(input)) return input;
  const form = new FormData();
  const fields = input.fields;
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null) continue;
      form.append(k, String(v));
    }
  }
  const files = 'files' in input ? input.files : [input];
  for (const f of files) await appendFile(form, f);
  return form;
}

async function upload<T = unknown>(path: string, input: UploadInput, opts: UploadOptions = {}): Promise<T> {
  let form: FormData;
  try {
    form = await buildFormData(input);
  } catch {
    throw emit(new ApiError({ status: 0, message: 'Could not read the selected file. Please try again.', detail: undefined }));
  }
  const url = buildUrl(path, opts.query);
  const sentKey = sessionKey();
  const baseHeaders = await resolveHeaders(opts.headers, { path, accessToken: opts.accessToken });
  const timeoutMs = opts.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS;

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      opts.signal?.removeEventListener('abort', onAbort);
      fn();
    };
    const fail = (e: ApiError): void => finish(() => reject(emit(e)));
    function onAbort(): void {
      xhr.abort();
    }

    xhr.open(opts.method ?? 'POST', url);
    for (const [k, v] of Object.entries(baseHeaders)) {
      if (k.toLowerCase() === 'content-type') continue; // multipart boundary is set by the runtime
      xhr.setRequestHeader(k, v);
    }
    if (timeoutMs > 0) xhr.timeout = timeoutMs;
    if (xhr.upload && opts.onProgress) {
      const cb = opts.onProgress;
      xhr.upload.onprogress = (e: ProgressEvent): void => {
        if (e.lengthComputable && e.total > 0) cb(Math.min(100, Math.round((e.loaded / e.total) * 100)), e.loaded, e.total);
      };
    }
    xhr.onload = (): void => {
      const parsed = safeParseBody(typeof xhr.responseText === 'string' ? xhr.responseText : '');
      if (xhr.status >= 200 && xhr.status < 300) finish(() => resolve(parsed as T));
      else {
        const error = apiErrorFromResponse(xhr.status, parsed);
        fail(error);
        notifyUnauthorized(path, sentKey, error);
      }
    };
    xhr.onerror = (): void => fail(networkError());
    xhr.ontimeout = (): void => fail(timeoutError());
    xhr.onabort = (): void => fail(abortedError());

    if (opts.signal) {
      if (opts.signal.aborted) {
        fail(abortedError());
        return;
      }
      opts.signal.addEventListener('abort', onAbort);
    }
    xhr.send(form);
  });
}
