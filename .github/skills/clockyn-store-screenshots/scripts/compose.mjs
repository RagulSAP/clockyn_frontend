/* eslint-disable no-console -- CLI tool: progress goes to stdout */
// Turns the clean app pictures in <work>/raw/<phone|tablet>/<id>.png into store-ready marketing images:
//   <work>/out/<store>/<size-id>/NN-<id>.png        screenshots, exact store pixel sizes
//   <work>/out/play/graphics/feature-graphic.png    Google Play feature graphic 1024x500
//   <work>/out/play/graphics/app-icon-512.png       and  out/appstore/graphics/app-icon-1024.png
//   <work>/out/listing.md                           the listing text with character counts
// Usage: node compose.mjs <work-dir> [--shots a,b] [--targets phone,iphone-6.9] [--no-graphics]
// Needs: <work>/config.json (see config.example.json), <work>/raw/** (from the capture step), the repo's node_modules (Playwright + the Outfit font).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const work = path.resolve(args.find((a) => !a.startsWith('--')) ?? '.');
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? (args[i + 1] ?? true) : null; };
const repo = process.env.STORE_REPO_ROOT ? path.resolve(process.env.STORE_REPO_ROOT) : path.resolve(HERE, '../../../..');
const { chromium } = createRequire(path.join(repo, 'package.json'))('@playwright/test');

const cfg = JSON.parse(fs.readFileSync(path.join(work, 'config.json'), 'utf8'));
const TARGETS = JSON.parse(fs.readFileSync(path.join(HERE, 'targets.json'), 'utf8'));
const onlyShots = flag('shots') ? String(flag('shots')).split(',') : null;
const onlyTargets = flag('targets') ? String(flag('targets')).split(',') : null;
const OUT = path.join(work, 'out');

// ───────────────────────────────────────────────────────────────────────────── palettes (edit in config.brand.palettes to override)
const ACCENT = cfg.brand?.accent ?? '#06C270';
const PALETTES = {
  midnight: { from: '#06100C', to: '#0C2519', glow: ACCENT, text: '#FFFFFF', muted: 'rgba(255,255,255,0.74)', accent: '#3FE39B', card: 'rgba(255,255,255,0.96)', cardText: '#0A1F16' },
  forest:   { from: '#0A1E15', to: '#11382A', glow: '#2FD08C', text: '#FFFFFF', muted: 'rgba(255,255,255,0.76)', accent: '#5DF0B0', card: 'rgba(255,255,255,0.96)', cardText: '#0A1F16' },
  paper:    { from: '#F6F5F1', to: '#E7F4EC', glow: ACCENT, text: '#0A1F16', muted: 'rgba(10,31,22,0.68)', accent: '#058A4E', card: 'rgba(10,20,16,0.92)', cardText: '#FFFFFF' },
  mint:     { from: '#E9F8F0', to: '#C9EEDB', glow: ACCENT, text: '#08241A', muted: 'rgba(8,36,26,0.70)', accent: '#047A45', card: 'rgba(10,20,16,0.92)', cardText: '#FFFFFF' },
  ...(cfg.brand?.palettes ?? {}),
};
const pal = (name) => PALETTES[name] ?? PALETTES.midnight;

