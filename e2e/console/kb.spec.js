'use strict';
/* Knowledge Base page (pages/kb.html + js/kb-render.js + kb/index.json). Runs against e2e/console/server.js (ClockynConsole as it is + operator mock).
 *
 * The tests do not depend on the text of any article: they read kb/index.json at run time and pick documents from it. Fixture documents (a
 * hostile one with raw HTML and a javascript: link, one with internal links) are served through page.route, so nothing is written to the
 * repository. Screenshots: set KB_SHOTS_DIR to a folder and the landing / article / search / phone tests save PNGs there. */
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const R = require('../../ClockynConsole/js/kb-render.js');

const API = 'http://127.0.0.1:' + (process.env.CONSOLE_API_PORT || 8891);
const SHOTS = process.env.KB_SHOTS_DIR || '';
let INDEX = null;

async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); }

test.beforeAll(async ({ request, baseURL }) => {
  const r = await request.get(baseURL + '/kb/index.json');
  expect(r.ok(), 'kb/index.json must exist (run npm run kb:build)').toBeTruthy();
  INDEX = await r.json();
  expect(INDEX.docs.length).toBeGreaterThan(0);
});

test.beforeEach(async ({ page, request }) => {
  const r = await request.post(API + '/__op/state', { data: { reset: true } });
  expect(r.ok()).toBeTruthy();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
});

async function login(page, email = 'admin@clockyn.test') {
  await page.goto('/pages/login.html');
  await page.locator('#email').fill(email);
  await page.locator('#loginBtn').click();
  await expect(page.locator('#otpGroup')).toBeVisible();
  await page.locator('.otp-box').first().click();
  await page.keyboard.type('123456');
  await page.locator('#loginBtn').click();
  await page.waitForURL(/dashboard\.html$/);
}
async function openKb(page, hash = '') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await page.goto('/pages/kb.html' + hash);
  await expect(page.locator('#app-sidebar .nav-item').first()).toBeVisible();
  return errors;
}

/** Serve extra documents without touching the repository: kb/index.json gets their entries and their .md files are answered by routes. */
async function useFixtures(page, docs) {
  await page.route('**/kb/index.json', async (route) => {
    const res = await route.fetch();
    const idx = await res.json();
    docs.forEach((d) => {
      const cat = d.category || (idx.categories && idx.categories[0]) || 'Reference';
      if (idx.categories && !idx.categories.includes(cat)) idx.categories.push(cat);
      idx.docs.push({ id: d.id, title: d.title, summary: d.summary || 'A fixture document.', category: cat, audience: d.audience || 'all', tags: d.tags || [], page: d.page || '',
        updated: '2026-11-15', related: d.related || [], path: '_fixture/' + d.id + '.md', headings: [], words: 10, order: 9999 });
    });
    idx.count = idx.docs.length;
    await route.fulfill({ response: res, json: idx });
  });
  for (const d of docs) {
    await page.route('**/kb/_fixture/' + d.id + '.md', (route) => route.fulfill({ status: 200, contentType: 'text/markdown', body: d.md }));
  }
}

const bell = (page) => page.locator('.icon-btn[aria-label="Notifications"]').first();

