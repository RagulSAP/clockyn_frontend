#!/usr/bin/env node
'use strict';
/**
 * Builds the Knowledge Base index of the ClockynConsole and, on request, a copy for AWS Bedrock.
 *
 *   node scripts/build-kb.js                 write ClockynConsole/kb/index.json (the console reads it)
 *   node scripts/build-kb.js --check         fail (exit 1) when the committed index.json is stale; writes nothing
 *   node scripts/build-kb.js --out kb-dist   ALSO export every document with a sidecar `<file>.md.metadata.json`
 *                                            (the metadata-file convention of a Bedrock Knowledge Base S3 data source)
 *
 * The index is deterministic (no timestamps), so an unchanged Knowledge Base gives a byte-identical file.
 * Zero dependencies. The format is described in ClockynConsole/kb/README.md.
 */
const fs = require('fs');
const path = require('path');
const lib = require('./kb-lib');

const SIDECAR_LIMIT = 10 * 1024;      // a metadata file must stay under 10 KB

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : null;
}

/** Remove only what this script generates (.md and .md.metadata.json files) from a previous export, then empty folders. */
function clearExport(dir) {
  if (!fs.existsSync(dir)) return;
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); if (!fs.readdirSync(p).length) fs.rmdirSync(p); }
      else if (/\.md$|\.md\.metadata\.json$/.test(e.name)) fs.unlinkSync(p);
    });
  })(dir);
}

function sidecar(doc) {
  const attrs = {
    title: doc.title,
    slug: doc.id,
    category: doc.category,
    audience: doc.audience,
    page: doc.page,
    updated: doc.updated,
    tags: doc.tags.join(', '),
    summary: doc.summary,
    link: 'kb.html#' + doc.id,
  };
  const metadataAttributes = {};
  Object.keys(attrs).forEach((k) => { if (attrs[k]) metadataAttributes[k] = String(attrs[k]); });
  const json = JSON.stringify({ metadataAttributes }, null, 2) + '\n';
  if (Buffer.byteLength(json) >= SIDECAR_LIMIT) throw new Error('metadata of ' + doc.id + ' is ' + Buffer.byteLength(json) + ' bytes (limit 10 KB)');
  return json;
}

function exportForBedrock(index, outDir) {
  const out = path.resolve(lib.ROOT, outDir);
  if (out === lib.ROOT || out === lib.KB_DIR || out === lib.CONSOLE_DIR || !out.startsWith(lib.ROOT)) {
    throw new Error('refusing to export to ' + out + ': use a folder inside the repository such as kb-dist');
  }
  clearExport(out);
  index.docs.forEach((doc) => {
    const target = path.join(out, doc.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(lib.KB_DIR, doc.path), target);
    fs.writeFileSync(target + '.metadata.json', sidecar(doc), 'utf8');
  });
  return out;
}

function main() {
  const index = lib.buildIndex();
  const summary = index.count + ' documents, ' + index.docs.reduce((n, d) => n + d.words, 0) + ' words, ' + index.categories.length + ' categories';

  if (arg('--check')) {
    const r = lib.indexIsFresh(index);
    if (!r.fresh) { console.error('KB index check FAILED: ' + r.reason + '. Run: npm run kb:build'); process.exit(1); }
    console.log('KB index is up to date (' + summary + ').');
    return;
  }

  fs.mkdirSync(lib.KB_DIR, { recursive: true });
  fs.writeFileSync(lib.INDEX_FILE, lib.serialiseIndex(index), 'utf8');
  console.log('Wrote ' + path.relative(lib.ROOT, lib.INDEX_FILE) + ' (' + summary + ').');

  const out = arg('--out');
  if (out) {
    if (out === true) throw new Error('--out needs a folder, for example: --out kb-dist');
    const dir = exportForBedrock(index, out);
    const rel = path.relative(lib.ROOT, dir).replace(/\\/g, '/');
    console.log('Exported ' + index.count + ' documents with metadata files to ' + rel + '/');
    console.log('Upload (replace <bucket>):  aws s3 sync ' + rel + ' s3://<bucket>/clockyn-console-kb/ --delete');
    console.log('Then start an ingestion job for the Bedrock Knowledge Base data source.');
  }
}

try { main(); } catch (e) { console.error('build-kb failed: ' + e.message); process.exit(1); }
