/**
 * Shared jest helper: replaces the HTTP methods of `@/lib/api/client` with mocks while keeping the real
 * pure helpers (`buildUrl`, ...). Import this FIRST in a test file, after calling `jest.mock` for the client:
 *
 *   jest.mock('@/lib/api/client', () => require('./apiMock').clientMock());
 */
export function clientMock(): Record<string, unknown> {
  const actual = jest.requireActual('@/lib/api/client') as Record<string, unknown>;
  return {
    ...actual,
    api: {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      upload: jest.fn(),
    },
  };
}
