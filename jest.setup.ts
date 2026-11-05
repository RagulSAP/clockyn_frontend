// Global jest setup for Clockyn unit tests.
// Native modules are mocked per-test or in `src/test/mocks`; keep this file minimal.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
