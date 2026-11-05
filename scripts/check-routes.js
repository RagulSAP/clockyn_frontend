#!/usr/bin/env node
/**
 * Route gate: every route string in `src/config/routes.ts` must resolve to a route file under `src/app`
 * (expo-router conventions: `(group)` folders are transparent, `index` = folder root, `[param]` / `[...rest]`
 * are dynamic). Also lists route files that no registry entry points to.
 *
 * Usage: node scripts/check-routes.js [--allow-missing] [--strict] [--quiet]
 *   --allow-missing  report missing route files but exit 0 (integration phase, while feature builders are still landing)
 *   --strict         also fail when route files exist that are not registered in routes.ts
 *   --quiet          print only problems
 *
 * Exit codes: 0 ok; 1 missing route files (unless --allow-missing), duplicate URLs, or (with --strict) unregistered files.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appDir = path.join(root, 'src', 'app');
const routesFile = path.join(root, 'src', 'config', 'routes.ts');

const args = new Set(process.argv.slice(2));
const allowMissing = args.has('--allow-missing');
const strict = args.has('--strict');
const quiet = args.has('--quiet');

const ROUTE_EXT = /\.(tsx|ts|jsx|js)$/;
/** Files that are not routes themselves. */
const isSpecialFile = (base) => base === '_layout' || base.startsWith('+') || base.startsWith('_');

/** Strip comments, keeping string literals intact (so `//` inside a URL string is not a comment). */
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i += 1;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += src[i];
        i += 1;
      }
      out += src[i] ?? '';
      i += 1;
    } else if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

/** All route strings (values starting with `/`) declared inside the `routes` object. */
function readRegistry() {
  const raw = fs.readFileSync(routesFile, 'utf8');
  const code = stripComments(raw);
  const start = code.indexOf('export const routes');
  const end = code.indexOf('} as const', start);
  if (start === -1 || end === -1) {
    console.error('check-routes: could not find `export const routes = { ... } as const` in src/config/routes.ts');
    process.exit(2);
  }
  const block = code.slice(start, end);
  const found = [];
  const re = /'(\/[^']*)'|"(\/[^"]*)"/g;
  let m;
  while ((m = re.exec(block))) found.push(m[1] ?? m[2]);
  return [...new Set(found)];
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (ROUTE_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

/** `src/app/admin/(tabs)/home.tsx` -> `/admin/home`; `.../staff/index.tsx` -> `/admin/staff`. null for non-route files. */
function urlOf(file) {
  const rel = path.relative(appDir, file).split(path.sep);
  const base = rel[rel.length - 1].replace(ROUTE_EXT, '');
  if (isSpecialFile(base)) return null;
  const segs = rel.slice(0, -1).concat(base).filter((s) => !/^\(.*\)$/.test(s));
  if (segs[segs.length - 1] === 'index') segs.pop();
  return '/' + segs.join('/');
}

const isDynamic = (url) => /\[[^\]]+\]/.test(url);
function dynamicRegex(url) {
  const pattern = url
    .split('/')
    .map((seg) => {
      if (/^\[\.\.\..+\]$/.test(seg)) return '.+';
      if (/^\[.+\]$/.test(seg)) return '[^/]+';
      return seg.replace(/[.*+?^${}()|\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${pattern}$`);
}

const registry = readRegistry();
const files = walk(appDir)
  .map((f) => ({ file: f, url: urlOf(f) }))
  .filter((f) => f.url !== null);

// duplicates (two files for one URL)
const byUrl = new Map();
for (const f of files) byUrl.set(f.url, [...(byUrl.get(f.url) ?? []), f.file]);
const duplicates = [...byUrl.entries()].filter(([, list]) => list.length > 1);

const staticFiles = files.filter((f) => !isDynamic(f.url));
const dynamicFiles = files.filter((f) => isDynamic(f.url)).map((f) => ({ ...f, re: dynamicRegex(f.url) }));

const resolves = (route) => byUrl.has(route) || dynamicFiles.some((d) => d.re.test(route));
const missing = registry.filter((r) => !resolves(r));

const registered = new Set(registry);
const unregistered = [
  ...staticFiles.filter((f) => !registered.has(f.url)),
  ...dynamicFiles.filter((d) => !registry.some((r) => d.re.test(r))),
].map((f) => path.relative(root, f.file).split(path.sep).join('/'));

const rel = (p) => path.relative(root, p).split(path.sep).join('/');

if (!quiet) {
  console.log(`check-routes: ${registry.length} registered routes, ${files.length} route files under src/app`);
}
if (duplicates.length) {
  console.error(`\nDuplicate route files (same URL):`);
  for (const [url, list] of duplicates) console.error(`  ${url}\n    ${list.map(rel).join('\n    ')}`);
}
if (missing.length) {
  console.error(`\nMissing route files (${missing.length}) — registered in routes.ts but no file under src/app:`);
  missing.forEach((r) => console.error(`  ${r}`));
}
if (unregistered.length) {
  const log = strict ? console.error : console.warn;
  log(`\nRoute files not registered in routes.ts (${unregistered.length}):`);
  unregistered.forEach((f) => log(`  ${f}`));
}

let failed = false;
if (duplicates.length) failed = true;
if (missing.length && !allowMissing) failed = true;
if (strict && unregistered.length) failed = true;

if (failed) {
  console.error('\ncheck-routes FAILED');
  process.exit(1);
}
if (missing.length && allowMissing) console.warn('\ncheck-routes: missing routes tolerated (--allow-missing)');
if (!quiet) console.log('check-routes passed');
