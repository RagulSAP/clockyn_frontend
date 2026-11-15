#!/usr/bin/env node
'use strict';
/**
 * Quality gate of the ClockynConsole Knowledge Base (ClockynConsole/kb/<dir>/<slug>.md). Exit code 1 on any ERROR; WARN lines are advice.
 *
 *   node scripts/check-kb.js
 *
 * Rules: front matter complete and valid; slug = file name and unique; sizes (title, summary, words); no H1; headings only ## and ###
 * without skipping; fences closed; links https or kb:slug and resolving; no raw HTML; no secrets, TODO or lorem; every page-topic file has
 * "Common questions" and "What can go wrong"; every console page has a document (coverage); kb/index.json is not stale.
 * Directories starting with an underscore are ignored. Zero dependencies.
 */
const fs = require('fs');
const lib = require('./kb-lib');

const errors = [];
const warns = [];
const err = (rel, msg) => errors.push(rel + ': ' + msg);
const warn = (rel, msg) => warns.push(rel + ': ' + msg);

/** Pages that do not need a document: the sign-in screen (covered by "signing-in" when it sets page:) and this Knowledge Base page. */
const COVERAGE_EXEMPT = new Set(['login.html', 'kb.html']);

function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

/** Body text without fenced blocks and without inline code spans (for the link / HTML / heading rules). */
function prose(body) {
  return lib.proseLines(body).map((l) => ({ n: l.n, text: l.text.replace(/`[^`]*`/g, '``') }));
}

function checkDocument(f, slugs, pageFiles) {
  const rel = 'kb/' + f.rel;
  const fm = lib.parseFrontMatter(f.text);
  if (!fm.ok) { err(rel, fm.error); return null; }
  const m = fm.meta;

  lib.REQUIRED_KEYS.forEach((k) => { if (!m[k]) err(rel, 'front matter key "' + k + '" is missing or empty'); });
  const known = new Set(lib.REQUIRED_KEYS.concat(['page', 'related']));
  Object.keys(m).forEach((k) => { if (!known.has(k)) warn(rel, 'unknown front matter key "' + k + '" (ignored)'); });

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug)) err(rel, 'file name must be a kebab-case slug (a-z, 0-9, hyphens)');
  const want = lib.CATEGORY_BY_DIR[f.dir];
  if (m.category && m.category !== want) err(rel, 'category "' + m.category + '" does not match the directory (' + f.dir + ' = "' + want + '")');
  if (m.audience && !lib.AUDIENCES.includes(m.audience)) err(rel, 'audience "' + m.audience + '" must be one of ' + lib.AUDIENCES.join(', '));
  if (m.tags && !lib.splitList(m.tags).length) err(rel, 'tags must list at least one tag');
  if (m.tags && /[A-Z]/.test(m.tags)) warn(rel, 'tags should be lower-case');
  if (m.updated && !isRealDate(m.updated)) err(rel, 'updated "' + m.updated + '" is not a real date (YYYY-MM-DD)');
  if (m.title && m.title.length > 80) err(rel, 'title is ' + m.title.length + ' characters (max 80)');
  if (m.summary && m.summary.length > 200) err(rel, 'summary is ' + m.summary.length + ' characters (max 200)');
  if (m.page) {
    if (!/^[a-z0-9_]+\.html$/.test(m.page)) err(rel, 'page "' + m.page + '" must be a console page file name such as referrals.html');
    else if (!pageFiles.includes(m.page)) err(rel, 'page "' + m.page + '" does not exist in ClockynConsole/pages');
  }
  lib.splitList(m.related).forEach((s) => {
    if (s === f.slug) err(rel, 'related lists the document itself');
    else if (!slugs.has(s)) err(rel, 'related slug "' + s + '" does not exist');
  });

  const body = fm.body;
  const words = lib.wordCount(body);
  if (words < 250) err(rel, words + ' words (minimum 250)');
  else if (words < 300) warn(rel, words + ' words (aim for 300 to 1000)');
  if (words > 1200) err(rel, words + ' words (maximum 1200)');
  else if (words > 1000) warn(rel, words + ' words (aim for under 1000; consider splitting)');

  const fences = body.split('\n').filter((l) => /^\s*```/.test(l)).length;
  if (fences % 2) err(rel, 'a fenced code block is not closed');

  // headings
  let sawH2 = false;
  prose(body).forEach(({ n, text }) => {
    const h = /^(#{1,6})\s+\S/.exec(text);
    if (!h) return;
    const level = h[1].length;
    if (level === 1) err(rel, 'line ' + n + ': "# " heading in the body (the title comes from the front matter)');
    else if (level > 3) err(rel, 'line ' + n + ': only ## and ### headings are supported');
    else if (level === 2) sawH2 = true;
    else if (!sawH2) err(rel, 'line ' + n + ': ### heading before any ## heading (headings must not skip a level)');
  });
  if (!lib.extractHeadings(body).some((h) => h.level === 2)) err(rel, 'no ## section at all');

  // links and raw HTML
  prose(body).forEach(({ n, text }) => {
    const re = /\[([^\]]*)\]\(([^)\s]*)\)/g;
    let mm;
    while ((mm = re.exec(text))) {
      const target = mm[2];
      if (/^kb:/.test(target)) {
        const slug = target.slice(3);
        if (!slugs.has(slug)) err(rel, 'line ' + n + ': link to unknown document "' + target + '"');
      } else if (/^https:\/\//i.test(target)) {
        /* ok */
      } else if (/^http:\/\//i.test(target)) {
        err(rel, 'line ' + n + ': external link must be https: ' + target.slice(0, 60));
      } else {
        err(rel, 'line ' + n + ': only https: and kb:slug links are allowed: ' + target.slice(0, 60));
      }
    }
    if (/<\/?[A-Za-z][^>]*>/.test(text)) err(rel, 'line ' + n + ': raw HTML is not allowed (it is shown as text): ' + text.trim().slice(0, 60));
  });

  // secrets and leftovers (checked on the whole body, code blocks included)
  const noUrls = body.replace(/https?:\/\/\S+/g, ' ');
  const secrets = [
    [/AKIA[0-9A-Z]{16}/, 'an AWS access key id'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
    [/\bpassword\s*[:=]/i, '"password:" (never write a password)'],
    [/\b[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9+/=])/, 'a long token-like string'],
    [/\b[a-fA-F0-9]{32,}\b/, 'a long hex string'],
  ];
  secrets.forEach(([re, what]) => { if (re.test(noUrls)) err(rel, 'looks like it contains ' + what); });
  if (/\b(TODO|FIXME|TBD)\b|lorem ipsum/i.test(body)) err(rel, 'contains TODO / FIXME / TBD / lorem ipsum');

  // page-topic files
  if (m.page) {
    const heads = lib.extractHeadings(body).filter((h) => h.level === 2).map((h) => h.text.toLowerCase());
    if (!heads.includes('common questions')) err(rel, 'a page-topic document (page: set) needs a "## Common questions" section');
    if (!heads.includes('what can go wrong')) err(rel, 'a page-topic document (page: set) needs a "## What can go wrong" section');
    const questions = lib.extractHeadings(body).filter((h) => h.level === 3).length;
    if (questions < 4) warn(rel, 'only ' + questions + ' ### questions (aim for 4 to 8 under Common questions)');
  }

  // a section that is very long does not stand alone for retrieval
  const sections = body.split(/^## /m).slice(1);
  sections.forEach((s) => {
    const w = lib.wordCount(s);
    if (w > 600) warn(rel, 'the section "' + s.split('\n')[0].trim().slice(0, 40) + '" has ' + w + ' words (keep sections under about 400 for search)');
  });
  return { rel, words, category: want, page: m.page || '' };
}

function main() {
  const files = lib.listDocuments();
  if (!files.length) err('kb', 'no documents found under ClockynConsole/kb/<dir>/*.md');

  const seen = {};
  files.forEach((f) => { (seen[f.slug] = seen[f.slug] || []).push(f.rel); });
  Object.keys(seen).forEach((s) => { if (seen[s].length > 1) err('kb', 'slug "' + s + '" is used by more than one file: ' + seen[s].join(', ')); });
  const slugs = new Set(Object.keys(seen));
  const pageFiles = fs.existsSync(lib.PAGES_DIR) ? fs.readdirSync(lib.PAGES_DIR).filter((p) => p.endsWith('.html')).sort() : [];

  const results = files.map((f) => checkDocument(f, slugs, pageFiles)).filter(Boolean);

  const titles = {};
  files.forEach((f) => {
    const t = (lib.parseFrontMatter(f.text).meta.title || '').toLowerCase();
    if (t) (titles[t] = titles[t] || []).push(f.slug);
  });
  Object.keys(titles).forEach((t) => { if (titles[t].length > 1) warn('kb', 'the title "' + t + '" is used by ' + titles[t].join(', ')); });

  // coverage: every console page has a document
  const covered = new Set(results.map((r) => r.page).filter(Boolean));
  const missing = pageFiles.filter((p) => !COVERAGE_EXEMPT.has(p) && !covered.has(p));
  if (missing.length) err('coverage', missing.length + ' console page(s) have no document with a matching "page:": ' + missing.join(', '));

  // the generated index
  const fresh = lib.indexIsFresh(lib.buildIndex(files));
  if (!fresh.fresh) err('kb/index.json', fresh.reason + '. Run: npm run kb:build');

  // report
  const byCat = {};
  results.forEach((r) => { const c = byCat[r.category] || (byCat[r.category] = { docs: 0, words: 0 }); c.docs += 1; c.words += r.words; });
  console.log('Knowledge Base check');
  console.log('  ' + 'category'.padEnd(20) + 'docs'.padStart(5) + 'words'.padStart(8));
  lib.CATEGORIES.forEach((c) => {
    if (byCat[c]) console.log('  ' + c.padEnd(20) + String(byCat[c].docs).padStart(5) + String(byCat[c].words).padStart(8));
  });
  const totalDocs = results.length, totalWords = results.reduce((n, r) => n + r.words, 0);
  console.log('  ' + 'TOTAL'.padEnd(20) + String(totalDocs).padStart(5) + String(totalWords).padStart(8));
  const needDoc = pageFiles.filter((p) => !COVERAGE_EXEMPT.has(p));
  console.log('  console pages covered: ' + (needDoc.length - missing.length) + ' of ' + needDoc.length + ' (login.html and kb.html need no document)');

  warns.forEach((w) => console.warn('WARN  ' + w));
  if (errors.length) {
    errors.forEach((e) => console.error('ERROR ' + e));
    console.error('KB check FAILED: ' + errors.length + ' error(s), ' + warns.length + ' warning(s).');
    process.exit(1);
  }
  console.log('KB check passed: ' + totalDocs + ' documents, ' + warns.length + ' warning(s).');
}

main();
