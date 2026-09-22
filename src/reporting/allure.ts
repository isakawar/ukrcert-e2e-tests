import type { TestInfo } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { env } from '../config/env';
import catalog from '../../qasphere/catalog.json';
import qasphereCases from '../../qasphere/cases.json';
import type { MailMessage } from '../services/mail';

/** Префікс ID кейсу → область (feature в Allure, папка в QA Sphere). Одне джерело — qasphere/catalog.json. */
const AREAS: Record<string, string> = catalog.areas;

/** Мапінг «назва тесту → номер кейсу в QA Sphere» (генерує npm run qasphere:sync). */
const qasphere = qasphereCases as unknown as { projectCode: string | null; baseUrl: string | null; cases: Record<string, number> };

const SEVERITIES = ['blocker', 'critical', 'normal', 'minor', 'trivial'] as const;

/**
 * Викликається авто-фікстурою для кожного тесту: ID кейсу береться з назви («REG-05 …»),
 * тож у спеках немає ручної Allure-розмітки. Severity — з тегу (@critical, @blocker…).
 */
export async function applyAllureMeta(testInfo: TestInfo) {
  if (testInfo.project.name === 'foreign' || testInfo.project.name === 'ua') {
    await allure.label('geo', testInfo.project.name); // → environments в allurerc.mjs
  }
  const caseId = testInfo.title.match(/^([A-Z]+-\d+)/)?.[1];
  if (!caseId) return;

  const area = caseId.split('-')[0];
  await allure.epic(area === 'INFRA' ? 'Інфраструктура' : 'Іноземні користувачі');
  await allure.feature(AREAS[area] ?? area);
  await allure.story(caseId);
  await allure.label('caseId', caseId);
  await allure.severity(SEVERITIES.find((s) => testInfo.tags.includes(`@${s}`)) ?? 'normal');
  if (env.reportOwner) await allure.owner(env.reportOwner);
  if (env.testPlanUrl) await allure.link(env.testPlanUrl, 'Тест-план');

  // Прив'язка до кейсу QA Sphere: анотацію читає `qasphere playwright-json-upload`, TMS-посилання — Allure
  const seq = qasphere.cases[testInfo.title];
  if (seq && qasphere.projectCode && qasphere.baseUrl) {
    const url = `${qasphere.baseUrl}/project/${qasphere.projectCode}/tcase/${seq}`;
    testInfo.annotations.push({ type: 'test case', description: url });
    await allure.tms(url, `${qasphere.projectCode}-${String(seq).padStart(3, '0')}`);
  }
}

/** Лист (активація, код, відмова) видно прямо в кроці звіту. */
export async function attachEmail(message: MailMessage) {
  await allure.attachment(
    `Лист: ${message.subject}`,
    message.html || message.text,
    message.html ? 'text/html' : 'text/plain',
  );
}

export async function attachJson(name: string, data: unknown) {
  await allure.attachment(name, JSON.stringify(data, null, 2), 'application/json');
}