/* ───────────────────────── the renderer (pure functions, no browser) ───────────────────────── */
test.describe('kb-render.js', () => {
  test('all HTML is escaped and only https / http / kb: links become links', () => {
    const out = R.render([
      '<script>alert(1)</script> and <img src=x onerror=alert(1)>',
      '',
      '[bad](javascript:alert(1)) [data](data:text/html,x) [rel](../pages/users.html) [ok](https://example.com/a?b=1&c=2) [plain](http://example.com) [kb](kb:welcome)',
      '',
      '```',
      '<b>not bold</b>',
      '```',
    ].join('\n'), { slug: 'x' }).html;
    expect(out).not.toMatch(/<(script|img)\b/);                          // no real tag: the text "onerror=" is only shown inside escaped text
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(out).not.toMatch(/href="javascript|href="data:|href="\.\.\//);
    expect(out).toContain('href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer"');
    expect(out).toContain('href="http://example.com" target="_blank" rel="noopener noreferrer"');
    expect(out).toContain('href="kb.html#welcome"');
    expect(out).toContain('&lt;b&gt;not bold&lt;/b&gt;');
    expect(out).toContain('bad data rel ');                           // the labels of the refused links stay as plain text
  });

  test('a double quote in a link target cannot break out of the attribute', () => {
    const out = R.render('[x](https://example.com/"onmouseover="alert(1))').html;
    expect(out).not.toMatch(/ onmouseover=/);
  });

  test('headings get stable unique ids, anchors and a heading list', () => {
    const r = R.render('## Same\n\ntext\n\n## Same\n\n### Sub\n', { slug: 'doc' });
    expect(r.headings.map((h) => h.id)).toEqual(['same', 'same-2', 'sub']);
    expect(r.headings.map((h) => h.level)).toEqual([2, 2, 3]);
    expect(r.html).toContain('<h2 id="same" class="kb-h2">');
    expect(r.html).toContain('href="#doc/same-2"');
  });

  test('lists (nested and numbered), tables, callouts and inline code', () => {
    const r = R.render([
      '1. One', '2. Two', '   - nested', '3. Three', '', '- a', '- b', '',
      '| A | B |', '| --- | --- |', '| `x` | **y** |', '',
      '> **Warning** Careful.', '', '> **Tip** Handy.',
    ].join('\n')).html;
    expect(r).toContain('<ol><li>One</li><li>Two<ul><li>nested</li></ul></li><li>Three</li></ol>');
    expect(r).toContain('<ul><li>a</li><li>b</li></ul>');
    expect(r).toContain('<th scope="col">A</th>');
    expect(r).toContain('<td><code>x</code></td><td><strong>y</strong></td>');
    expect(r).toMatch(/class="kb-callout kb-warning" role="note"><strong class="kb-callout-title">Warning<\/strong>/);
    expect(r).toContain('kb-tip');
  });

  test('front matter parses; sections() gives plain text per ## section for search', () => {
    const fm = R.parseFrontMatter('---\ntitle: T\ntags: a, b\n---\n\nIntro **bold**.\n\n## Sec one\n\nBody `code` [link](kb:x).\n');
    expect(fm.ok).toBe(true);
    expect(fm.meta).toEqual({ title: 'T', tags: 'a, b' });
    const s = R.sections(fm.body);
    expect(s[0].text).toBe('Intro bold.');
    expect(s[1]).toMatchObject({ id: 'sec-one', heading: 'Sec one', text: 'Body code link.' });
    expect(R.parseFrontMatter('no front matter').ok).toBe(false);
  });
});

/* ───────────────────────── navigation ───────────────────────── */
test('the sidebar has one Knowledge Base item (System section, before Settings), highlighted on kb.html', async ({ page }) => {
  const errors = await openKb(page);
  const labels = await page.locator('#app-sidebar .nav-label').allTextContents();
  expect(labels.filter((l) => l === 'Knowledge Base')).toHaveLength(1);
  expect(labels.indexOf('Knowledge Base')).toBe(labels.indexOf('Settings') - 1);
  const item = page.locator('#app-sidebar a.nav-item[href="kb.html"]');
  await expect(item).toHaveClass(/active/);
  await expect(item).toHaveAttribute('aria-current', 'page');
  expect(errors).toEqual([]);
});

test('the Knowledge Base item is on every other page but not highlighted there', async ({ page }) => {
  await login(page);
  await expect(page.locator('#app-sidebar a.nav-item[href="kb.html"]')).not.toHaveClass(/active/);
  await page.locator('#app-sidebar a.nav-item[href="kb.html"]').click();
  await page.waitForURL(/kb\.html$/);
  await expect(page.locator('#app-sidebar a.nav-item[href="kb.html"]')).toHaveClass(/active/);
});

/* ───────────────────────── landing ───────────────────────── */
test('the landing view lists every category and every article from index.json', async ({ page }) => {
  const errors = await openKb(page);
  await expect(page.locator('#kb-title')).toHaveText(/knowledge base/i);
  const cats = await page.locator('#kb-nav .kb-cat-title').allTextContents();
  expect(cats).toEqual(INDEX.categories);
  await expect(page.locator('#kb-nav a[data-slug]')).toHaveCount(INDEX.docs.length);
  await expect(page.locator('#kb-main .kb-grid .kb-card')).toHaveCount(INDEX.docs.length);
  const start = page.locator('#kb-main .kb-start .kb-card');
  const wanted = ['welcome', 'signing-in', 'console-tour', 'daily-checklist'].filter((s) => INDEX.docs.some((d) => d.id === s));
  await expect(start).toHaveCount(wanted.length);
  expect(await page.title()).toBe('Clockyn — Knowledge Base');
  await shot(page, 'kb-landing-desktop');
  expect(errors).toEqual([]);
});

/* ───────────────────────── an article ───────────────────────── */
test('a deep link opens the article: title, badges, table of contents, body, nav highlight, document title', async ({ page }) => {
  const doc = INDEX.docs.find((d) => d.headings.some((h) => h.level === 2)) || INDEX.docs[0];
  const errors = await openKb(page, '#' + doc.id);
  await expect(page.locator('#kb-title')).toHaveText(doc.title);
  await expect(page.locator('.kb-body')).not.toBeEmpty();
  await expect(page.locator('.kb-meta .badge').first()).toHaveText(doc.category);
  await expect(page.locator('.kb-lead')).toHaveText(doc.summary);
  const h2s = doc.headings.filter((h) => h.level === 2);
  if (h2s.length) {
    await expect(page.locator('.kb-toc a').first()).toHaveAttribute('href', '#' + doc.id + '/' + h2s[0].id);
    await expect(page.locator('.kb-body h2').first()).toHaveAttribute('id', h2s[0].id);
  }
  await expect(page.locator('#kb-nav a[aria-current="page"]')).toHaveText(doc.title);
  expect(await page.title()).toBe(doc.title + ' - Knowledge Base');
  await expect(page.locator('#kb-title')).toBeFocused();
  await shot(page, 'kb-article-desktop');
  expect(errors).toEqual([]);
});

test('a section deep link (#slug/section) scrolls to that heading', async ({ page }) => {
  const doc = INDEX.docs.find((d) => d.headings.filter((h) => h.level === 2).length >= 3 && d.words > 600);
  test.skip(!doc, 'no long article with three sections yet');
  const last = doc.headings.filter((h) => h.level === 2).pop();
  await openKb(page, '#' + doc.id + '/' + last.id);
  await expect(page.locator('#' + last.id)).toBeInViewport();
});

test('a topic that does not exist shows a clear message, and back/forward follow the hash', async ({ page }) => {
  await openKb(page, '#no-such-topic');
  await expect(page.locator('#kb-main .kb-state h2')).toHaveText(/does not exist/i);
  const [a, b] = INDEX.docs;
  await page.goto('/pages/kb.html#' + a.id);
  await expect(page.locator('#kb-title')).toHaveText(a.title);
  await page.locator('#kb-nav a[data-slug="' + b.id + '"]').click();
  await expect(page.locator('#kb-title')).toHaveText(b.title);
  await page.goBack();
  await expect(page.locator('#kb-title')).toHaveText(a.title);
  await page.goForward();
  await expect(page.locator('#kb-title')).toHaveText(b.title);
});

test('internal kb: links, related articles and previous / next navigate', async ({ page }) => {
  const [first, second] = INDEX.docs;
  await useFixtures(page, [{
    id: 'fixture-links', title: 'Fixture with links', related: [first.id],
    md: '---\ntitle: Fixture with links\n---\n\nSee [the second article](kb:' + second.id + ') and [the first](kb:' + first.id + ').\n\n## Section\n\nText.\n',
  }]);
  await openKb(page, '#fixture-links');
  await expect(page.locator('#kb-title')).toHaveText('Fixture with links');
  await expect(page.locator('.kb-related .kb-card')).toHaveCount(1);
  await page.locator('.kb-body a[href="kb.html#' + second.id + '"]').click();
  await expect(page.locator('#kb-title')).toHaveText(second.title);
  expect(new URL(page.url()).hash).toBe('#' + second.id);
  // previous / next stay inside the category
  const sameCat = INDEX.docs.filter((d) => d.category === second.category);
  if (sameCat.length > 1) {
    const at = sameCat.findIndex((d) => d.id === second.id);
    if (at < sameCat.length - 1) {
      await page.locator('.kb-pn a.next').click();
      await expect(page.locator('#kb-title')).toHaveText(sameCat[at + 1].title);
    }
  }
});

test('raw HTML and a javascript: link in a document are shown as inert text', async ({ page }) => {
  await useFixtures(page, [{
    id: 'fixture-xss', title: 'Fixture hostile',
    md: '---\ntitle: Fixture hostile\n---\n\nHello <script>window.__xss = 1</script><img src=x onerror="window.__xss = 2"> world.\n\n' +
      '[click me](javascript:window.__xss=3) and [outside](https://example.com/x).\n\n## <b onmouseover="window.__xss=4">Heading</b>\n\n```\n<script>window.__xss = 5</script>\n```\n',
  }]);
  const errors = await openKb(page, '#fixture-xss');
  await expect(page.locator('#kb-title')).toHaveText('Fixture hostile');
  await expect(page.locator('.kb-body')).toContainText('<script>window.__xss = 1</script>');
  await expect(page.locator('.kb-body script, .kb-body img, .kb-body b')).toHaveCount(0);
  await expect(page.locator('.kb-body a[href^="javascript"]')).toHaveCount(0);
  await expect(page.locator('.kb-body')).toContainText('click me');
  const out = page.locator('.kb-body a[href="https://example.com/x"]');
  await expect(out).toHaveAttribute('target', '_blank');
  expect(await out.getAttribute('rel')).toContain('noopener');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('a fenced code block has a working Copy button', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await useFixtures(page, [{ id: 'fixture-code', title: 'Fixture code', md: '---\ntitle: Fixture code\n---\n\nRun:\n\n```\nnpm run kb:check\n```\n' }]);
  await openKb(page, '#fixture-code');
  await page.locator('.kb-copy').click();
  await expect(page.locator('#toast')).toHaveText('Code copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npm run kb:check');
});

test('Copy link copies the article address', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const doc = INDEX.docs[0];
  await openKb(page, '#' + doc.id);
  await page.locator('#kb-copylink').click();
  await expect(page.locator('#toast')).toHaveText('Link copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp('/pages/kb\\.html#' + doc.id + '$'));
});

test('an article with a page: gets an Open this page link', async ({ page }) => {
  const doc = INDEX.docs.find((d) => d.page);
  test.skip(!doc, 'no article with a page yet');
  await openKb(page, '#' + doc.id);
  await expect(page.locator('.kb-actions a')).toHaveAttribute('href', doc.page);
});

/* ───────────────────────── search ───────────────────────── */
test('search finds an article by a word from the index; Enter or a click opens it', async ({ page }) => {
  const doc = INDEX.docs.find((d) => d.title.split(/\s+/).some((w) => w.replace(/\W/g, '').length >= 5)) || INDEX.docs[0];
  const word = doc.title.split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, '')).sort((a, b) => b.length - a.length)[0];
  const errors = await openKb(page);
  await page.locator('#kb-q').fill(word);
  await expect(page.locator('#kb-results .kb-result').first()).toBeVisible();
  const hrefs = await page.locator('#kb-results .kb-result a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(hrefs.some((h) => h.startsWith('#' + doc.id))).toBe(true);
  await expect(page.locator('#kb-results mark').first()).toBeVisible();
  await expect(page.locator('.kb-results-head')).toContainText('for “' + word + '”');
  await shot(page, 'kb-search-desktop');
  const firstHref = hrefs[0];
  await page.locator('#kb-q').press('Enter');
  await expect(page.locator('#kb-title')).toBeVisible();
  expect(new URL(page.url()).hash).toBe(firstHref);
  await expect(page.locator('#kb-q')).toHaveValue('');
  expect(errors).toEqual([]);
});

test('multi-word search is AND, results are ranked with a title match first, arrows move the selection', async ({ page }) => {
  const docs = INDEX.docs.filter((d) => d.title.split(/\s+/).length >= 2);
  test.skip(docs.length < 1, 'no multi-word titles');
  const doc = docs[0];
  const words = doc.title.split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, '')).filter((w) => w.length >= 3).slice(0, 2);
  await openKb(page);
  await page.locator('#kb-q').fill(words.join(' '));
  await expect(page.locator('#kb-results .kb-result').first()).toBeVisible();
  const hrefs = await page.locator('#kb-results .kb-result a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(hrefs.some((h) => h.startsWith('#' + doc.id))).toBe(true);
  const n = hrefs.length;
  await expect(page.locator('.kb-result.active')).toHaveCount(1);
  if (n > 1) {
    await page.locator('#kb-q').press('ArrowDown');
    await expect(page.locator('#kb-results .kb-result').nth(1)).toHaveClass(/active/);
    await page.locator('#kb-q').press('ArrowUp');
    await expect(page.locator('#kb-results .kb-result').nth(0)).toHaveClass(/active/);
  }
  // a nonsense extra word leaves nothing (every word must match)
  await page.locator('#kb-q').fill(words.join(' ') + ' zzzxqjkv');
  await expect(page.locator('#kb-main .kb-state h2')).toContainText('Nothing matches');
  await expect(page.locator('#kb-main .kb-state')).toContainText('console maintainers');
});

