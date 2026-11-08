#!/usr/bin/env node
'use strict';
/**
 * Builds the web export the E2E suites run against, pointed at the mock backend:
 *   EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:<mockport> npx expo export --platform web --output-dir e2e/.artifacts/web-dist
 * Set E2E_API_BASE_URL to bake another API origin; E2E_BUILD_CLEAR=1 to clear the Metro cache.
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { MOCK_URL } = require('./ports');

const root = path.resolve(__dirname, '..');
// E2E_ARTIFACTS lets several parallel runs use isolated output folders (e.g. E2E_ARTIFACTS=e2e/.artifacts-q1).
const artifactsDir = process.env.E2E_ARTIFACTS ? path.resolve(root, process.env.E2E_ARTIFACTS) : path.join(__dirname, '.artifacts');
const out = path.join(artifactsDir, 'web-dist');
const api = process.env.E2E_API_BASE_URL || MOCK_URL;

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.dirname(out), { recursive: true });

const args = ['expo', 'export', '--platform', 'web', '--output-dir', path.relative(root, out)];
if (process.env.E2E_BUILD_CLEAR === '1') args.push('--clear');
console.log(`[e2e:build] API base ${api} -> ${path.relative(root, out)}`);

const res = spawnSync(`npx ${args.join(' ')}`, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EXPO_PUBLIC_API_BASE_URL: api, EXPO_PUBLIC_ALLOW_WEB_EMPLOYEE: 'true', CI: process.env.CI || '1' }, // the browser tests sign in as staff too
});
if (res.status !== 0) {
  console.error('[e2e:build] expo export failed');
  process.exit(res.status || 1);
}
if (!fs.existsSync(path.join(out, 'index.html'))) {
  console.error('[e2e:build] export finished but index.html is missing');
  process.exit(1);
}
console.log('[e2e:build] done');
