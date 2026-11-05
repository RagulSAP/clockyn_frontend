/** Test double for `@/lib/navigation` (used through `jest.mock('@/lib/navigation', () => require('../testing/navigationMock'))`). */
import { routes } from '@/config/routes';

export { routes };

export const routerMock = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  backOr: jest.fn(),
  dismissAll: jest.fn(),
  canGoBack: jest.fn(() => true),
  goHome: jest.fn(),
};

export function useAppRouter() {
  return routerMock;
}
