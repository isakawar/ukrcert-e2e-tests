import { test } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { fileNameOf } from '../data/documents';
import type { ForeignUser } from '../data/users';
import type { UserApp } from '../pages';
import { attachJson } from '../reporting/allure';

/** Головна → «Зареєструватися» → email → форма заявки відкрита. */
export async function openRegistrationForm(app: UserApp, email: string) {
  await test.step(`Відкрити заявку на реєстрацію для ${email}`, async () => {
    await app.entry.open();
    await app.entry.goToRegistration();
    await app.registration.submitEmail(email);
    await app.registration.waitFor(app.registration.form, 'Продовжити (email)');
  });
}

/** Повна подача заявки. Повертає ідентифікатор заявки зі сторінки статусу. */
export async function registerForeignUser(app: UserApp, user: ForeignUser): Promise<string> {
  return test.step(`Реєстрація іноземного користувача ${user.email}`, async () => {
    await attachJson('Тестовий користувач', { ...user, document: fileNameOf(user.document) });
    await openRegistrationForm(app, user.email);
    await app.registration.fill(user);
    await app.registration.submit();
    const applicationId = await app.registration.expectSubmittedForModeration();
    await allure.parameter('Заявка', applicationId);
    return applicationId;
  });
}
