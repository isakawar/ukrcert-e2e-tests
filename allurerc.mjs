import { defineConfig } from 'allure';

// Ті ж змінні, що й у тестів: звіт показує, на якому оточенні та в якому гео-режимі був прогін
try {
  process.loadEnvFile('.env');
} catch {
  /* у CI змінні вже в оточенні */
}
const e = process.env;
const REPORT_NAME = 'УкрСертифікація · іноземні користувачі';
const hasLabel = (labels, name, value) => labels.some((l) => l.name === name && (value === undefined || l.value === value));
const hasTag = (tr, tag) => tr.labels.some((l) => l.name === 'tag' && l.value.replace(/^@/, '') === tag);

export default defineConfig({
  name: REPORT_NAME,
  output: './allure-report',
  historyPath: './allure-history/history.jsonl', // тренди між прогонами (у CI — кешувати цю теку)
  historyLimit: 30,

  variables: {
    'Оточення': e.ENV_NAME ?? 'dev',
    'Base URL': e.BASE_URL ?? '—',
    'Гео-режим': e.GEO_MODE ?? 'none',
    'Збірка': e.BUILD_VERSION || '—',
  },

  // Звіт ділиться на два оточення за міткою geo, яку ставить авто-фікстура
  environments: {
    foreign: { name: 'Іноземний користувач (CA)', matcher: ({ labels }) => hasLabel(labels, 'geo', 'foreign') },
    ua: { name: 'Український користувач (UA)', matcher: ({ labels }) => hasLabel(labels, 'geo', 'ua') },
  },

  // Перша відповідна категорія виграє → порядок важливий
  categories: {
    rules: [
      { name: 'Інфраструктура: пошта', matchers: { message: /\[mail\]/ }, groupByMessage: false },
      { name: 'Інфраструктура: гео (функціонал для іноземців не ввімкнувся)', matchers: { message: /\[geo\]/ } },
      { name: 'Оточення не налаштоване', matchers: { message: /\[env\]/ } },
      { name: 'Інфраструктура: dev відхилив запит (403, ліміт частоти)', matchers: { message: /\[ratelimit\]/ } },
      { name: 'Нестабільні тести (flaky)', matchers: { flaky: true } },
      {
        name: 'Елемент не знайдено під час дії (UI/локатор змінився)',
        matchers: { message: /^(locator|page|frame)\.\w+: Timeout/ },
        groupBy: [{ label: 'feature' }],
      },
      {
        name: 'Перевірка не пройшла (ймовірний дефект продукту)',
        matchers: { statuses: ['failed'] },
        groupBy: [{ label: 'feature' }],
      },
    ],
  },

  // `npx allure quality-gate` у CI: smoke має бути повністю зеленим
  qualityGate: {
    rules: [{ id: 'smoke', maxFailures: 0, filter: (tr) => hasTag(tr, 'smoke') }],
  },

  plugins: {
    awesome: {
      options: {
        reportName: REPORT_NAME,
        reportLanguage: 'uk',
        singleFile: true, // index.html відкривається без сервера (артефакт GitHub Actions)
        groupBy: ['epic', 'feature', 'story'],
        layout: 'split',
      },
    },
    dashboard: { options: { reportName: `${REPORT_NAME} · дашборд`, singleFile: true } },
  },
});
