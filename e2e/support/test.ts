/**
 * The `test` every spec imports (NOT `@playwright/test` directly):
 *
 *   import { test, expect, loginAs, visit } from '../support';
 *
 * Fixtures added on top of Playwright's:
 *   tenant    worker-scoped web origin (== mock tenant key). Each Playwright worker has its own isolated mock state.
 *   mock      MockClient bound to the tenant; reset to the seed before every test (`test.use({ autoReset: false })` to opt out).
 *   baseURL   the worker's web origin.
 *   page      + mock binding (so `loginAs` can read the plan), + offline stubs for maps/geocoding/Razorpay,
 *             + browser issue collector: the test fails at teardown on uncaught errors, console.error, failed local
 *               requests or mock 404/405/5xx (allow-list: support/allowlist.json; opt out: `failOnPageIssues: false`).
 *   issues    the collector (`issues.allow(/regex/)`, `issues.clear()`, `issues.issues()`).
 */
import { test as base, expect } from '@playwright/test';

import { attachCollector, formatIssues, type Collector } from './collectors';
import { stubExternalNetwork } from './external';
import { MockClient, MOCK_URL, originForSlot } from './mock';
import { bindMock } from './registry';

interface Options {
  /** Fail the test on unexpected console errors / page errors / mock 404-5xx (default true). */
  failOnPageIssues: boolean;
  /** Reset the mock to the seed before each test (default true). */
  autoReset: boolean;
  /** Stub third-party hosts (tiles, geocoding, Razorpay) (default true). */
  stubExternal: boolean;
}

interface Fixtures {
  mock: MockClient;
  issues: Collector;
}

interface WorkerFixtures {
  tenant: string;
}

export const test = base.extend<Fixtures & Options, WorkerFixtures>({
  failOnPageIssues: [true, { option: true }],
  autoReset: [true, { option: true }],
  stubExternal: [true, { option: true }],

  tenant: [
    async ({}, use, workerInfo) => {
      await use(originForSlot(workerInfo.parallelIndex));
    },
    { scope: 'worker' },
  ],

  baseURL: async ({ tenant }, use) => {
    await use(tenant);
  },

  mock: async ({ tenant, autoReset }, use) => {
    const mock = new MockClient(tenant);
    if (autoReset) await mock.reset();
    await use(mock);
  },

  page: async ({ page, mock, stubExternal }, use) => {
    bindMock(page, mock);
    if (stubExternal) await stubExternalNetwork(page.context());
    await use(page);
  },

  issues: [
    async ({ page, failOnPageIssues }, use, testInfo) => {
      const collector = attachCollector(page, { mockOrigin: MOCK_URL });
      await use(collector);
      collector.detach();
      const bad = collector.issues();
      if (bad.length > 0) {
        await testInfo.attach('page-issues.json', { body: JSON.stringify(bad, null, 2), contentType: 'application/json' });
        if (failOnPageIssues && testInfo.status === 'passed') {
          throw new Error(`Unexpected browser issues (${bad.length}):\n${formatIssues(bad)}`);
        }
      }
    },
    { auto: true },
  ],
});

export { expect };
