/** Page -> mock client registry (filled by the `page` fixture) so helpers can find the worker's tenant. */
import type { Page } from '@playwright/test';

import type { MockClient } from './mock';

const registry = new WeakMap<Page, MockClient>();

export function bindMock(page: Page, mock: MockClient): void {
  registry.set(page, mock);
}

export function boundMock(page: Page): MockClient | undefined {
  return registry.get(page);
}