test('the / key focuses the search and Escape clears it and brings the page back', async ({ page }) => {
  const doc = INDEX.docs[0];
  await openKb(page, '#' + doc.id);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('/');
  await expect(page.locator('#kb-q')).toBeFocused();
  await page.keyboard.type('zzzxqjkv');
  await expect(page.locator('#kb-main .kb-state h2')).toContainText('Nothing matches');
  await page.keyboard.press('Escape');
  await expect(page.locator('#kb-q')).toHaveValue('');
  await expect(page.locator('#kb-title')).toHaveText(doc.title);
});

test('search results come from the article text too, not only titles', async ({ page, request, baseURL }) => {
  const doc = INDEX.docs[0];
  const md = await (await request.get(baseURL + '/kb/' + doc.path)).text();
  const body = md.replace(/^---[\s\S]*?---/, '');
  const word = (body.match(/\b[a-z]{9,14}\b/g) || []).find((w) => !doc.title.toLowerCase().includes(w) && !doc.summary.toLowerCase().includes(w) && !doc.tags.join(' ').includes(w));
  test.skip(!word, 'no body-only word found');
  await openKb(page);
  await page.locator('#kb-q').fill(word);
  await expect(page.locator('#kb-results .kb-result').first()).toBeVisible();
  const hrefs = await page.locator('#kb-results .kb-result a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(hrefs.some((h) => h.startsWith('#' + doc.id))).toBe(true);
});

/* ───────────────────────── audience filter ───────────────────────── */
test('the audience chips filter the topic list and are remembered', async ({ page }) => {
  await openKb(page);
  const allowed = {
    all: () => true,
    operator: (d) => d.audience === 'all' || d.audience === 'operator',
    super_admin: (d) => ['all', 'operator', 'super_admin'].includes(d.audience),
    maintainer: (d) => d.audience === 'all' || d.audience === 'maintainer',
  };
  for (const aud of ['operator', 'super_admin', 'maintainer', 'all']) {
    await page.locator('.kb-chips .chip[data-aud="' + aud + '"]').click();
    await expect(page.locator('.kb-chips .chip[data-aud="' + aud + '"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#kb-nav a[data-slug]')).toHaveCount(INDEX.docs.filter(allowed[aud]).length);
  }
  await page.locator('.kb-chips .chip[data-aud="maintainer"]').click();
  await page.reload();
  await expect(page.locator('.kb-chips .chip[data-aud="maintainer"]')).toHaveAttribute('aria-pressed', 'true');
});

/* ───────────────────────── failures ───────────────────────── */
test('index.json missing: a clear error with Try again, which recovers when the file is back', async ({ page }) => {
  await login(page);
  let broken = true;
  await page.route('**/kb/index.json', (route) => (broken ? route.fulfill({ status: 404, body: 'not found' }) : route.continue()));
  await page.goto('/pages/kb.html');
  await expect(page.locator('#kb-main [role="alert"] h2')).toHaveText(/could not be loaded/i);
  await expect(page.locator('#kb-retry')).toBeVisible();
  broken = false;
  await page.locator('#kb-retry').click();
  await expect(page.locator('#kb-nav a[data-slug]')).toHaveCount(INDEX.docs.length);
  await expect(page.locator('#kb-title')).toBeVisible();
});

test('one article file failing shows an error for it with Try again, and search still works on the rest', async ({ page }) => {
  const [a, b] = INDEX.docs;
  let broken = true;
  await page.route('**/kb/' + a.path, (route) => (broken ? route.fulfill({ status: 500, body: 'boom' }) : route.continue()));
  await openKb(page, '#' + a.id);
  await expect(page.locator('#kb-main [role="alert"] h2')).toHaveText(/could not be loaded/i);
  broken = false;
  await page.locator('#kb-retry').click();
  await expect(page.locator('#kb-title')).toHaveText(a.title);
  // now break it again and search: the notice appears, the other articles still match
  broken = true;
  await page.goto('/pages/kb.html');
  await page.locator('#kb-q').fill(b.title.split(/\s+/)[0]);
  await expect(page.locator('#kb-results .kb-result').first()).toBeVisible();
  await expect(page.locator('.kb-note-line')).toContainText('could not be read');
});

/* ───────────────────────── phone, shell ───────────────────────── */
test.describe('phone width (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('landing and an article have no horizontal overflow; topics collapse; the table of contents is collapsible', async ({ page }) => {
    const doc = INDEX.docs.find((d) => d.headings.some((h) => h.level === 2)) || INDEX.docs[0];
    await openKb(page);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await shot(page, 'kb-landing-phone');
    await page.goto('/pages/kb.html#' + doc.id);
    await expect(page.locator('#kb-title')).toHaveText(doc.title);
    expect(await overflow()).toBeLessThanOrEqual(0);
    expect(await page.locator('#kb-topics').evaluate((el) => el.open)).toBe(false);
    await page.locator('#kb-topics > summary').click();
    await expect(page.locator('#kb-nav a[data-slug]').first()).toBeVisible();
    await page.locator('#kb-nav a[data-slug]').nth(1).click();
    expect(await page.locator('#kb-topics').evaluate((el) => el.open)).toBe(false);
    await page.goto('/pages/kb.html#' + doc.id);
    const toc = page.locator('.kb-toc-inline .kb-toc');
    if (await toc.count()) {
      await expect(toc).not.toHaveAttribute('open', '');
      await toc.locator('summary').click();
      await expect(toc.locator('a').first()).toBeVisible();
    }
    await shot(page, 'kb-article-phone');
    expect(await overflow()).toBeLessThanOrEqual(0);
  });

  test('search results fit the phone screen', async ({ page }) => {
    await openKb(page);
    await page.locator('#kb-q').fill(INDEX.docs[0].title.split(/\s+/)[0]);
    await expect(page.locator('#kb-results .kb-result').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await shot(page, 'kb-search-phone');
  });
});

