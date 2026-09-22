import { spawnSync } from 'node:child_process';
import type { Reporter } from '@playwright/test/reporter';

/**
 * Після прогону створює тест-ран у QA Sphere з результатами (скрипт scripts/qasphere-upload.mjs).
 * Вмикається QAS_REPORT=1 (npm run test:qas, CI) — локальні налагоджувальні прогони QA Sphere не засмічують.
 * Працює в onExit: на цей момент усі репортери, зокрема JSON для QA Sphere, уже дописали файли.
 */
export default class QaSphereReporter implements Reporter {
  private executed = 0;

  printsToStdio() {
    return false;
  }

  onTestEnd() {
    this.executed++;
  }

  async onExit() {
    if (this.executed === 0) return; // --list і порожні прогони
    if (process.env.QAS_REPORT !== '1') {
      console.log('\nℹ QA Sphere: тест-ран не створюється (QAS_REPORT≠1). Залити цей прогін: npm run report:qasphere');
      return;
    }
    console.log('\n📤 QA Sphere: створюю тест-ран з результатами…');
    const { status } = spawnSync('node', ['scripts/qasphere-upload.mjs'], { stdio: 'inherit' });
    if (status !== 0) console.error('⚠ QA Sphere: завантаження не вдалося (див. вище). Повторити вручну: npm run report:qasphere');
  }
}
