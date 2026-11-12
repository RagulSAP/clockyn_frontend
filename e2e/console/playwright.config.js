'use strict';
/* Playwright config for the admin web console (UI_ADMIN_APP) operator-session checks. Run: npm run e2e:console */
const path = require('node:path');
const { defineConfig, devices } = require('@playwright/test');

const WEB = Number(process.env.CONSOLE_WEB_PORT || 8890);

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.js$/,
  outputDir: path.join(__dirname, '..', '.artifacts-console', 'test-results'),
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,                     /* one shared operator mock: tests reset it themselves */
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:' + WEB, ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, trace: 'retain-on-failure' },
  webServer: {
    command: 'node e2e/console/server.js',
    cwd: path.resolve(__dirname, '..', '..'),
    url: 'http://127.0.0.1:' + WEB + '/pages/login.html',
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
  },
});
