#!/usr/bin/env node
/**
 * Синхронізує автотести з QA Sphere (документація кейсів живе там):
 *   • папки «<rootFolder> / <область>» (з qasphere/catalog.json);
 *   • кейс для кожного тесту, якого ще немає в qasphere/cases.json (назва, кроки, передумова, пріоритет, теги);
 *   • --update  — оновити вже створені кейси (назва/кроки/пріоритет/теги);
 *   • --dry-run — лише показати, що буде зроблено;
 *   • --export  — записати qasphere/cases-to-create.json (готові payload-и кейсів) для створення агентом через MCP.
 *
 * Авторизація: $QASPHERE_API_KEY (як у qa-base), або `npx qasphere auth login` (OAuth), або QAS_TOKEN + QAS_URL у .env.
 * Проєкт — QAS_PROJECT у .env або --project=CODE.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createApi } from 'qas-cli/build/api/index.js';
import { resolveAuth } from 'qas-cli/build/utils/credentials/index.js';

try {
  process.loadEnvFile('.env');
} catch {
  /* без .env — змінні з оточення */
}

// Командний стандарт RG (qa-base/.mcp.json, qa-copilot): ключ у $QASPHERE_API_KEY з ~/.zshrc, тенант rg.eu1
if (!process.env.QAS_TOKEN && process.env.QASPHERE_API_KEY) {
  process.env.QAS_TOKEN = process.env.QASPHERE_API_KEY;
  process.env.QAS_URL ??= 'https://rg.eu1.qasphere.com';
}

const args = process.argv.slice(2);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const UPDATE = args.includes('--update');
const DRY_RUN = args.includes('--dry-run');
const EXPORT = args.includes('--export');
const MAP_PATH = 'qasphere/cases.json';

const catalog = readJson('qasphere/catalog.json');
const mapping = readJson(MAP_PATH);
const projectCode = option('project') || process.env.QAS_PROJECT || mapping.projectCode || (EXPORT ? '<CODE>' : undefined);
if (!projectCode) fail('Не задано проєкт QA Sphere: QAS_PROJECT у .env або --project=CODE');
if (mapping.projectCode && mapping.projectCode !== projectCode) {
  fail(`${MAP_PATH} вже прив'язаний до проєкту ${mapping.projectCode}, а запитано ${projectCode}`);
}

// 1. Тести з Playwright без запуску
const tests = collectTests(
  JSON.parse(execFileSync('node_modules/.bin/playwright', ['test', '--list', '--reporter=json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, INCLUDE_SLOW: '1' }, // документуємо й @slow-кейси
  })),
);
const toCreate = tests.filter((t) => !mapping.cases[t.title]);
const toUpdate = UPDATE ? tests.filter((t) => mapping.cases[t.title]) : [];
const orphans = Object.keys(mapping.cases).filter((title) => !tests.some((t) => t.title === title));

if (EXPORT) {
  const payload = tests.map((t) => ({
    title: t.title,
    folderPath: [catalog.rootFolder, areaOf(t)],
    type: 'standalone',
    ...caseBody(t),
  }));
  fs.writeFileSync('qasphere/cases-to-create.json', JSON.stringify({ rootFolder: catalog.rootFolder, total: payload.length, cases: payload }, null, 2) + '\n');
  console.log(`Записано qasphere/cases-to-create.json: ${payload.length} кейсів`);
  process.exit(0);
}

console.log(`Тестів з ID: ${tests.length} · нових кейсів: ${toCreate.length} · оновити: ${toUpdate.length} · проєкт ${projectCode}`);
for (const title of orphans) console.warn(`⚠ У cases.json є «${title}», але такого тесту немає (перейменовано/видалено?) — виправ ключ вручну`);
if (DRY_RUN) {
  for (const t of toCreate) console.log(`  + [${areaOf(t)}] ${t.title} (${priorityOf(t.tags)})`);
  for (const t of toUpdate) console.log(`  ~ ${markerOf(mapping.cases[t.title])} ${t.title}`);
  process.exit(0);
}
if (!toCreate.length && !toUpdate.length) process.exit(0);

// 2. API з тими ж обліковими даними, що й qas-cli
const { token, baseUrl } = await resolveAuth();
const api = createApi(baseUrl, token);

