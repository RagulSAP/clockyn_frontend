'use strict';
/* Static check of the admin console (UI_ADMIN_APP): every page that talks to the API includes js/operator-session.js exactly once,
 * after config.js and before auth.js and before any page script that can call the API; nothing bypasses fetch to reach API_BASE.
 * CLI: node e2e/console/static-check.js   (exit code 1 on any problem). Also run by operator-session.spec.js. */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', 'UI_ADMIN_APP');
const SESSION = '../js/operator-session.js';
/* external scripts that may load before operator-session.js: they never call API_BASE at load time
 * (layout.js only injects live-chat-notify.js, which starts on DOMContentLoaded, after every synchronous script has run) */
const OK_BEFORE = [/^\.\.\/js\/theme\.js$/, /^\.\.\/js\/layout\.js$/, /^\.\.\/js\/config\.js$/, /^https:\/\/(cdn\.sheetjs\.com|cdnjs\.cloudflare\.com)\//];
/* known places that reach something other than the authenticated API (reviewed): file:needle */
const BYPASS_ALLOW = [
  ['videos.html', 'new XMLHttpRequest'],      /* putToS3: PUT to a pre-signed S3 URL */
  ['users.html', 'window.open(this.src)'],    /* punch photos: pre-signed S3 URLs */
];

function scripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(m[1]);
    out.push({ index: m.index, src: src ? src[1] : '', body: src ? '' : m[2] });
  }
  return out;
}

function check() {
  const problems = [];
  const pagesDir = path.join(ROOT, 'pages');
  const pages = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.html')).sort();
  pages.forEach((file) => {
    const html = fs.readFileSync(path.join(pagesDir, file), 'utf8');
    const list = scripts(html);
    const at = (pred) => list.findIndex(pred);
    const count = list.filter((s) => s.src === SESSION).length;
    if (count !== 1) problems.push(file + ': operator-session.js included ' + count + ' times');
    const iSes = at((s) => s.src === SESSION);
    const iCfg = at((s) => s.src === '../js/config.js');
    const iAuth = at((s) => s.src === '../js/auth.js');
    if (iCfg < 0) problems.push(file + ': config.js missing');
    if (iSes >= 0 && iCfg >= 0 && iSes < iCfg) problems.push(file + ': operator-session.js is before config.js');
    if (iAuth >= 0 && iSes > iAuth) problems.push(file + ': operator-session.js is after auth.js');
    list.slice(0, Math.max(iSes, 0)).forEach((s) => {
      if (s.src && !OK_BEFORE.some((r) => r.test(s.src))) problems.push(file + ': script ' + s.src + ' runs before operator-session.js');
      if (!s.src && /fetch\s*\(|XMLHttpRequest|API_BASE|WebSocket/.test(s.body)) problems.push(file + ': inline script calls the API before operator-session.js');
    });
    /* bypasses of the fetch wrapper */
    const bypass = [/new XMLHttpRequest/, /window\.open\(/, /\.href\s*=\s*API_BASE/, /href=["']\s*\+?\s*API_BASE/, /src\s*=\s*API_BASE/, /new WebSocket/, /new EventSource/, /sendBeacon/];
    html.split('\n').forEach((line, n) => {
      bypass.forEach((re) => {
        if (re.test(line) && !BYPASS_ALLOW.some(([f, needle]) => f === file && line.indexOf(needle) >= 0)) problems.push(file + ':' + (n + 1) + ': possible fetch bypass: ' + line.trim().slice(0, 100));
      });
    });
  });
  /* shared scripts */
  ['auth.js', 'live-chat-notify.js', 'export.js', 'layout.js'].forEach((f) => {
    const js = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    if (/new XMLHttpRequest|sendBeacon|new EventSource/.test(js)) problems.push('js/' + f + ': bypasses fetch');
    if (f === 'export.js' && /API_BASE/.test(js)) problems.push('js/export.js calls the API (now needs review)');
  });
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  if (/API_BASE|fetch\s*\(/.test(idx)) problems.push('index.html calls the API (needs operator-session.js)');
  return { pages, problems };
}

module.exports = { check };

if (require.main === module) {
  const { pages, problems } = check();
  console.log('pages checked: ' + pages.length + ' (' + pages.join(', ') + ')');
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('OK: operator-session.js is included once, after config.js and before auth.js and page scripts, in every page; no fetch bypass outside the reviewed list.');
}
