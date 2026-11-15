/* Knowledge Base renderer: the small Markdown subset of the ClockynConsole KB (see kb/README.md), with no dependencies.
 *
 * SAFETY: all HTML is escaped first, so raw HTML in a document is shown as text and never runs. A link is rendered only when its target
 * is `kb:slug`, `https://...` or `http://...`; any other target (javascript:, data:, relative paths) leaves the plain label text.
 * External links get target="_blank" rel="noopener noreferrer".
 *
 * API (window.KbRender in the browser, module.exports in Node):
 *   parseFrontMatter(text) -> { meta, body, ok, error }
 *   render(body, { slug }) -> { html, headings: [{ level, text, id }] }     ## and ### only (a # heading is shown as ##, #### as ###)
 *   sections(body)         -> [{ id, heading, level, text }]                plain text per section, for search (first item = the introduction)
 *   stripInline(text)      -> plain text of one line of Markdown
 *   linkTarget(target)     -> { href, external } | null
 *   esc(text), slugify(text)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KbRender = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function slugify(text) {
    var s = String(text)
      .replace(/`([^`]*)`/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_]/g, '')
      .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'section';
  }

  function uniqueId(label, seen) {
    var id = slugify(label);
    if (seen[id]) { seen[id] += 1; id = id + '-' + seen[id]; } else seen[id] = 1;
    return id;
  }

  function parseFrontMatter(text) {
    var src = String(text).replace(/^﻿/, '').replace(/\r\n/g, '\n');
    var lines = src.split('\n');
    if (lines[0].trim() !== '---') return { meta: {}, body: src, ok: false, error: 'no front matter' };
    var end = -1;
    for (var i = 1; i < lines.length; i++) if (lines[i].trim() === '---') { end = i; break; }
    if (end < 0) return { meta: {}, body: src, ok: false, error: 'front matter is not closed' };
    var meta = {};
    for (var j = 1; j < end; j++) {
      var m = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(lines[j]);
      if (m) meta[m[1]] = m[2].trim();
    }
    return { meta: meta, body: lines.slice(end + 1).join('\n').replace(/^\n+/, ''), ok: true, error: '' };
  }

  /* ── links ── */
  function linkTarget(target) {
    var t = String(target || '').trim();
    var k = /^kb:([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(t);
    if (k) return { href: 'kb.html#' + k[1], external: false };
    if (/^https?:\/\/[^\s<>"']+$/i.test(t)) return { href: t, external: true };
    return null;
  }

  /* ── inline ── */
  function emphasis(escaped) {
    return escaped
      .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  }

  function inline(raw) {
    var stash = [];
    function keep(html) { stash.push(html); return '\u0000' + (stash.length - 1) + '\u0000'; }
    var s = String(raw);
    s = s.replace(/`([^`\n]+)`/g, function (_, code) { return keep('<code>' + esc(code) + '</code>'); });
    s = s.replace(/\[([^\]\n]*)\]\(((?:[^()\s]|\([^()\s]*\))*)\)/g, function (_, label, target) {
      var t = linkTarget(target);
      var text = emphasis(esc(label));
      if (!t) return keep(text);                                   // not an allowed target: the label stays, inert
      var attrs = t.external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return keep('<a href="' + esc(t.href) + '"' + attrs + '>' + text + '</a>');
    });
    s = emphasis(esc(s));
    for (var pass = 0; pass < 3 && /\u0000\d+\u0000/.test(s); pass++) {
      s = s.replace(/\u0000(\d+)\u0000/g, function (_, n) { return stash[+n] || ''; });
    }
    return s;
  }

  function stripInline(text) {
    return String(text)
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\*\*|__/g, '').replace(/(^|\s)\*([^*\s][^*]*)\*/g, '$1$2')
      .replace(/^\s*>\s?/, '').replace(/^\s*([-*]|\d+\.)\s+/, '')
      .replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ── blocks ── */
  var FENCE = /^\s*```\s*([A-Za-z0-9_+-]*)\s*$/;
  var HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
  var LIST = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
  var TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

  function splitRow(line) {
    var t = line.trim().replace(/\\\|/g, '\u0001');
    if (t.charAt(0) === '|') t = t.slice(1);
    if (t.charAt(t.length - 1) === '|') t = t.slice(0, -1);
    return t.split('|').map(function (c) { return c.replace(/\u0001/g, '|').trim(); });
  }

  function indentOf(ws) { return ws.replace(/\t/g, '  ').length; }

  function buildList(items, idx, indent) {
    var ordered = items[idx].ordered;
    var tag = ordered ? 'ol' : 'ul';
    var start = ordered && items[idx].number && items[idx].number !== 1 ? ' start="' + items[idx].number + '"' : '';
    var html = '<' + tag + start + '>';
    while (idx < items.length && items[idx].indent === indent && items[idx].ordered === ordered) {
      html += '<li>' + inline(items[idx].text);
      idx++;
      if (idx < items.length && items[idx].indent > indent) {
        var child = buildList(items, idx, items[idx].indent);
        html += child.html;
        idx = child.next;
      }
      html += '</li>';
    }
    return { html: html + '</' + tag + '>', next: idx };
  }

  function isBlockStart(lines, i) {
    var l = lines[i];
    return FENCE.test(l) || HEADING.test(l) || LIST.test(l) || /^\s*>/.test(l) ||
      (l.indexOf('|') >= 0 && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]));
  }

  function render(body, opts) {
    opts = opts || {};
    var slug = opts.slug || '';
    var lines = String(body).replace(/\r\n/g, '\n').split('\n');
    var out = [], headings = [], seen = {};
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }

      var fence = FENCE.exec(line);
      if (fence) {
        var code = [];
        i++;
        while (i < lines.length && !FENCE.test(lines[i])) { code.push(lines[i]); i++; }
        i++;                                                         // the closing fence (or the end of the text)
        out.push('<div class="kb-code"><button type="button" class="kb-copy" aria-label="Copy this code">Copy</button><pre><code>' +
          esc(code.join('\n')) + '</code></pre></div>');
        continue;
      }

      var h = HEADING.exec(line);
      if (h) {
        var level = h[1].length <= 2 ? 2 : 3;
        var label = stripInline(h[2]);
        var id = uniqueId(h[2], seen);
        headings.push({ level: level, text: label, id: id });
        out.push('<h' + level + ' id="' + id + '" class="kb-h' + level + '">' + inline(h[2]) +
          ' <a class="kb-anchor" href="#' + (slug ? esc(slug) + '/' : '') + id + '" aria-label="Link to the section ' + esc(label) + '">#</a></h' + level + '>');
        i++;
        continue;
      }

      if (line.indexOf('|') >= 0 && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
        var head = splitRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].indexOf('|') >= 0) { rows.push(splitRow(lines[i])); i++; }
        out.push('<div class="table-wrap kb-table"><table><thead><tr>' +
          head.map(function (c) { return '<th scope="col">' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr>' + head.map(function (_, k) { return '<td>' + inline(r[k] || '') + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>');
        continue;
      }

      if (/^\s*>/.test(line)) {
        var quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        var first = /^\*\*(Note|Tip|Warning)\*\*\s*(.*)$/.exec(quote[0] || '');
        var paras = [];
        var cur = [];
        (first ? [first[2]].concat(quote.slice(1)) : quote).forEach(function (q) {
          if (!q.trim()) { if (cur.length) { paras.push(cur.join(' ')); cur = []; } } else cur.push(q.trim());
        });
        if (cur.length) paras.push(cur.join(' '));
        var inner = paras.map(function (p) { return '<p>' + inline(p) + '</p>'; }).join('');
        if (first) {
          out.push('<div class="kb-callout kb-' + first[1].toLowerCase() + '" role="note"><strong class="kb-callout-title">' + first[1] +
            '</strong><div>' + inner + '</div></div>');
        } else {
          out.push('<blockquote class="kb-quote">' + inner + '</blockquote>');
        }
        continue;
      }

      if (LIST.test(line)) {
        var items = [];
        while (i < lines.length) {
          var m = LIST.exec(lines[i]);
          if (m) {
            items.push({ indent: indentOf(m[1]), ordered: /\d/.test(m[2]), number: parseInt(m[2], 10), text: m[3] });
            i++;
          } else if (!lines[i].trim()) {
            var j = i + 1;
            while (j < lines.length && !lines[j].trim()) j++;
            if (j < lines.length && LIST.test(lines[j])) i = j; else break;
          } else if (/^\s+\S/.test(lines[i]) && !FENCE.test(lines[i]) && items.length) {
            items[items.length - 1].text += ' ' + lines[i].trim();      // a wrapped continuation line
            i++;
          } else break;
        }
        var at = 0;
        while (at < items.length) {
          var built = buildList(items, at, items[at].indent);
          out.push(built.html);
          at = built.next;
        }
        continue;
      }

      var para = [line.trim()];
      i++;
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines, i)) { para.push(lines[i].trim()); i++; }
      out.push('<p>' + inline(para.join(' ')) + '</p>');
    }
    return { html: out.join('\n'), headings: headings };
  }

  function sections(body) {
    var lines = String(body).replace(/\r\n/g, '\n').split('\n');
    var seen = {};
    var list = [{ id: '', heading: '', level: 0, text: '' }];
    var cur = list[0];
    var fenced = false;
    lines.forEach(function (line) {
      if (FENCE.test(line)) { fenced = !fenced; return; }
      var h = !fenced && HEADING.exec(line);
      if (h) {
        cur = { id: uniqueId(h[2], seen), heading: stripInline(h[2]), level: h[1].length <= 2 ? 2 : 3, text: '' };
        list.push(cur);
        return;
      }
      if (TABLE_SEP.test(line)) return;
      var t = fenced ? line.trim() : stripInline(line);
      if (t) cur.text += (cur.text ? ' ' : '') + t;
    });
    return list;
  }

  return { esc: esc, slugify: slugify, parseFrontMatter: parseFrontMatter, render: render, sections: sections, stripInline: stripInline, linkTarget: linkTarget };
});
