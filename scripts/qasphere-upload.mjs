#!/usr/bin/env node
/**
 * Завантажує результати останнього прогону в QA Sphere як новий тест-ран (або в наявний: -r <url рану>).
 * Кейси зіставляються за анотацією «test case» (URL кейсу), яку ставить авто-фікстура з qasphere/cases.json.
 * Авторизація: $QASPHERE_API_KEY (як у qa-base), або `npx qasphere auth login`, або QAS_TOKEN + QAS_URL у .env.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

try {
  process.loadEnvFile('.env');
} catch {
  /* без .env */
}

// Командний стандарт RG (qa-base/.mcp.json, qa-copilot): ключ у $QASPHERE_API_KEY з ~/.zshrc, тенант rg.eu1
if (!process.env.QAS_TOKEN && process.env.QASPHERE_API_KEY) {
  process.env.QAS_TOKEN = process.env.QASPHERE_API_KEY;
  process.env.QAS_URL ??= 'https://rg.eu1.qasphere.com';
}

if (!process.env.QAS_TOKEN && !fs.existsSync('.qaspherecli')) {
  const hint = 'задай QASPHERE_API_KEY (Docker: export у shell перед docker compose; GitHub: секрет QASPHERE_API_KEY)';
  if (process.env.CI || fs.existsSync('/.dockerenv')) {
    console.error(`✖ QA Sphere: немає ключа — ${hint}`);
    process.exit(1);
  }
  console.warn(`ℹ QA Sphere: QAS_TOKEN не задано — пробую вхід через qasphere auth login; інакше ${hint}`);
}

const REPORT = 'test-results/qasphere-report.json';
if (!fs.existsSync(REPORT)) {
  console.error(`✖ Немає ${REPORT} — спершу запусти тести (npm test / npm run test:reg)`);
  process.exit(1);
}

const passthrough = process.argv.slice(2);
const toExistingRun = passthrough.some((a) => a === '-r' || a.startsWith('--run-url'));
const { projectCode, cases } = JSON.parse(fs.readFileSync('qasphere/cases.json', 'utf8'));
if (!toExistingRun && !Object.keys(cases).length) {
  console.error('✖ qasphere/cases.json порожній — спершу створи кейси в QA Sphere (агент через MCP або npm run qasphere:sync)');
  process.exit(1);
}
const project = process.env.QAS_PROJECT || projectCode;
const env = process.env.ENV_NAME ?? 'dev';
const build = process.env.BUILD_VERSION ? ` · ${process.env.BUILD_VERSION}` : '';
const runName = process.env.QAS_RUN_NAME ?? `E2E · ${env} · {YYYY}-{MM}-{DD} {HH}:{mm}${build}`;

const args = [
  'qasphere',
  'playwright-json-upload',
  ...(toExistingRun ? [] : ['--project-code', project, '--run-name', runName]),
  '--attachments', // скріншоти, відео, trace на падіннях
  '--ignore-unmatched', // setup-тести без кейсів
  ...passthrough,
  REPORT,
];
if (!toExistingRun && !project) {
  console.error('✖ Не задано проєкт: QAS_PROJECT у .env або спершу npm run qasphere:sync');
  process.exit(1);
}
const { status } = spawnSync('node_modules/.bin/qasphere', args.slice(1), { stdio: 'inherit' });
process.exit(status ?? 1);