// ───────────────────────────────────────────────────────────────────────────── helpers
const cache = new Map();
const dataUri = (file, mime) => {
  if (!cache.has(file)) cache.set(file, `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`);
  return cache.get(file);
};
const pngSize = (file) => { const b = fs.readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** headline / sub may carry <em>..</em> only; everything else is escaped */
const rich = (s) => esc(s).replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>');
const hex2rgba = (hex, a) => {
  const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const fontCss = () => {
  const dir = path.join(repo, 'node_modules', '@expo-google-fonts', 'outfit');
  const weights = [[500, '500Medium'], [600, '600SemiBold'], [700, '700Bold'], [800, '800ExtraBold']];
  return weights.map(([w, n]) => {
    const f = path.join(dir, n, `Outfit_${n}.ttf`);
    return fs.existsSync(f) ? `@font-face{font-family:'Outfit';font-weight:${w};src:url(${dataUri(f, 'font/ttf')}) format('truetype');}` : '';
  }).join('\n');
};
const FONT_CSS = fontCss();
const logoFile = path.resolve(repo, cfg.app?.logo ?? 'assets/icon.png');

const ICONS = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.6" fill="currentColor"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 9v11M4 13h16M12 9c-1.5-3.5-5-3.5-5-1.2C7 9.5 9 9 12 9zm0 0c1.5-3.5 5-3.5 5-1.2C17 9.5 15 9 12 9z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z" fill="currentColor"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8L12 3.5z" fill="currentColor"/>',
  users: '<circle cx="9" cy="8.5" r="3.2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M3.5 19c.5-3.2 2.8-5 5.5-5s5 1.8 5.5 5M16 6a3 3 0 0 1 0 5.8M17.5 14.3c1.8.6 2.9 2.2 3.2 4.7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  wallet: '<rect x="3.5" y="6.5" width="17" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M16 12.5h4.5v3H16a1.5 1.5 0 0 1 0-3z" fill="currentColor"/>',
  chat: '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>',
};
const icon = (name, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}">${ICONS[name] ?? ICONS.check}</svg>`;

// ───────────────────────────────────────────────────────────────────────────── page
function shell({ W, H, body, extraCss = '' }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONT_CSS}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;font-family:'Outfit',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.canvas{position:relative;width:${W}px;height:${H}px;overflow:hidden}
${extraCss}
</style></head><body>${body}</body></html>`;
}

/** wide background: one gradient across the whole set, so the shots flow into each other when the store scrolls them */
function backgroundHtml({ W, H, index, total, flow, palettes }) {
  const u = W / 1000;
  const p = palettes[index];
  if (!flow) {
    return `<div class="bg" style="position:absolute;inset:0;background:linear-gradient(165deg,${p.from},${p.to})"></div>
      <div class="blob" style="left:${W * 0.55}px;top:${-H * 0.05}px;width:${W * 0.9}px;height:${W * 0.9}px;background:${hex2rgba(p.glow, 0.34)}"></div>
      <div class="blob" style="left:${-W * 0.3}px;top:${H * 0.62}px;width:${W * 0.8}px;height:${W * 0.8}px;background:${hex2rgba(p.glow, 0.18)}"></div>`;
  }
  const stops = palettes.map((pp, i) => `${pp.from} ${((i + 0.0) / total) * 100}%, ${pp.to} ${((i + 0.5) / total) * 100}%`).join(', ');
  const blobs = palettes.map((pp, i) => `
    <div class="blob" style="left:${(i + (i % 2 ? 0.05 : 0.5)) * W}px;top:${(i % 2 ? 0.58 : -0.04) * H}px;width:${W * 0.95}px;height:${W * 0.95}px;background:${hex2rgba(pp.glow, i % 2 ? 0.2 : 0.34)}"></div>`).join('');
  return `<div style="position:absolute;top:0;left:${-index * W}px;width:${total * W}px;height:${H}px;background:linear-gradient(100deg,${stops})"></div>
    <div style="position:absolute;top:0;left:${-index * W}px;width:${total * W}px;height:${H}px">${blobs}</div>`;
}

const SB_ICONS = `<svg viewBox="0 0 18 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx=".8"/><rect x="5" y="5" width="3" height="6" rx=".8"/><rect x="10" y="2.5" width="3" height="8.5" rx=".8"/><rect x="15" y="0" width="3" height="11" rx=".8"/></svg>
<svg viewBox="0 0 16 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M1.2 4.2a10 10 0 0 1 13.6 0M3.6 6.8a6.4 6.4 0 0 1 8.8 0"/><circle cx="8" cy="9.3" r="1.1" fill="currentColor" stroke="none"/></svg>
<svg viewBox="0 0 27 12" fill="none"><rect x=".6" y=".6" width="22.6" height="10.8" rx="3.2" stroke="currentColor" stroke-opacity=".5" stroke-width="1.2"/><rect x="2.2" y="2.2" width="19.4" height="7.6" rx="1.9" fill="currentColor"/><path d="M24.6 4v4c.9-.3 1.5-1.1 1.5-2s-.6-1.7-1.5-2z" fill="currentColor" fill-opacity=".55"/></svg>`;

function deviceHtml({ id, src, style, cls = '' }) {
  return `<div class="dev ${style} ${cls}" id="${id}"><div class="shell"><div class="scr"><img src="${src}"><div class="sb"><span class="t">9:41</span><span class="ic">${SB_ICONS}</span></div><div class="notch"></div></div></div></div>`;
}

/** Runs in the page: puts a status-bar band on top of the app picture (the web build has none, so the camera hole would cover the header).
 *  The band takes the colour of the picture's top edge; the picture is pushed down by the band height (its bottom bleeds off anyway). */
function applySbInPage(el, scrH, wide) {
  const scr = el.querySelector('.scr');
  const img = scr.querySelector('img');
  const sb = (wide ? 0.026 : 0.046) * scrH;
  let rgb = [245, 245, 245];
  try {
    const c = document.createElement('canvas'); const rows = 3;
    c.width = img.naturalWidth; c.height = rows;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, img.naturalWidth, rows, 0, 0, img.naturalWidth, rows);
    const d = g.getImageData(0, 0, c.width, rows).data; let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 7) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    rgb = [r / n, gg / n, b / n].map(Math.round);
  } catch (e) { /* keep the neutral band */ }
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  scr.style.background = `rgb(${rgb.join(',')})`;
  scr.style.setProperty('--sb', sb + 'px');
  scr.style.setProperty('--fg', lum > 0.55 ? '#111111' : '#FFFFFF');
}

const BASE_CSS = `
.blob{position:absolute;border-radius:50%;filter:blur(110px)}
.text{position:absolute;left:0;right:0;text-align:center}
.eyebrow{display:inline-flex;align-items:center;font-weight:700;letter-spacing:.16em;text-transform:uppercase;border-radius:999px}
h1{font-weight:800;letter-spacing:-0.022em;line-height:1.04;overflow-wrap:anywhere;text-wrap:balance}
h1 em{font-style:normal}
.sub{font-weight:500;line-height:1.3;text-wrap:balance}
.dev{position:absolute;transform-origin:50% 0%;will-change:transform}
.shell{width:100%;height:100%;background:linear-gradient(145deg,#2a2b2f,#0b0b0d 45%,#1a1b1e);box-shadow:0 0 0 1.5px rgba(255,255,255,.14) inset,0 60px 120px -30px rgba(0,0,0,.65),0 28px 60px -20px rgba(0,0,0,.55)}
.scr{position:relative;width:100%;height:100%;overflow:hidden;background:#000}
.scr img{position:absolute;left:0;top:var(--sb,0px);display:block;width:100%;height:100%;object-fit:cover}
.sb{position:absolute;left:0;right:0;top:0;height:var(--sb,0px);display:flex;align-items:center;justify-content:space-between;padding:0 6.5%;color:var(--fg,#111);font-weight:700;font-size:calc(var(--sb,0px) * .38);letter-spacing:.01em}
.sb .ic{display:flex;align-items:center;gap:calc(var(--sb,0px) * .16)}
.sb .ic svg{height:calc(var(--sb,0px) * .27);width:auto}
.notch{position:absolute;background:#050506}
.dev.iphone .notch{top:1.1%;left:50%;width:28%;height:3.1%;border-radius:999px;transform:translateX(-50%)}
.dev.android .notch{top:1.5%;left:50%;width:3.6%;aspect-ratio:1;border-radius:50%;transform:translateX(-50%)}
.dev.ipad .notch,.dev.tablet .notch{top:1.4%;left:50%;width:1.3%;aspect-ratio:1;border-radius:50%;transform:translateX(-50%)}
.callout{position:absolute;z-index:10;display:flex;align-items:center;white-space:nowrap;font-weight:700;box-shadow:0 24px 50px -16px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.35) inset;backdrop-filter:blur(8px)}
.callout .ic{display:flex;align-items:center;justify-content:center;border-radius:50%;color:#fff}
`;

/** measures the headline, sizes + places the device(s) to fill the space under it, returns warnings. Runs inside the page. */
function layoutInPage(P) {
  const { W, H, layout, aspect, aspect2, kind, index, hasSecondary, calloutDefs, maxLines, tiltDir } = P;
  const $ = (s) => document.querySelector(s);
  const warns = [];
  const u = W / 1000;
  const wide = kind === 'tablet';
  const h1 = $('h1');
  const textEl = $('.text');
  let fs = parseFloat(getComputedStyle(h1).fontSize);
  const lineH = () => parseFloat(getComputedStyle(h1).lineHeight);
  let guard = 0;
  while (h1.getBoundingClientRect().height / lineH() > maxLines + 0.05 && fs > (wide ? 52 : 64) * u && guard++ < 40) { fs *= 0.96; h1.style.fontSize = fs + 'px'; }
  if (h1.getBoundingClientRect().height / lineH() > maxLines + 0.05) warns.push(`headline needs more than ${maxLines} lines: shorten it`);
  const textBottom = textEl.getBoundingClientRect().bottom;

  const bez = wide ? 0.034 : 0.026;           // bezel as a share of the screen width
  const outerH = (sw, a) => sw / a + 2 * bez * sw;
  const swFromOuterH = (oh, a) => oh / (1 / a + 2 * bez);
  const gap = H * 0.032;
  const avail = H - textBottom - gap;
  const maxFrac = wide ? 0.86 : 0.8;
  const spec = {
    center: { bleed: 0.1, scale: 1, rot: 0, dx: 0 },
    tilt:   { bleed: 0.14, scale: 1.0, rot: (tiltDir ?? (index % 2 ? -1 : 1)) * 6.5, dx: (tiltDir ?? (index % 2 ? -1 : 1)) * -0.035 * W },
    duo:    { bleed: 0.1, scale: 0.9, rot: 0, dx: 0.17 * W },
  }[layout] ?? { bleed: 0.1, scale: 1, rot: 0, dx: 0 };

  let sw = Math.min(swFromOuterH(avail * (1 + spec.bleed), aspect) * spec.scale, W * maxFrac * spec.scale);
  const place = (el, w, a, left, top, rot, z) => {
    const oh = outerH(w, a); const ow = w + 2 * bez * w;
    const r = (wide ? 0.05 : 0.125) * w;
    el.style.width = ow + 'px'; el.style.height = oh + 'px'; el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.zIndex = z;
    el.style.transform = `rotate(${rot}deg)`;
    const shell = el.querySelector('.shell'); const scr = el.querySelector('.scr');
    shell.style.borderRadius = r + bez * w + 'px'; shell.style.padding = bez * w + 'px'; scr.style.borderRadius = r + 'px';
    window.applySb(el, w / a, wide);
    return { left, top, ow, oh };
  };
  const main = $('#dev-main');
  const ow = sw + 2 * bez * sw;
  let box;
  if (layout === 'duo' && hasSecondary) {
    const mw = sw;
    const left = W - ow - W * 0.045;
    box = place(main, mw, aspect, left, textBottom + gap, 0, 2);
    const sw2 = mw * 0.86;
    const ow2 = sw2 + 2 * bez * sw2;
    place($('#dev-second'), sw2, aspect2, W * 0.045, textBottom + gap + H * 0.07, -4.5, 1);
  } else {
    const left = (W - ow) / 2 + spec.dx;
    box = place(main, sw, aspect, left, textBottom + gap, spec.rot, 2);
  }
  if (box.top + box.oh < H * 0.97) warns.push('device does not reach the bottom edge (it is limited by the width): fine, but check the picture');

  for (const [i, c] of calloutDefs.entries()) {
    const el = $('#callout-' + i);
    const w = el.getBoundingClientRect().width;
    el.style.left = Math.max(W * 0.03, Math.min(W - w - W * 0.03, box.left + c.x * box.ow - w / 2)) + 'px';
    el.style.top = box.top + c.y * Math.min(box.oh, H - box.top) - el.getBoundingClientRect().height / 2 + 'px';
  }
  return { warns, textBottom: Math.round(textBottom), device: { top: Math.round(box.top), height: Math.round(box.oh) } };
}

function screenshotHtml({ target, shot, index, total, palettes, rawFile, rawFile2, flow }) {
  const W = target.width; const H = target.height; const u = W / 1000;
  const wide = target.formFactor === 'tablet';
  const p = palettes[index];
  const src = dataUri(rawFile, 'image/png');
  const src2 = rawFile2 ? dataUri(rawFile2, 'image/png') : null;
  // callouts are sized for a phone; on a tablet they are off unless the shot gives its own `tabletCallouts`
  const callouts = ((wide ? shot.tabletCallouts : shot.callouts) ?? []).slice(0, 2);
  const css = BASE_CSS + `
.text{top:${H * (wide ? 0.058 : 0.062)}px;padding:0 ${W * 0.07}px}
.eyebrow{font-size:${u * (wide ? 26 : 31)}px;padding:${u * 14}px ${u * 32}px;color:${p.accent};background:${hex2rgba(p.accent, 0.13)};box-shadow:0 0 0 1.5px ${hex2rgba(p.accent, 0.38)} inset;margin-bottom:${u * 30}px}
h1{font-size:${u * (wide ? 84 : 100)}px;color:${p.text}}
h1 em{color:${p.accent}}
.sub{font-size:${u * (wide ? 34 : 39)}px;color:${p.muted};margin-top:${u * 26}px}
.callout{padding:${u * 18}px ${u * 34}px ${u * 18}px ${u * 20}px;border-radius:${u * 60}px;font-size:${u * 38}px;gap:${u * 18}px;background:${p.card};color:${p.cardText}}
.callout .ic{width:${u * 62}px;height:${u * 62}px;background:${ACCENT}}
.logo{position:absolute;display:none}
`;
  const body = `<div class="canvas">
    ${backgroundHtml({ W, H, index, total, flow, palettes })}
    <div class="text">
      ${shot.eyebrow ? `<div class="eyebrow">${esc(shot.eyebrow)}</div>` : ''}
      <h1>${rich(shot.headline)}</h1>
      ${shot.sub ? `<div class="sub">${rich(shot.sub)}</div>` : ''}
    </div>
    ${src2 ? deviceHtml({ id: 'dev-second', src: src2, style: target.deviceStyle }) : ''}
    ${deviceHtml({ id: 'dev-main', src, style: target.deviceStyle })}
    ${callouts.map((c, i) => `<div class="callout" id="callout-${i}"><span class="ic">${icon(c.icon ?? 'check', u * 38)}</span><span>${esc(c.text)}</span></div>`).join('')}
  </div>`;
  const raw = pngSize(rawFile);
  const raw2 = rawFile2 ? pngSize(rawFile2) : null;
  return {
    html: shell({ W, H, body, extraCss: css }),
    params: {
      W, H, layout: src2 && shot.layout === 'duo' ? 'duo' : (shot.layout === 'duo' ? 'center' : shot.layout ?? 'center'),
      aspect: raw.w / raw.h, aspect2: raw2 ? raw2.w / raw2.h : 1, kind: target.formFactor, index, hasSecondary: !!src2,
      calloutDefs: callouts.map((c) => ({ x: c.x ?? 0.1, y: c.y ?? 0.3 })), maxLines: shot.maxLines ?? 3, tiltDir: shot.tiltDir ?? null,
    },
  };
}

function featureHtml({ W, H, rawA, rawB, palette }) {
  const u = H / 500;
  const p = palette;
  const g = cfg.featureGraphic ?? {};
  const logo = dataUri(logoFile, 'image/png');
  const css = BASE_CSS + `
.left{position:absolute;left:${W * 0.055}px;top:0;bottom:0;width:${W * 0.5}px;display:flex;flex-direction:column;justify-content:center}
.brandrow{display:flex;align-items:center;gap:${u * 14}px;margin-bottom:${u * 22}px}
.brandrow img{width:${u * 54}px;height:${u * 54}px;border-radius:${u * 14}px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.brandrow span{font-weight:800;font-size:${u * 34}px;letter-spacing:-.01em;color:${p.text}}
h1{font-size:${u * 62}px;color:${p.text};text-align:left}
h1 em{color:${p.accent}}
.sub{font-size:${u * 24}px;color:${p.muted};margin-top:${u * 16}px;text-align:left}
`;
  const body = `<div class="canvas">
    <div style="position:absolute;inset:0;background:linear-gradient(120deg,${p.from},${p.to})"></div>
    <div class="blob" style="left:${W * 0.5}px;top:${-H * 0.5}px;width:${H * 1.6}px;height:${H * 1.6}px;background:${hex2rgba(p.glow, 0.34)}"></div>
    <div class="left">
      <div class="brandrow"><img src="${logo}"><span>${esc(cfg.app?.name ?? '')}</span></div>
      <h1>${rich(g.headline ?? cfg.app?.tagline ?? '')}</h1>
      ${g.sub ? `<div class="sub">${rich(g.sub)}</div>` : ''}
    </div>
    ${rawB ? deviceHtml({ id: 'dev-second', src: dataUri(rawB, 'image/png'), style: 'android' }) : ''}
    ${deviceHtml({ id: 'dev-main', src: dataUri(rawA, 'image/png'), style: 'android' })}
  </div>`;
  const a = pngSize(rawA); const b = rawB ? pngSize(rawB) : null;
  return { html: shell({ W, H, body, extraCss: css }), a: a.w / a.h, b: b ? b.w / b.h : 1 };
}

function layoutFeature(P) {
  const { W, H, a, b, hasSecond } = P;
  const $ = (s) => document.querySelector(s);
  const bez = 0.026;
  const place = (el, sw, ar, left, top, rot, z) => {
    const oh = sw / ar + 2 * bez * sw; const ow = sw + 2 * bez * sw; const r = 0.125 * sw;
    Object.assign(el.style, { width: ow + 'px', height: oh + 'px', left: left + 'px', top: top + 'px', zIndex: z, transform: `rotate(${rot}deg)` });
    el.querySelector('.shell').style.borderRadius = r + bez * sw + 'px'; el.querySelector('.shell').style.padding = bez * sw + 'px'; el.querySelector('.scr').style.borderRadius = r + 'px';
    window.applySb(el, sw / ar, false);
  };
  const sw = H * 0.78 * a / (1 + 2 * bez * a) ;           // main phone: about 78% of the banner height visible, rest bleeds
  const swMain = (H * 1.05) / (1 / a + 2 * bez);
  place($('#dev-main'), swMain, a, W * 0.74, H * 0.1, 7, 2);
  if (hasSecond) place($('#dev-second'), swMain * 0.9, b, W * 0.57, H * 0.2, -6, 1);
  return {};
}

// ───────────────────────────────────────────────────────────────────────────── run
const sizesOf = (store) => store.targets.filter((t) => (onlyTargets ? onlyTargets.includes(t.id) : cfg.includeOptionalSizes === false ? t.required : true));
const allShots = cfg.shots.filter((s) => (onlyShots ? onlyShots.includes(s.id) : true));
const flow = cfg.brand?.flow !== false;
const seq = cfg.brand?.sequence ?? [];
const paletteOf = (shot, i) => pal(shot.palette ?? seq[i % Math.max(seq.length, 1)] ?? 'midnight');

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const made = [];
const problems = [];

async function render({ W, H, html, runner, runnerArgs, file }) {
  await page.setViewportSize({ width: W, height: H });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(`window.applySb = ${applySbInPage.toString()}`);
  const res = runner ? await page.evaluate(runner, runnerArgs) : {};
  await page.waitForTimeout(120);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, type: 'png' });
  return res;
}

for (const [storeId, store] of Object.entries(TARGETS.stores)) {
  if (cfg.stores && !cfg.stores.includes(storeId)) continue;
  const limit = store.maxCount;
  const shots = allShots.slice(0, limit);
  if (allShots.length > limit) problems.push(`${store.label}: ${allShots.length} shots, the store takes at most ${limit}; only the first ${limit} are made.`);
  for (const target of sizesOf(store)) {
    let n = 0;
    // only the shots meant for this form factor: the story order, the background flow and the file numbers count within THIS set
    const setShots = shots.filter((sh) => !sh.forms || sh.forms.includes(target.formFactor));
    const palettes = setShots.map((sh, i) => paletteOf(sh, i));
    for (const [index, shot] of setShots.entries()) {
      const rawFile = path.join(work, 'raw', target.formFactor, `${shot.id}.png`);
      if (!fs.existsSync(rawFile)) { problems.push(`missing raw picture ${path.relative(work, rawFile)} (the capture step did not produce it): ${store.label} / ${target.id} / ${shot.id} skipped`); continue; }
      const second = shot.secondary ? path.join(work, 'raw', target.formFactor, `${shot.secondary}.png`) : null;
      const { html, params } = screenshotHtml({ target, shot, index, total: setShots.length, palettes, rawFile, rawFile2: second && fs.existsSync(second) ? second : null, flow });
      const file = path.join(OUT, storeId, target.id, `${String(++n).padStart(2, '0')}-${shot.id}.png`);
      const res = await render({ W: target.width, H: target.height, html, runner: layoutInPage, runnerArgs: params, file });
      for (const w of res.warns ?? []) problems.push(`${storeId}/${target.id}/${shot.id}: ${w}`);
      made.push(path.relative(work, file));
    }
    console.log(`${store.label} / ${target.label}: ${n} screenshot(s) ${target.width}x${target.height}`);
  }
}

if (!flag('no-graphics')) {
  const p0 = paletteOf(allShots[0], 0);
  const fg = cfg.featureGraphic;
  if (fg && (!cfg.stores || cfg.stores.includes('play'))) {
    const [idA, idB] = fg.shots ?? [allShots[0]?.id, allShots[1]?.id];
    const rawA = path.join(work, 'raw', 'phone', `${idA}.png`);
    const rawB = idB ? path.join(work, 'raw', 'phone', `${idB}.png`) : null;
    if (fs.existsSync(rawA)) {
      const { html, a, b } = featureHtml({ W: 1024, H: 500, rawA, rawB: rawB && fs.existsSync(rawB) ? rawB : null, palette: p0 });
      const file = path.join(OUT, 'play', 'graphics', 'feature-graphic.png');
      await render({ W: 1024, H: 500, html, runner: layoutFeature, runnerArgs: { W: 1024, H: 500, a, b, hasSecond: !!(rawB && fs.existsSync(rawB)) }, file });
      made.push(path.relative(work, file)); console.log('Google Play feature graphic 1024x500');
    } else problems.push('feature graphic skipped: raw phone picture missing');
  }
  for (const [store, id, size] of [['play', 'app-icon-512', 512], ['appstore', 'app-icon-1024', 1024]]) {
    if (cfg.stores && !cfg.stores.includes(store)) continue;
    if (!fs.existsSync(logoFile)) continue;
    const html = shell({ W: size, H: size, body: `<img src="${dataUri(logoFile, 'image/png')}" style="display:block;width:${size}px;height:${size}px">` });
    const file = path.join(OUT, store, 'graphics', `${id}.png`);
    await render({ W: size, H: size, html, file });
    made.push(path.relative(work, file));
  }
}
await browser.close();

// ───────────────────────────────────────────────────────────────────────────── listing text with counts
if (cfg.listing) {
  const LIM = { play: { title: 30, shortDescription: 80, fullDescription: 4000 }, appstore: { name: 30, subtitle: 30, promoText: 170, keywords: 100, description: 4000 } };
  const lines = ['# Store listing text (draft)', '', 'Limits are the stores\' own. A field over its limit is rejected by the Console.', ''];
  for (const [store, fields] of Object.entries(cfg.listing)) {
    lines.push(`## ${TARGETS.stores[store]?.label ?? store}`, '');
    for (const [k, v] of Object.entries(fields)) {
      const lim = LIM[store]?.[k];
      const len = [...String(v)].length;
      const flagTxt = lim ? (len > lim ? `  **OVER by ${len - lim}**` : `  (${len}/${lim})`) : '';
      if (lim && len > lim) problems.push(`listing ${store}.${k}: ${len} characters, limit ${lim}`);
      lines.push(`**${k}**${flagTxt}`, '', String(v), '');
    }
  }
  fs.writeFileSync(path.join(OUT, 'listing.md'), lines.join('\n'));
}

fs.writeFileSync(path.join(OUT, 'compose-report.json'), JSON.stringify({ made, problems }, null, 2));
console.log(`\ncomposed ${made.length} file(s) into ${OUT}`);
if (problems.length) { console.log('\nCHECK THESE:'); for (const p of problems) console.log(' - ' + p); }
