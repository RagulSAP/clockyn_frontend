'use strict';
/**
 * Tiny HTTP toolkit for the mock backend: router with `:param` segments, body parsing (JSON, urlencoded, multipart)
 * and the error helper used by every route module. Zero dependencies.
 */

class HttpError extends Error {
  constructor(status, body) {
    super(typeof body === 'string' ? body : JSON.stringify(body));
    this.status = status;
    this.body = typeof body === 'string' ? { detail: body } : body;
  }
}

/** `fail(404, 'Not found')` -> HTTP 404 `{detail}` (FastAPI style). */
function fail(status, detail) {
  throw new HttpError(status, detail);
}

/** A business failure delivered with HTTP 200 (`{success:false, message}`), like the real backend. */
function bizFail(message, extra) {
  return { success: false, message, ...(extra || {}) };
}

/** Wrapped 403 as the chat list endpoints deliver it: HTTP 500 `{detail: "403: ..."}`. */
function wrapped403(message) {
  throw new HttpError(500, { detail: `403: ${message}` });
}

/** Raw (non-JSON) response. */
class Raw {
  constructor(buffer, contentType, headers) {
    this.buffer = buffer;
    this.contentType = contentType;
    this.headers = headers || {};
    this.status = 200;
  }
}

// ─── router ────────────────────────────────────────────────────────────────────────────────────────

function compile(pattern) {
  const parts = pattern.replace(/\/+$/, '').split('/').filter((p, i) => i > 0 || p !== '');
  return parts;
}

class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    this.routes.push({ method, pattern, parts: compile(pattern), handler });
  }

  get(p, h) { this.add('GET', p, h); }
  post(p, h) { this.add('POST', p, h); }
  put(p, h) { this.add('PUT', p, h); }
  patch(p, h) { this.add('PATCH', p, h); }
  delete(p, h) { this.add('DELETE', p, h); }

  /** Returns `{ route, params }` or null. First registered route wins (register specific paths first). */
  match(method, pathname) {
    const segs = pathname.replace(/\/+$/, '').split('/').filter((p, i) => i > 0 || p !== '');
    for (const route of this.routes) {
      if (route.method !== method || route.parts.length !== segs.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < segs.length; i += 1) {
        const want = route.parts[i];
        if (want.startsWith(':')) {
          try {
            params[want.slice(1)] = decodeURIComponent(segs[i]);
          } catch {
            params[want.slice(1)] = segs[i];
          }
        } else if (want !== segs[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return { route, params };
    }
    return null;
  }

  /** True when another method would have matched (to answer 405 instead of 404). */
  pathExists(pathname) {
    return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].some((m) => this.match(m, pathname));
  }
}

// ─── body parsing ──────────────────────────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipart(buffer, boundary) {
  const fields = {};
  const files = [];
  const delimiter = Buffer.from(`--${boundary}`);
  let pos = buffer.indexOf(delimiter);
  while (pos !== -1) {
    const start = pos + delimiter.length;
    if (buffer.slice(start, start + 2).toString() === '--') break; // closing delimiter
    const headerStart = start + 2; // skip CRLF
    const headerEnd = buffer.indexOf('\r\n\r\n', headerStart);
    if (headerEnd === -1) break;
    const headerText = buffer.slice(headerStart, headerEnd).toString('utf8');
    const next = buffer.indexOf(delimiter, headerEnd + 4);
    const bodyEnd = next === -1 ? buffer.length : next - 2; // strip CRLF before the next delimiter
    const content = buffer.slice(headerEnd + 4, bodyEnd);
    const disposition = /content-disposition:[^\r\n]*/i.exec(headerText);
    const name = disposition ? /name="([^"]*)"/i.exec(disposition[0]) : null;
    const filename = disposition ? /filename="([^"]*)"/i.exec(disposition[0]) : null;
    const type = /content-type:\s*([^\r\n]+)/i.exec(headerText);
    if (name) {
      if (filename) {
        files.push({ field: name[1], filename: filename[1], mimetype: type ? type[1].trim() : 'application/octet-stream', size: content.length });
      } else {
        fields[name[1]] = content.toString('utf8');
      }
    }
    pos = next;
  }
  return { fields, files };
}

/** Parses the request body. Returns `{ body, files, raw }` where `body` is an object (fields for forms). */
async function parseBody(req) {
  const raw = await readBody(req);
  const type = String(req.headers['content-type'] || '');
  if (raw.length === 0) return { body: {}, files: [], raw };
  if (type.includes('application/json')) {
    try {
      return { body: JSON.parse(raw.toString('utf8')), files: [], raw };
    } catch {
      throw new HttpError(422, 'Invalid JSON body');
    }
  }
  if (type.includes('application/x-www-form-urlencoded')) {
    return { body: Object.fromEntries(new URLSearchParams(raw.toString('utf8'))), files: [], raw };
  }
  if (type.includes('multipart/form-data')) {
    const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(type);
    const boundary = m ? m[1] || m[2] : '';
    const parsed = parseMultipart(raw, boundary);
    return { body: parsed.fields, files: parsed.files, raw };
  }
  try {
    return { body: JSON.parse(raw.toString('utf8')), files: [], raw };
  } catch {
    return { body: {}, files: [], raw };
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-id, x-role-id, x-e2e-tenant, Authorization, Accept',
  'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length',
  'Access-Control-Max-Age': '600',
};

function sendJson(res, status, body) {
  const text = JSON.stringify(body === undefined ? null : body);
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

function sendRaw(res, raw) {
  res.writeHead(raw.status, { ...CORS, 'Content-Type': raw.contentType, 'Content-Length': raw.buffer.length, ...raw.headers });
  res.end(raw.buffer);
}

module.exports = { HttpError, fail, bizFail, wrapped403, Raw, Router, parseBody, sendJson, sendRaw, CORS };
