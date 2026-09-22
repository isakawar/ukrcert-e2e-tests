import { env } from '../src/config/env';
import { test, expect } from '../src/fixtures';
import { activateAccount, getActivationLink, requestOtp } from '../src/flows/account';

test.describe('Активація та авторизація', { tag: '@foreign' }, () => {
  test('AUTH-01 Посилання активації активує акаунт', { tag: ['@smoke', '@critical'] }, async ({ app, mail, approvedUser }) => {
    await activateAccount(app, mail, approvedUser.email);
  });

  test('AUTH-02 Повторний перехід за використаним посиланням не активує вдруге', async ({ app, mail, approvedUser }) => {
    const link = await getActivationLink(mail, approvedUser.email);
    await app.account.openActivationLink(link);
    await expect(app.account.activatedNotice).toBeVisible();

    await app.account.openActivationLink(link);
    await expect(app.account.activationFailedNotice).toBeVisible();
  });

  test('AUTH-03 Для активного користувача на email надходить одноразовий код', { tag: '@critical' }, async ({ app, mail, activeUser }) => {
    const code = await requestOtp(app, mail, activeUser.email);
    expect(code).toMatch(/^\d+$/);
  });

  test('AUTH-04 Правильний код протягом 10 хв дає доступ до платформи', { tag: ['@smoke', '@blocker'] }, async ({ app, loggedInUser }) => {
    // Увесь вхід виконує фікстура loggedInUser; тут — фінальна перевірка стану
    await expect(app.otp.loggedInMarker).toBeVisible();
  });

  test('AUTH-05 Код після спливання строку дії не приймається', { tag: '@slow' }, async ({ app, mail, activeUser }) => {
    test.setTimeout((env.otpTtlSeconds + 180) * 1000);
    const code = await requestOtp(app, mail, activeUser.email);

    await test.step(`Чекаємо ${env.otpTtlSeconds + 15} с, поки сплине строк дії коду`, async () => {
      // eslint-disable-next-line playwright/no-wait-for-timeout -- чекаємо саме серверний TTL коду
      await app.page.waitForTimeout((env.otpTtlSeconds + 15) * 1000);
    });

    await app.otp.submitCode(code);
    await expect(app.otp.expiredError).toBeVisible();
    await expect(app.otp.loggedInMarker).toBeHidden();
  });

  test('AUTH-06 Неправильний код не дає доступу', { tag: '@critical' }, async ({ app, mail, activeUser }) => {
    const code = await requestOtp(app, mail, activeUser.email);
    const wrongCode = String((Number(code) + 1) % 10 ** code.length).padStart(code.length, '0');

    await app.otp.submitCode(wrongCode);
    await expect(app.otp.invalidError).toBeVisible();
    await expect(app.otp.loggedInMarker).toBeHidden();
  });
});
