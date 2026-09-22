import { env } from '../src/config/env';
import { test } from '../src/fixtures';
import { registerForExam } from '../src/flows/exam';

test.describe('Реєстрація на іспит', { tag: '@foreign' }, () => {
  test('EXAM-01 Іноземному користувачу доступний пункт «Тільки для іноземних»', { tag: '@critical' }, async ({ app, loggedInUser }) => {
    await app.exams.open();
    await app.exams.selectExam(env.examName);
    await app.exams.expectTestCenterVisible(env.foreignTestCenter);
  });

  test('EXAM-04 Вибір пункту і таймслоту створює реєстрацію на іспит', { tag: ['@smoke', '@critical'] }, async ({ app, loggedInUser }) => {
    await registerForExam(app, { exam: env.examName, center: env.foreignTestCenter });
  });
});

test.describe('Пункти тестування: український користувач', { tag: '@ua' }, () => {
  test('EXAM-02 Пункт «Тільки для іноземних» недоступний українському користувачу', { tag: '@critical' }, async ({ uaApp }) => {
    await uaApp.exams.open();
    await uaApp.exams.selectExam(env.examName);
    await uaApp.exams.expectTestCenterHidden(env.foreignTestCenter);
  });

  test('EXAM-03 Вимкнена ознака повертає пункт до звичайної логіки', async ({ uaApp, admin }) => {
    const center = env.toggleTestCenter;
    const openCenters = async () => {
      await uaApp.exams.open();
      await uaApp.exams.selectExam(env.examName);
    };

    try {
      await test.step('Ознаку увімкнено → українському користувачу пункт не видно', async () => {
        await admin.testCenters.setForeignOnly(center, true);
        await openCenters();
        await uaApp.exams.expectTestCenterHidden(center);
      });

      await test.step('Ознаку вимкнено → пункт знову доступний за старою логікою', async () => {
        await admin.testCenters.setForeignOnly(center, false);
        await openCenters();
        await uaApp.exams.expectTestCenterVisible(center);
      });
    } finally {
      // Базовий стан TOGGLE_TEST_CENTER_NAME — ознака вимкнена
      await admin.testCenters.setForeignOnly(center, false);
    }
  });
});
