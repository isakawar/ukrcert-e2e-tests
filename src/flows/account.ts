import { expect, test } from '@playwright/test';
import type { UserApp } from '../pages';
import { attachEmail } from '../reporting/allure';
import { extractActivationLink, extractOtpCode, hasActivationLink, hasOtpCode, type MailClient } from '../services/mail';

/** Чекає лист з посиланням активації → повертає посилання (без переходу). */
export async function getActivationLink(mail: MailClient, email: string): Promise<string> {
  return test.step('Отримати лист з посиланням активації', async () => {
    const message = await mail.waitForMessage({ to: email, match: hasActivationLink, description: 'Лист з посиланням активації' });
    await attachEmail(message);
    return extractActivationLink(message);
  });
}

export async function activateAccount(app: UserApp, mail: MailClient, email: string) {
  await test.step(`Активація акаунта ${email}`, async () => {
    await app.account.openActivationLink(await getActivationLink(mail, email));
    await expect(app.account.activatedNotice).toBeVisible();
  });
}

/** Вводить email і повертає свіжий код із пошти (старі листи ігноруються). */
export async function requestOtp(app: UserApp, mail: MailClient, email: string): Promise<string> {
  return test.step(`Запит одноразового коду для ${email}`, async () => {
    const before = await mail.listIds(email);
    await app.entry.open();
    await app.entry.goToLogin();
    await app.otp.requestCode(email);
    await expect(app.otp.codeInput).toBeVisible();
    const message = await mail.waitForMessage({ to: email, match: hasOtpCode, excludeIds: before, description: 'Лист з одноразовим кодом' });
    await attachEmail(message);
    return extractOtpCode(message);
  });
}

export async function loginWithOtp(app: UserApp, mail: MailClient, email: string) {
  await test.step(`Вхід за одноразовим кодом ${email}`, async () => {
    await app.otp.submitCode(await requestOtp(app, mail, email));
    await expect(app.otp.loggedInMarker).toBeVisible();
  });
}
