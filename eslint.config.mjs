import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default defineConfig(
  { ignores: ['node_modules/', 'test-results/', 'playwright-report/', 'allure-results/', 'allure-report/', 'allure-history/', 'reports/', '*.mjs'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // Головний біль Playwright-тестів — забутий await
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
  {
    ...playwright.configs['flat/recommended'],
    files: ['tests/**/*.ts'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Перевірки частково живуть у flows/pages (expect*-методи)
      // Фікстури станів (loggedInUser…) потрібні тесту як передумова, навіть якщо змінна не читається
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
      'playwright/expect-expect': ['warn', { assertFunctionPatterns: ['^expect', 'Flow$', '^register', '^approve', '^reject', '^activate', '^login'] }],
    },
  },
);
