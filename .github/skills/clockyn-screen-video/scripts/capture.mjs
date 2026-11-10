/* eslint-disable no-console -- CLI tool: progress goes to stdout */
// Renders video.html frame by frame (deterministic, no real-time capture) into <work>/frames/f0000.jpg ...
// Usage: node capture.mjs <work-dir> [preview-seconds, e.g. 1.5,7.2,12]   (with preview seconds: writes preview-<t>.png only)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const work = path.resolve(process.argv[2] ?? '.');
const repo = process.env.VIDEO_REPO_ROOT ? path.resolve(process.env.VIDEO_REPO_ROOT) : path.resolve(HERE, '../../../..');
const { chromium } = createRequire(path.join(repo, 'package.json'))('@playwright/test');

const T = JSON.parse(fs.readFileSync(path.join(work, 'timing.json'), 'utf8'));
const FRAMES = path.join(work, 'frames');
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;

if (!only) {
  fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(work, 'video.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

if (only) {
  for (const s of only) {
    await page.evaluate(async (t) => { window.render(t); await window.ready(); }, s);
    await page.screenshot({ path: path.join(work, `preview-${String(s).replace('.', '_')}.png`) });
  }
  console.log('previews:', only.join(', '));
} else {
  const n = Math.round(T.total * T.fps);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate(async (t) => { window.render(t); await window.ready(); }, i / T.fps);
    await page.screenshot({ path: path.join(FRAMES, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if (i % 100 === 0) console.log(`frame ${i}/${n} (${Math.round((Date.now() - t0) / 1000)}s)`);
  }
  console.log(`done: ${n} frames in ${Math.round((Date.now() - t0) / 1000)}s`);
}
await browser.close();
