/**
 * Smoke: every route of the registry (src/config/routes.ts) renders real content for an appropriate session, with no
 * uncaught errors / console errors / missing mock endpoints (enforced by the page-issue collector, see support/test.ts),
 * on both the desktop and the phone project. A screenshot per route is stored in e2e/.artifacts/screenshots/<project>/.
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, expectRendered, loginAs, registryEntries, test, visit, waitForAppReady } from '../support';
import { buildRouteCases } from '../support/routeCases';

const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const cases = buildRouteCases(today);
const shotDir = path.join(
  process.env.E2E_ARTIFACTS ? path.resolve(__dirname, '..', '..', process.env.E2E_ARTIFACTS) : path.join(__dirname, '..', '.artifacts'),
  'screenshots',
);

/** Messages the app's ErrorState / failed queries show; none of them may be on screen in the happy path. */
const ERROR_TEXT = /Something went wrong|Failed to load|Network connection failed|Request failed|Server error/i;

test('registry coverage: every route in src/config/routes.ts has a smoke case', () => {
  const covered = new Set(cases.map((c) => c.path));
  const missing = registryEntries().filter((e) => !covered.has(e.path));
  expect(missing, 'routes without a smoke case (extend support/routeCases.ts)').toEqual([]);
});

test.describe('route smoke', () => {
  for (const c of cases) {
    const title = `${c.key} ${c.role ? `[${c.role}]` : '[signed out]'}`;
    test(title, async ({ page }, testInfo) => {
      if (c.role) await loginAs(page, c.role);

      const finalPath = await visit(page, c.path, c.params);
      expect(finalPath, `${c.path} must not redirect for ${c.role ?? 'a signed-out visitor'}`).toBe(c.path);

      await expectRendered(page);
      await expect(page.getByText(ERROR_TEXT)).toHaveCount(0);

      // let entrance animations / first data paint settle before the picture
      await waitForAppReady(page, { idle: true });
      const dir = path.join(shotDir, testInfo.project.name);
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `${c.key.replace(/[^a-z0-9.#-]+/gi, '_').replace('#', '--')}.png`) });
    });
  }
});
