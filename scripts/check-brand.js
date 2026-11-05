#!/usr/bin/env node
/**
 * Brand guard: fails if any legacy product/vendor name appears anywhere in the Clockyn codebase
 * (source, config, docs, scripts, lockfile, file and folder names, and the text / metadata chunks of
 * binary assets such as PNGs).
 *
 * The legacy tokens are assembled from fragments so this script itself contains no literal match.
 * Usage: node scripts/check-brand.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const frag = (...p) => p.join('');
// Case-insensitive, separator-tolerant patterns for each legacy name.
const patterns = [
  new RegExp(frag('pun', 'ch', '[\\s_.-]*', 'app'), 'i'),
  new RegExp(frag('gen', 'ot'), 'i'),
  new RegExp(frag('gen', '[\\s_.-]*', 'sharp'), 'i'),
  new RegExp(frag('gen', '_', 'admin'), 'i'),
  new RegExp(frag('pa', '_', 'frontend'), 'i'),
  new RegExp(frag('pa', '_', 'backend'), 'i'),
];

const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', 'dist', 'web-build', 'android', 'ios', 'coverage', '.artifacts']);
const SELF = path.relative(root, __filename);
const MAX_BYTES = 25 * 1024 * 1024;

const hits = [];
function scanText(rel, text, kind = 'content') {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const re of patterns) {
      if (re.test(line)) hits.push(`${rel}:${i + 1}  [${kind}]  ${line.trim().slice(0, 140)}`);
    }
  });
}

/** PNG ancillary chunks (tEXt / iTXt / zTXt / eXIf / vendor chunks) can carry author, software or title strings. */
function scanPngChunks(rel, buf) {
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type !== 'IDAT' && type !== 'IHDR' && type !== 'IEND' && type !== 'PLTE') {
      scanText(rel, data.toString('latin1'), `png:${type}`);
      scanText(rel, data.toString('utf8'), `png:${type}`);
      // zTXt: keyword NUL method(1) <zlib>; iTXt (flag = 1): keyword NUL flag method lang NUL translated NUL <zlib>.
      const nul = data.indexOf(0);
      for (const offset of [nul + 2, nul + 3]) {
        if (nul < 0 || offset >= data.length) continue;
        try {
          scanText(rel, zlib.inflateSync(data.subarray(offset)).toString('utf8'), `png:${type}`);
        } catch {
          /* not compressed at this offset */
        }
      }
    }
    pos += 12 + len;
  }
}

/** Non-text files (images, fonts, archives...): look for the names as latin1 / UTF-16 byte strings. */
function scanBinary(rel, buf) {
  if (buf.length > 8 && buf.toString('latin1', 1, 4) === 'PNG') scanPngChunks(rel, buf);
  const views = [buf.toString('latin1'), buf.toString('utf16le'), buf.subarray(1).toString('utf16le')];
  for (const view of views) {
    for (const re of patterns) {
      const m = re.exec(view);
      if (m) hits.push(`${rel}  [binary]  ${JSON.stringify(m[0])}`);
    }
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full);
    for (const re of patterns) if (re.test(entry.name)) hits.push(`${rel}  [name]`);
    if (entry.isDirectory()) walk(full);
    else {
      if (rel === SELF) continue;
      try {
        if (fs.statSync(full).size > MAX_BYTES) continue;
        const buf = fs.readFileSync(full);
        if (buf.includes(0)) scanBinary(rel, buf);
        else scanText(rel, buf.toString('utf8')); // every extension, not a fixed list (.snap, .sh, .toml, ...)
      } catch {
        /* unreadable file - ignore */
      }
    }
  }
}
walk(root);

if (hits.length) {
  console.error(`Brand check FAILED - ${hits.length} legacy-name reference(s):`);
  hits.slice(0, 200).forEach((h) => console.error('  ' + h));
  process.exit(1);
}
console.log('Brand check passed: no legacy names found.');
