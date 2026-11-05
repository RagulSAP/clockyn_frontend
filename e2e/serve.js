#!/usr/bin/env node
'use strict';
/**
 * Static server for the web export (e2e/.artifacts/web-dist) with SPA fallback: any path that is not a file
 * answers `index.html` (Expo Router single-page output). Ports: E2E_WEB_PORT (default 8788) and the next E2E_WEB_PORTS-1 (one per Playwright worker).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WEB_PORT, WEB_PORTS } = require('./ports');

const ARTIFACTS = process.env.E2E_ARTIFACTS ? path.resolve(__dirname, '..', process.env.E2E_ARTIFACTS) : path.join(__dirname, '.artifacts');
const ROOT = path.resolve(process.env.E2E_WEB_ROOT || path.join(ARTIFACTS, 'web-dist'));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`[serve] ${ROOT}/index.html not found. Build the web export first:  npm run e2e:build`);
  process.exit(1);
}

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const target = path.normalize(path.join(ROOT, clean));
  if (!target.startsWith(ROOT)) return null; // path traversal
  try {
    const st = fs.statSync(target);
    if (st.isFile()) return target;
    if (st.isDirectory() && fs.existsSync(path.join(target, 'index.html'))) return path.join(target, 'index.html');
  } catch {
    /* fall through to SPA fallback */
  }
  return null;
}

function handler(req, res) {
  const file = resolveFile(req.url || '/');
  // Asset-looking requests that do not exist are real 404s; everything else is a client-side route.
  const looksLikeAsset = /\.[a-z0-9]{2,5}$/i.test((req.url || '').split('?')[0]);
  const send = file || (!looksLikeAsset ? path.join(ROOT, 'index.html') : null);
  if (!send) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  const type = TYPES[path.extname(send).toLowerCase()] || 'application/octet-stream';
  const immutable = send.includes(`${path.sep}_expo${path.sep}`) || send.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': immutable ? 'public, max-age=3600' : 'no-cache' });
  fs.createReadStream(send).pipe(res);
}

// One listener per Playwright worker slot: the browser origin (host:port) is the mock backend's tenant key, so each
// worker gets its own isolated mock state (see e2e/mock-server/index.js).
for (let i = 0; i < WEB_PORTS; i += 1) {
  http.createServer(handler).listen(WEB_PORT + i, '127.0.0.1', () => {
    if (i === 0) console.log(`[serve] ${ROOT} on http://127.0.0.1:${WEB_PORT}..${WEB_PORT + WEB_PORTS - 1}`);
  });
}