test('the bell and the floating chat button still work on kb.html', async ({ page, request }) => {
  const r = await request.post(API + '/gen-dashboard/__shell/state', { data: { reset: true, unread: 3, deletions: 2, suggestions: 1 } });
  expect(r.ok()).toBeTruthy();
  await openKb(page);
  await expect(page.locator('#ck-chat-fab')).toBeVisible();
  await expect(page.locator('#ck-chat-fab .nav-livechat-badge')).toHaveText('3');
  await bell(page).click();
  await expect(page.locator('#ck-bell-menu')).toBeVisible();
  await expect(page.locator('#ck-bell-menu a.ck-bell-row')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(page.locator('#ck-bell-menu')).toBeHidden();
  await page.locator('#ck-chat-fab').click();
  await expect(page.locator('#ck-chat-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ck-chat-panel')).toBeHidden();
});

test('dark theme: the article text stays readable (contrast of body text against the panel)', async ({ page }) => {
  await login(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => { try { localStorage.setItem('theme', 'dark'); } catch (_e) { /* ignore */ } });
  await page.goto('/pages/kb.html#' + INDEX.docs[0].id);
  await expect(page.locator('#kb-title')).toBeVisible();
  const colours = await page.evaluate(() => {
    const body = document.querySelector('.kb-body') || document.querySelector('.kb-panel');
    const panel = document.querySelector('.kb-panel');
    return { text: getComputedStyle(body).color, bg: getComputedStyle(panel).backgroundColor };
  });
  expect(colours.text).not.toBe(colours.bg);
});
