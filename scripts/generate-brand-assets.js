#!/usr/bin/env node
/**
 * Regenerates the raster brand assets in `assets/` (icon, adaptive icon layers, splash, favicon, notification icon)
 * from the Clockyn mark geometry in `src/components/ui/BrandMark.tsx` (100 x 100 viewBox: open clock ring, two hands,
 * mint "punch" dot). Graphite look: a dark gradient tile with a white mark.
 *
 *   node scripts/generate-brand-assets.js
 *
 * Uses the Chromium that ships with @playwright/test to rasterise SVG (no image library needed).
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const OUT = path.join(__dirname, '..', 'assets');

// ── mark geometry (keep in sync with BrandMark.tsx) ──────────────────────────────────────────
const C = 50;
const R = 34;
const RING_W = 9;
const HAND_W = 7;
const GAP_START = 335;
const GAP_END = 275;
const DOT_ANGLE = 305;
const DOT_R = 6.5;
const rad = (d) => (d * Math.PI) / 180;
const pt = (d, r = R) => ({ x: C + r * Math.cos(rad(d)), y: C + r * Math.sin(rad(d)) });
const f = (n) => n.toFixed(2);
const a = pt(GAP_START);
const b = pt(GAP_END);
const dot = pt(DOT_ANGLE);
const RING_PATH = `M ${f(a.x)} ${f(a.y)} A ${R} ${R} 0 1 1 ${f(b.x)} ${f(b.y)}`;
const HANDS_PATH = 'M 50 50 L 50 31 M 50 50 L 62 58';

const WHITE = '#FFFFFF';
const INK = '#0D0D0D';
const MINT_DARK = '#34E3A5';
const MINT_LIGHT = '#06C270';

/** The mark, centred in a `size` canvas and drawn `scale` px per viewBox unit. */
function mark({ size, scale, ink, dotColor }) {
  const t = size / 2 - 50 * scale;
  return `<g transform="translate(${t} ${t}) scale(${scale})">
    <path d="${RING_PATH}" stroke="${ink}" stroke-width="${RING_W}" stroke-linecap="round" fill="none"/>
    <path d="${HANDS_PATH}" stroke="${ink}" stroke-width="${HAND_W}" stroke-linecap="round" fill="none"/>
    <circle cx="${f(dot.x)}" cy="${f(dot.y)}" r="${DOT_R}" fill="${dotColor}"/>
  </g>`;
}

const tileDefs = `<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3A3A40"/><stop offset="1" stop-color="#0C0C0D"/></linearGradient>
  <radialGradient id="h" cx="0.28" cy="0.2" r="0.75"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.13"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
</defs>`;
const tile = (size, radius = 0) =>
  `<rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/><rect width="${size}" height="${size}" rx="${radius}" fill="url(#h)"/>`;

/** name -> { size, transparent, body } */
const ASSETS = {
  // iOS / store icon: opaque square (the OS applies the corner mask).
  'icon.png': { size: 1024, body: `${tileDefs}${tile(1024)}${mark({ size: 1024, scale: 6.4, ink: WHITE, dotColor: MINT_DARK })}` },
  'android-icon-background.png': { size: 1024, body: `${tileDefs}${tile(1024)}` },
  // adaptive foreground: mark kept inside the 66% safe zone
  'android-icon-foreground.png': { size: 1024, transparent: true, body: mark({ size: 1024, scale: 7.2, ink: WHITE, dotColor: MINT_DARK }) },
  // themed (monochrome) icon: one colour, the OS tints it
  'android-icon-monochrome.png': { size: 1024, transparent: true, body: mark({ size: 1024, scale: 7.2, ink: WHITE, dotColor: WHITE }) },
  // splash: light screen (dark mark) and dark screen (light mark)
  'splash-icon.png': { size: 1024, transparent: true, body: mark({ size: 1024, scale: 8, ink: INK, dotColor: MINT_LIGHT }) },
  'splash-icon-dark.png': { size: 1024, transparent: true, body: mark({ size: 1024, scale: 8, ink: WHITE, dotColor: MINT_DARK }) },
  'favicon.png': { size: 48, transparent: true, body: `${tileDefs}${tile(48, 11)}${mark({ size: 48, scale: 0.46, ink: WHITE, dotColor: MINT_DARK })}` },
  // Android status-bar glyph: white-only alpha mask
  'notification-icon.png': { size: 96, transparent: true, body: mark({ size: 96, scale: 0.92, ink: WHITE, dotColor: WHITE }) },
};

async function main() {
  const browser = await chromium.launch();
  try {
    for (const [name, { size, transparent, body }] of Object.entries(ASSETS)) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(
        `<!doctype html><html><body style="margin:0;background:transparent">
          <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>
        </body></html>`,
      );
      const buffer = await page.screenshot({ omitBackground: !!transparent, type: 'png' });
      fs.writeFileSync(path.join(OUT, name), buffer);
      await page.close();
      console.log(`wrote assets/${name} (${size}x${size}${transparent ? ', transparent' : ''})`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