// 3. Папки: одна на область
const areaIds = [...new Set(tests.map((t) => t.caseId.split('-')[0]))];
const rootComment =
  '<p>Автотести e2e (Playwright) для реєстрації, модерації, входу за кодом та іспитів іноземних користувачів. ' +
  'Кейси створює і оновлює <code>npm run qasphere:sync</code> з репозиторію e2e-ukr-cert; результати прогонів — <code>npm run report:qasphere</code>.</p>' +
  (process.env.TEST_PLAN_URL ? `<p><a href="${process.env.TEST_PLAN_URL}">Тест-план</a></p>` : '');
const { ids } = await api.folders.bulkCreate(projectCode, [
  { path: [catalog.rootFolder], comment: rootComment },
  ...areaIds.map((a) => ({ path: [catalog.rootFolder, catalog.areas[a] ?? a] })),
]);
const folderIdByArea = Object.fromEntries(areaIds.map((a, i) => [a, ids[i + 1].at(-1)]));

// 4. Кейси
mapping.projectCode = projectCode;
mapping.baseUrl = baseUrl.replace(/\/+$/, '');
for (const t of toCreate) {
  const { seq } = await api.testCases.create(projectCode, { ...caseBody(t), type: 'standalone', folderId: folderIdByArea[t.caseId.split('-')[0]] });
  mapping.cases[t.title] = seq;
  save(); // після кожного кейсу — щоб падіння посередині не загубило вже створені
  console.log(`  + ${markerOf(seq)} ${t.title}`);
}
for (const t of toUpdate) {
  await api.testCases.update(projectCode, String(mapping.cases[t.title]), caseBody(t));
  console.log(`  ~ ${markerOf(mapping.cases[t.title])} ${t.title}`);
}
console.log(`Готово. Мапінг — ${MAP_PATH} (закоміть його).`);

// ────────────────────────────────────────────────────────────
function collectTests(report) {
  const byTitle = new Map();
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      const caseId = spec.title.match(/^([A-Z]+-\d+)/)?.[1];
      if (caseId && !byTitle.has(spec.title)) {
        byTitle.set(spec.title, { title: spec.title, caseId, file: spec.file, tags: spec.tags.map((tag) => tag.replace(/^@/, '')) });
      }
    }
    (suite.suites ?? []).forEach(walk);
  };
  report.suites.forEach(walk);
  // Порядок як у тест-плані: області з catalog.areas, всередині — за номером кейсу
  const areaOrder = Object.keys(catalog.areas);
  const rank = (t) => areaOrder.indexOf(t.caseId.split('-')[0]);
  return [...byTitle.values()].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, 'uk', { numeric: true }));
}

function caseBody(t) {
  const info = catalog.cases[t.caseId];
  if (!info) console.warn(`⚠ Немає опису ${t.caseId} у qasphere/catalog.json — кейс буде без кроків`);
  const html = (text) => `<p>${escapeHtml(text)}</p>`;
  return {
    title: t.title,
    priority: priorityOf(t.tags),
    tags: [...new Set(['automated', ...t.tags])],
    ...(info?.precondition && { precondition: { text: html(info.precondition) } }),
    steps: (info?.steps ?? []).map((s) => ({ description: html(s.action), expected: html(s.expected) })),
    ...(process.env.TEST_PLAN_URL && { requirements: [{ text: 'Тест-план: іспити для іноземних користувачів', url: process.env.TEST_PLAN_URL }] }),
    ...(process.env.REPO_URL && { links: [{ text: `Автотест: tests/${t.file}`, url: `${process.env.REPO_URL}/tests/${t.file}` }] }),
  };
}

function priorityOf(tags) {
  if (tags.some((t) => t === 'blocker' || t === 'critical')) return 'high';
  if (tags.some((t) => t === 'minor' || t === 'trivial')) return 'low';
  return 'medium';
}

function areaOf(t) {
  return catalog.areas[t.caseId.split('-')[0]] ?? t.caseId;
}

function markerOf(seq) {
  return `${projectCode}-${String(seq).padStart(3, '0')}`;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function save() {
  const sorted = Object.fromEntries(Object.entries(mapping.cases).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(MAP_PATH, JSON.stringify({ ...mapping, cases: sorted }, null, 2) + '\n');
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
