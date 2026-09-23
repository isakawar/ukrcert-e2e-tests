import fs from 'node:fs';
import { test as base, expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import { env } from '../config/env';
import { buildForeignUser, type ForeignUser } from '../data/users';
import { loginWithOtp } from '../flows/account';
import { registerForExam } from '../flows/exam';
import { adminApp, proctorApp, userApp, type AdminApp, type ProctorApp, type UserApp } from '../pages';
import { applyAllureMeta } from '../reporting/allure';
import { createMailClient, type MailClient } from '../services/mail';
import { AUTH_FILES } from './authFiles';
import { RUN_APPLICANTS, runState, type Applicant } from './runState';

type Fixtures = {
  /** Сторінки іноземного користувача у вкладці `page` (гео — з проєкту). */
  app: UserApp;
  /** Адміністратор (модерація, пункти тестування) — окремий контекст, звичайний IP. */
  admin: AdminApp;
  /** Відповідальний за пункт тестування (допуск). */
  proctor: ProctorApp;
  /** Український користувач, залогінений через Дію (сесія з UA_USER_STORAGE_STATE). */
  uaApp: UserApp;
  mail: MailClient;

  /** Дані для нової заявки (сама заявка не створюється). */
  newUser: ForeignUser;
  // Стани заявника A цього прогону (tests/journey.spec.ts) — нових заявок ці фікстури не створюють
  approvedUser: Applicant;
  loggedInUser: Applicant;
  examRegisteredUser: Applicant;

  allureMeta: void;
};

/** Кейси, яким потрібен співробітник, пропускаються, поки немає його сесії (етап 1 — лише реєстрація). */
function requireStaffSession(testInfo: TestInfo, file: string) {
  testInfo.skip(!fs.existsSync(file), `Немає сесії співробітника (${file}): задай ADMIN_* у .env — кейс з етапу модерації`);
}

async function withContext(browser: Browser, options: Parameters<Browser['newContext']>[0], use: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ locale: 'uk-UA', ...options });
  await use(await context.newPage());
  await context.close();
}

export const test = base.extend<Fixtures>({
  allureMeta: [
    async ({}, use, testInfo) => {
      await applyAllureMeta(testInfo);
      await use();
    },
    { auto: true },
  ],

  mail: async ({}, use, testInfo) => {
    // Очікування листа (до 90 с) + дії навколо не вміщаються в дефолтні 90 с тесту
    testInfo.setTimeout(Math.max(testInfo.timeout, 180_000));
    await use(createMailClient());
  },

  app: async ({ page }, use) => {
    await use(userApp(page));
  },

  admin: async ({ browser }, use, testInfo) => {
    requireStaffSession(testInfo, AUTH_FILES.admin);
    await withContext(browser, { storageState: AUTH_FILES.admin, baseURL: env.adminBaseUrl }, (page) => use(adminApp(page)));
  },

  proctor: async ({ browser }, use, testInfo) => {
    const storageState = env.proctorEmail ? AUTH_FILES.proctor : AUTH_FILES.admin;
    requireStaffSession(testInfo, storageState);
    await withContext(browser, { storageState, baseURL: env.adminBaseUrl }, (page) => use(proctorApp(page)));
  },

  uaApp: async ({ browser }, use, testInfo) => {
    const storageState = env.uaUserStorageState;
    testInfo.skip(!storageState, 'UA_USER_STORAGE_STATE не задано: потрібна сесія українського користувача (вхід через Дію) — див. README');
    await withContext(browser, { storageState, baseURL: env.baseUrl, timezoneId: 'Europe/Kyiv' }, (page) => use(userApp(page)));
  },

  newUser: async ({ mail }, use) => {
    await use(buildForeignUser(mail.newAddress()));
  },

  // Ліміт — 1-2 заявки на прогін, тож етапи після модерації беруть схваленого заявника A, а не реєструють нового
  approvedUser: async ({}, use, testInfo) => {
    testInfo.skip(!env.hasAdmin, 'ADMIN_EMAIL не задано: схваленого заявника немає');
    await use(runState.get(RUN_APPLICANTS.approved, 'MOD-03'));
  },

  loggedInUser: async ({ approvedUser, app, mail }, use) => {
    await loginWithOtp(app, mail, approvedUser.email);
    await use(approvedUser);
  },

  examRegisteredUser: async ({ loggedInUser, app }, use) => {
    await registerForExam(app, { exam: env.examName, center: env.foreignTestCenter });
    await use(loggedInUser);
  },
});

export { expect };
