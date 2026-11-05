/**
 * ApiError + error-body parsing for the backend's error conventions
 * (see shared/api/README.md §4 and §12 of the v1 spec).
 */

export const NETWORK_ERROR_MESSAGE = 'Network connection failed. Please check your internet connection.';
export const TIMEOUT_ERROR_MESSAGE = 'The request timed out. Please try again.';
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
const SERVER_ERROR_MESSAGE = 'Server error. Please try again later.';
const REQUEST_FAILED_MESSAGE = 'Request failed';

export interface ApiErrorInit {
  status: number;
  message?: string;
  /** Server-provided message (`detail` / `message`), when there was one. */
  detail?: string;
  /** Parsed JSON body (or raw text when the body was not JSON). */
  raw?: unknown;
  isNetwork?: boolean;
  isTimeout?: boolean;
  isAborted?: boolean;
  /** True when the backend wrapped an inner status as HTTP 500 `detail: "403: message"`. */
  wrapped?: boolean;
}

export class ApiError extends Error {
  /** HTTP status (0 for network / timeout / abort). For wrapped errors this is the inner status (e.g. 403). */
  status: number;
  /** Message provided by the server, if any (same as `message` unless a generic text was substituted). */
  detail?: string;
  raw?: unknown;
  isNetwork: boolean;
  isTimeout: boolean;
  isAborted: boolean;
  wrapped: boolean;

  constructor(init: ApiErrorInit) {
    super(init.message ?? init.detail ?? REQUEST_FAILED_MESSAGE);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = 'ApiError';
    this.status = init.status;
    this.detail = init.detail;
    this.raw = init.raw;
    this.isNetwork = init.isNetwork ?? false;
    this.isTimeout = init.isTimeout ?? false;
    this.isAborted = init.isAborted ?? false;
    this.wrapped = init.wrapped ?? false;
  }

  /** 4xx plan-block (403) errors. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Clean pydantic noise: "Value error, foo" -> "foo". */
function cleanValidationMsg(msg: string): string {
  return msg.replace(/^Value error,\s*/i, '').trim();
}

/** Extract a human string from FastAPI's `detail` (string | array of {msg} | object). */
export function extractDetailMessage(detail: unknown): string | undefined {
  if (typeof detail === 'string') {
    const t = detail.trim();
    return t === '' ? undefined : t;
  }
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (isRecord(item) && typeof item.msg === 'string') return cleanValidationMsg(item.msg);
        if (isRecord(item) && typeof item.message === 'string') return item.message.trim();
        return '';
      })
      .filter((s) => s.length > 0);
    const unique = Array.from(new Set(msgs));
    return unique.length > 0 ? unique.join('. ') : undefined;
  }
  if (isRecord(detail)) {
    for (const k of ['message', 'msg', 'detail', 'error']) {
      const v = detail[k];
      if (typeof v === 'string' && v.trim() !== '') return v.trim();
    }
  }
  return undefined;
}

/** Message from an error body: `detail` first, then `message` (v1 order). */
export function extractBodyMessage(body: unknown): string | undefined {
  if (typeof body === 'string') {
    // Plain-text error bodies from proxies are not user friendly unless short.
    const t = body.trim();
    return t.length > 0 && t.length <= 200 && !t.startsWith('<') ? t : undefined;
  }
  if (!isRecord(body)) return undefined;
  return extractDetailMessage(body.detail) ?? extractDetailMessage(body.message) ?? extractDetailMessage(body.error);
}

const WRAPPED_RE = /^\s*(\d{3}):\s*([\s\S]*)$/;

/** Parse "403: message" (Starlette `str(HTTPException)`) -> { status: 403, message: 'message' }. */
export function parseWrappedDetail(detail: string): { status: number; message: string } | null {
  let current = detail;
  let status = 0;
  for (let i = 0; i < 3; i += 1) {
    const m = WRAPPED_RE.exec(current);
    if (!m) break;
    const code = Number(m[1]);
    if (code < 400 || code > 599) break;
    status = code;
    current = m[2].trim();
  }
  return status === 0 ? null : { status, message: current };
}

/** Build an `ApiError` from a non-2xx response. */
export function apiErrorFromResponse(status: number, body: unknown): ApiError {
  const detail = extractBodyMessage(body);
  if (status === 500 && detail) {
    const wrapped = parseWrappedDetail(detail);
    if (wrapped) {
      return new ApiError({ status: wrapped.status, message: wrapped.message, detail: wrapped.message, raw: body, wrapped: true });
    }
  }
  const fallback = status >= 500 ? SERVER_ERROR_MESSAGE : REQUEST_FAILED_MESSAGE;
  return new ApiError({ status, message: detail ?? fallback, detail, raw: body });
}

export function networkError(): ApiError {
  return new ApiError({ status: 0, message: NETWORK_ERROR_MESSAGE, isNetwork: true });
}

export function timeoutError(): ApiError {
  return new ApiError({ status: 0, message: TIMEOUT_ERROR_MESSAGE, isNetwork: true, isTimeout: true });
}

export function abortedError(): ApiError {
  return new ApiError({ status: 0, message: 'Request cancelled', isAborted: true });
}

/**
 * Error for a `{ success: false, message }` body delivered with HTTP 200.
 * `status` is 200 (the transport worked); `detail` carries the server message.
 */
export function businessError(body: unknown, fallback = REQUEST_FAILED_MESSAGE): ApiError {
  const message = extractBodyMessage(body) ?? fallback;
  return new ApiError({ status: 200, message, detail: message, raw: body });
}

/**
 * User-facing message for any thrown value.
 *  - ApiError: server detail when present; network/timeout texts; otherwise `fallback` (else the error's own message).
 *  - TypeError (engine errors such as "undefined is not an object"): `fallback`.
 *  - other Error / string: its message.
 */
export function getErrorMessage(e: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  if (e instanceof ApiError) {
    if (e.isNetwork) return e.message || NETWORK_ERROR_MESSAGE;
    if (e.detail && e.detail.trim() !== '') return e.detail;
    return fallback !== GENERIC_ERROR_MESSAGE ? fallback : e.message || fallback;
  }
  if (e instanceof TypeError) return fallback;
  if (e instanceof Error) return e.message.trim() !== '' ? e.message : fallback;
  if (typeof e === 'string' && e.trim() !== '') return e;
  if (isRecord(e)) {
    // axios-like `{ response: { data: { detail } } }` objects (v1 login helpers).
    const response = e.response;
    if (isRecord(response)) {
      const m = extractBodyMessage(response.data);
      if (m) return m;
    }
    const m = extractBodyMessage(e);
    if (m) return m;
  }
  return fallback;
}
