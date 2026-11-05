const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'e2e/.artifacts*/**', 'coverage/*'],
  },
  {
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // E2E harness (Node scripts + Playwright specs): Node globals, console output and Playwright's `use` fixture callback are fine.
    files: ['e2e/**/*.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-console': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'no-empty-pattern': 'off',
      'import/first': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
