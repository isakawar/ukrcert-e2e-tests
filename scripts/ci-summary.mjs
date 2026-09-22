#!/usr/bin/env node
/**
 * Markdown-підсумок прогону для GitHub Actions (Job Summary).
 * Вхід: Playwright JSON (test-results/qasphere-report.json) + лог прогону (для посилання на QA Sphere-ран).
 * Використання: node scripts/ci-summary.mjs [report.json] [run.log] >> "$GITHUB_STEP_SUMMARY"
 */
import fs from 'node:fs';

const [reportPath = 'test-results/qasphere-report.json', logPath = 'run.log'] = process.argv.slice(2);
const out = [];

if (!fs.existsSync(reportPath)) {
  console.log(`## ❌ E2E: звіт не створено\n\nФайлу \`${reportPath}\` немає — прогін упав до завершення тестів (див. лог кроку «Тести»).`);
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const tests = [];
const walk = (suite) => {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) tests.push({ title: spec.title, file: spec.file, project: t.projectName, status: t.status, result: t.results.at(-1) });
  }
  (suite.suites ?? []).forEach(walk);
};
report.suites.forEach(walk);

const count = (s) => tests.filter((t) => t.status === s).length;
const [passed, failed, flaky, skipped] = ['expected', 'unexpected', 'flaky', 'skipped'].map(count);
const minutes = ((report.stats?.duration ?? 0) / 60000).toFixed(1);
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').replace(/\x1b\[[0-9;]*m/g, '') : '';
const qasRun = log.match(/Test run URL: (\S+)/)?.[1];

out.push(`## ${failed ? '❌' : '✅'} E2E УкрСертифікація · іноземні користувачі`);
out.push('');
out.push('| ✅ Пройдено | ❌ Впало | ⚠️ Flaky | ⏭ Пропущено | ⏱ Тривалість |');
out.push('| --- | --- | --- | --- | --- |');
out.push(`| ${passed} | ${failed} | ${flaky} | ${skipped} | ${minutes} хв |`);
out.push('');
out.push(qasRun ? `**QA Sphere:** [тест-ран з результатами](${qasRun})` : '**QA Sphere:** ран не створювався (вимкнено або помилка завантаження — див. лог).');
out.push('');

const firstLine = (t) =>
  (t.result?.errors?.[0]?.message ?? t.result?.error?.message ?? '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split('\n')
    .find((l) => l.trim())
    ?.trim()
    .slice(0, 180) ?? '';

const failedTests = tests.filter((t) => t.status === 'unexpected' || t.status === 'flaky');
if (failedTests.length) {
  out.push('### Падіння');
  out.push('');
  out.push('| Тест | Проєкт | Помилка |');
  out.push('| --- | --- | --- |');
  for (const t of failedTests) {
    out.push(`| ${t.status === 'flaky' ? '⚠️ ' : ''}${t.title} | ${t.project} | \`${firstLine(t).replace(/\|/g, '\\|').replace(/`/g, "'")}\` |`);
  }
  out.push('');
}

out.push('Звіти — в артефактах прогону: **allure-report** (відкрити `awesome/index.html`), **playwright-report**, **test-results** (trace/відео падінь).');
console.log(out.join('\n'));
