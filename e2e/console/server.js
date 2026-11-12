'use strict';
/* Test server for the admin web console: serves C:\POC\clockyn_frontend\UI_ADMIN_APP as it is, except /js/config.js, which points
 * API_BASE at the operator mock (operator-mock.js). Nothing in UI_ADMIN_APP is modified.
 * Env: CONSOLE_WEB_PORT (8890), CONSOLE_API_PORT (8891). */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createOperatorMock } = require('./operator-mock');

const WEB_PORT = Number(process.env.CONSOLE_WEB_PORT || 8890);
const API_PORT = Number(process.env.CONSOLE_API_PORT || 8891);
const ROOT = path.resolve(__dirname, '..', '..', 'UI_ADMIN_APP');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.json': 'application/json' };

const CONFIG_JS = "const API_BASE = 'http://127.0.0.1:" + API_PORT + "';\nconst LOGO_URL = '../assets/images/clockyn-logo.png';\n";

createOperatorMock().listen(API_PORT).then(() => {
  http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/js/config.js') { res.setHeader('Content-Type', TYPES['.js']); res.setHeader('Cache-Control', 'no-store'); res.end(CONFIG_JS); return; }
    const file = path.resolve(ROOT, '.' + (p === '/' ? '/index.html' : p));
    if (file.indexOf(ROOT) !== 0 || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; res.end('not found'); return; }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(file).pipe(res);
  }).listen(WEB_PORT, '127.0.0.1', () => console.log('console test server: web ' + WEB_PORT + ', operator mock ' + API_PORT));
});
