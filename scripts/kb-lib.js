'use strict';
/**
 * Shared helpers of scripts/build-kb.js and scripts/check-kb.js: where the Knowledge Base lives, how a document is parsed and how
 * index.json is built. Zero dependencies. The front-end renderer (ClockynConsole/js/kb-render.js) parses the same format.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONSOLE_DIR = path.join(ROOT, 'ClockynConsole');
const KB_DIR = path.join(CONSOLE_DIR, 'kb');
const PAGES_DIR = path.join(CONSOLE_DIR, 'pages');
const INDEX_FILE = path.join(KB_DIR, 'index.json');

/** Directory name -> category label (the contract). The order here is the order of the categories in the console. */
const CATEGORY_BY_DIR = {
  'getting-started': 'Getting started',
  operations: 'Operations',
  billing: 'Billing & growth',
  support: 'Support',
  reference: 'Reference',
  maintainers: 'Maintainers',
};
const CATEGORIES = Object.values(CATEGORY_BY_DIR);
const AUDIENCES = ['all', 'operator', 'super_admin', 'maintainer'];
const REQUIRED_KEYS = ['title', 'summary', 'category', 'audience', 'tags', 'updated'];

/** The order of the documents inside a category: these slugs first (in this order), every other slug after them, A to Z. */
const SLUG_ORDER = [
  'welcome', 'signing-in', 'roles-and-permissions', 'console-tour', 'daily-checklist',
  'glossary', 'troubleshooting', 'settings-page',
  'dashboard', 'organizations', 'organization-analytics', 'users', 'account-deletion-requests',
  'subscriptions-and-plans', 'payments', 'coupons', 'referrals-c2c', 'referrals-b2c', 'b2c-commission-and-payouts',
  'suggestions', 'tickets-and-bugs', 'live-chat', 'video-hub', 'video-views', 'faq-hub', 'clickstream',
  'how-the-console-works', 'running-and-testing-locally', 'deploying-the-console', 'adding-a-page', 'api-map', 'security-settings',
];

/** Front matter: `---` line, `key: value` lines, `---` line. Returns { meta, body, ok, error }. */
function parseFrontMatter(text) {
  const src = String(text).replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  if (lines[0].trim() !== '---') return { meta: {}, body: src, ok: false, error: 'the file does not start with a --- front matter line' };
  let end = -1;
  for (let i = 1; i < lines.length; i++) if (lines[i].trim() === '---') { end = i; break; }
  if (end < 0) return { meta: {}, body: src, ok: false, error: 'the front matter is not closed with a second --- line' };
  const meta = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) return { meta, body: '', ok: false, error: 'front matter line ' + (i + 1) + ' is not "key: value": ' + line.slice(0, 60) };
    meta[m[1]] = m[2].trim();
  }
  return { meta, body: lines.slice(end + 1).join('\n').replace(/^\n+/, ''), ok: true, error: '' };
}

function splitList(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function slugifyHeading(text) {
  const s = String(text)
    .replace(/`([^`]*)`/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'section';
}

/** Lines outside fenced code blocks: [{ n, text }] (n is 1-based inside the body). */
function proseLines(body) {
  const out = [];
  let fenced = false;
  String(body).split('\n').forEach((text, i) => {
    if (/^\s*```/.test(text)) { fenced = !fenced; return; }
    if (!fenced) out.push({ n: i + 1, text });
  });
  return out;
}

/** The ## and ### headings of a body (ids unique inside the document, same algorithm as the renderer). */
function extractHeadings(body) {
  const seen = {};
  const out = [];
  proseLines(body).forEach(({ text }) => {
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(text);
    if (!m) return;
    const level = m[1].length;
    if (level !== 2 && level !== 3) return;
    const label = m[2].replace(/\*\*|`/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
    let id = slugifyHeading(label);
    if (seen[id]) { seen[id] += 1; id = id + '-' + seen[id]; } else seen[id] = 1;
    out.push({ level, text: label, id });
  });
  return out;
}

function wordCount(body) {
  const t = String(body).replace(/```[\s\S]*?```/g, ' ').replace(/[#>*|`_-]+/g, ' ').trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Every document file: [{ dir, file, slug, rel, abs, text }] (directories starting with "_" are fixtures and are ignored). */
function listDocuments() {
  const out = [];
  if (!fs.existsSync(KB_DIR)) return out;
  fs.readdirSync(KB_DIR, { withFileTypes: true }).forEach((d) => {
    if (!d.isDirectory() || d.name.startsWith('_') || d.name.startsWith('.')) return;
    const dir = path.join(KB_DIR, d.name);
    fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().forEach((f) => {
      const abs = path.join(dir, f);
      out.push({ dir: d.name, file: f, slug: f.replace(/\.md$/, ''), rel: d.name + '/' + f, abs, text: fs.readFileSync(abs, 'utf8') });
    });
  });
  return out;
}

function orderKey(slug) {
  const i = SLUG_ORDER.indexOf(slug);
  return i >= 0 ? i : 1000;
}

/** The documents of index.json, sorted for the console (category order, contract slug order, then A to Z). */
function buildIndex(files) {
  const docs = [];
  (files || listDocuments()).forEach((f) => {
    const fm = parseFrontMatter(f.text);
    const m = fm.meta;
    docs.push({
      id: f.slug,
      title: m.title || f.slug,
      summary: m.summary || '',
      category: CATEGORY_BY_DIR[f.dir] || m.category || '',
      audience: m.audience || 'all',
      tags: splitList(m.tags).map((t) => t.toLowerCase()),
      page: m.page || '',
      updated: m.updated || '',
      related: splitList(m.related),
      path: f.rel,
      headings: extractHeadings(fm.body),
      words: wordCount(fm.body),
      order: 0,
    });
  });
  docs.sort((a, b) => {
    const ca = CATEGORIES.indexOf(a.category), cb = CATEGORIES.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    const oa = orderKey(a.id), ob = orderKey(b.id);
    if (oa !== ob) return oa - ob;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  docs.forEach((d, i) => { d.order = i + 1; });
  const dates = docs.map((d) => d.updated).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return {
    /* deterministic on purpose (the newest "updated" date): an unchanged KB gives a byte-identical index.json, so --check works */
    generated: dates.length ? dates[dates.length - 1] : '',
    count: docs.length,
    categories: CATEGORIES.filter((c) => docs.some((d) => d.category === c)),
    docs,
  };
}

function serialiseIndex(index) {
  return JSON.stringify(index, null, 2) + '\n';
}

function indexIsFresh(index) {
  if (!fs.existsSync(INDEX_FILE)) return { fresh: false, reason: 'kb/index.json does not exist' };
  const onDisk = fs.readFileSync(INDEX_FILE, 'utf8').replace(/\r\n/g, '\n');
  if (onDisk !== serialiseIndex(index)) return { fresh: false, reason: 'kb/index.json is out of date' };
  return { fresh: true, reason: '' };
}

module.exports = {
  ROOT, CONSOLE_DIR, KB_DIR, PAGES_DIR, INDEX_FILE, CATEGORY_BY_DIR, CATEGORIES, AUDIENCES, REQUIRED_KEYS, SLUG_ORDER,
  parseFrontMatter, splitList, slugifyHeading, proseLines, extractHeadings, wordCount, listDocuments, buildIndex, serialiseIndex,
  indexIsFresh,
};
