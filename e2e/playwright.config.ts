import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const ports = require('./ports.js') as { MOCK_URL: string; WEB_URL: string; WEB_PORTS: number };
const { GEO } = require('./mock-server/fixtures.js') as { GEO: { latitude: number; longitude: number } };

const root = path.resolve(__dirname, '..');
// E2E_ARTIFACTS isolates parallel runs (build output, screenshots, reports); relative paths resolve from the project root.
const artifacts = process.env.E2E_ARTIFACTS ? path.resolve(__dirname, '..', process.env.E2E_ARTIFACTS) : path.join(__dirname, '.artifacts');
const CI = !!process.env.CI;
// One worker slot == one web origin == one isolated mock tenant (see support/test.ts). Max = E2E_WEB_PORTS.
const workers = Math.min(Number(process.env.E2E_WORKERS) || (CI ? 2 : 4), ports.WEB_PORTS);

const chromiumArgs = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];

export default defineConfig({
  testDir: path.join(__dirname, 'specs'),
  outputDir: path.join(artifacts, 'test-results'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers,
  reporter: [['list'], ['html', { outputFolder: path.join(artifacts, 'report'), open: 'never' }]],
  use: {
    baseURL: ports.WEB_URL, // overridden per worker by the `baseURL` fixture in support/test.ts
    testIdAttribute: 'data-testid',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    permissions: ['geolocation', 'camera', 'microphone'],
    geolocation: GEO,
    colorScheme: 'light',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    launchOptions: { args: chromiumArgs },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'phone',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: 'node e2e/mock-server/index.js',
      cwd: root,
      url: `${ports.MOCK_URL}/__test/health`,
      reuseExistingServer: !CI,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'node e2e/serve.js',
      cwd: root,
      url: ports.WEB_URL,
      reuseExistingServer: !CI,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
