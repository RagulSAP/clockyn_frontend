// Global jest setup for Clockyn unit tests.
// Native modules are mocked per-test or in `src/test/mocks`; keep this file minimal.

// The app has no default backend address (src/config/env.ts); tests use a fixed local one.
process.env.EXPO_PUBLIC_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
