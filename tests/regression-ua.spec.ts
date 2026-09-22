import { env } from '../src/config/env';
import { test, expect } from '../src/fixtures';

test.describe('Регресія українського флоу (smoke)', { tag: '@ua' }, () => {
  test('REGR-01 Вхід через Дію доступний і веде на сторінку Дії', { tag: ['@smoke', '@critical'] }, async ({ app }) => {
    // Саму держ-авторизацію не автоматизуємо — лише перевіряємо, що точку входу не зламали
    await app.entry.open();
    await expect(app.entry.diiaLogin.first()).toBeVisible();
    await app.entry.diiaLogin.first().click();
    await expect(app.page).toHaveURL(/diia\.gov\.ua|id\.gov\.ua/);
  });

  test('REGR-02 Звичайний пункт тестування доступний українському користувачу', async ({ uaApp }) => {
    await uaApp.exams.open();
    await uaApp.exams.selectExam(env.examName);
    await uaApp.exams.expectTestCenterVisible(env.regularTestCenter);
  });
});
