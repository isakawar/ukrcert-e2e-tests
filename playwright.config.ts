import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';
import { foreignGeoUse } from './src/config/geo';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 90_000, // e2e-ланцюги з листами довші за дефолтні 30 с
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  // @slow (реальне очікування спливання коду) — лише за INCLUDE_SLOW=1
  grepInvert: env.includeSlow ? undefined : /@slow/,

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['allure-playwright', { resultsDir: 'allure-results', detail: true, suiteTitle: true }],
    // Для QA Sphere: JSON-звіт + авто-завантаження після прогону при QAS_REPORT=1 (порядок важливий)
    ['json', { outputFile: 'test-results/qasphere-report.json' }],
    ['./src/reporting/qasphereReporter.ts'],
  ],

  use: {
    baseURL: env.baseUrl,
    locale: 'uk-UA', // інтерфейс і листи поки лише українською
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: (process.env.VIDEO as 'on' | 'retain-on-failure' | undefined) ?? 'retain-on-failure', // VIDEO=on — відео кожного тесту
    launchOptions: { slowMo: Number(process.env.SLOW_MO ?? 0) }, // SLOW_MO=400 — пауза між діями, зручно дивитись
    actionTimeout: 15_000,
  },

  // Порядок важливий для UI Mode: за замовчуванням він показує перший проєкт → foreign (реєстрація)
  projects: [
    {
      name: 'foreign',
      grep: /@foreign/,
      workers: env.foreignWorkers,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], timezoneId: 'America/Toronto', ...foreignGeoUse() },
    },
    {
      name: 'ua',
      grep: /@ua/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], timezoneId: 'Europe/Kyiv' },
    },
    // Логін адміністратора і відповідального → .auth/*.json (залежність foreign/ua, запускається сама)
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },
  ],
});
