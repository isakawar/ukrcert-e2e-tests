import fs from 'node:fs';
import { env } from '../src/config/env';
import { fileNameOf } from '../src/data/documents';
import { test, expect } from '../src/fixtures';
import { RUN_APPLICANTS, runState } from '../src/fixtures/runState';
import { activateAccount, getActivationLink, requestOtp } from '../src/flows/account';
import { approveApplication, expectDecisionLetter, findLmsAccount } from '../src/flows/moderation';
import { registerForeignUser } from '../src/flows/registration';
import { findActivationLink } from '../src/services/mail';

const EMAIL_BLOCKED = 'Не можна продовжити реєстрацію з цією адресою електронної пошти.';

/**
 * Заявка A — перша з двох справжніх заявок за прогін (друга — tests/moderation.spec.ts):
 * REG-05 подає → дублікати (REG-13/17) → модерація (MOD-01/02) → схвалення (MOD-03) → вхід (REG-04, AUTH).
 * Кейси йдуть по черзі в одному воркері; після падіння наступні все одно запускаються (стан — у runState).
 * Без повторів: retry REG-05 створив би ще одну заявку.
 */
test.describe('Заявка A: подача → модерація → схвалення → вхід', { tag: '@foreign' }, () => {
  test.describe.configure({ mode: 'default', retries: 0 });
  const applicant = () => runState.get(RUN_APPLICANTS.approved, 'REG-05');

  test('REG-05 Повна заявка з PDF → статус «Очікує перевірки», акаунт ще не створено', { tag: ['@smoke', '@critical'] }, async ({ app, newUser }) => {
    // Усі поля, зокрема необов'язкові: MOD-02 перевіряє, що вони дійшли до модератора
    const user = { ...newUser, middleName: 'Paul', hasUaResidencePermit: true };
    const applicationId = await registerForeignUser(app, user);
    runState.save(RUN_APPLICANTS.approved, { ...user, applicationId });
  });

  test('REG-13 Email заявки, що очікує модерації, не можна використати повторно', async ({ app }) => {
    await app.entry.open();
    await app.entry.goToRegistration();
    await app.registration.submitEmail(applicant().email);
    await expect(app.registration.emailError).toHaveText(EMAIL_BLOCKED);
    await expect(app.registration.form).toBeHidden();
  });

  test('REG-17 Той самий email у верхньому регістрі не обходить перевірку дубліката', { tag: '@critical' }, async ({ app }) => {
    await app.entry.open();
    await app.entry.goToRegistration();
    await app.registration.submitEmail(applicant().email.toUpperCase());
    await expect(app.registration.emailError).toHaveText(EMAIL_BLOCKED);
    await expect(app.registration.form).toBeHidden();
  });

  test.describe('Модерація і вхід', () => {
    // eslint-disable-next-line playwright/no-skipped-test -- етап 1 (реєстрація) працює без модератора
    test.skip(!env.hasAdmin, 'ADMIN_EMAIL не задано — кейси модерації пропущено');

    test('MOD-01 Нова заявка з\'являється в черзі модерації', { tag: '@critical' }, async ({ admin }) => {
      const user = applicant();
      await admin.moderation.open('pending');
      const row = admin.moderation.row(user.email);
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(`${user.lastName} ${user.firstName}`);
      await expect(row).toContainText('Очікує перевірки');
      expect(await findLmsAccount(admin, user.email), 'До схвалення акаунта в LMS немає').toBeNull();
    });

    test('MOD-02 У заявці видно дані користувача та документ', async ({ admin, request }) => {
      const user = applicant();
      const { moderation } = admin;
      await moderation.openApplication(user.email);

      await test.step('Дані заявника, зокрема ознака тимчасової посвідки', async () => {
        await expect(moderation.field("Ім'я")).toContainText(`${user.lastName} ${user.firstName}`);
        await expect(moderation.field("Ім'я")).toContainText(user.middleName!);
        await expect(moderation.field('Країна проживання')).toHaveText(user.country);
        await expect(moderation.field('Тимчасова посвідка на проживання в Україні')).toHaveText('Так');
        await moderation.expectStatus('Очікує перевірки');
      });

      const fileName = fileNameOf(user.document);

      const href = await test.step('Документ — один, очікує перевірки', async () => {
        await expect(moderation.documentRows()).toHaveCount(1);
        await expect(moderation.documentRows().first()).toContainText('Очікує перевірки');
        return (await moderation.documentLink(fileName).getAttribute('href'))!;
      });

      await test.step('Модератор завантажує той самий файл', async () => {
        const res = await admin.page.request.get(href);
        expect(res.status()).toBe(200);
        expect(res.headers()['content-type']).toBe('application/pdf');
        expect((await res.body()).equals(fs.readFileSync(user.document as string))).toBe(true);
      });

      await test.step('Без сесії модератора документ недоступний', async () => {
        const res = await request.get(new URL(href, env.adminBaseUrl).toString(), { maxRedirects: 0 });
        expect(res.status()).toBe(302);
        expect(res.headers().location).toMatch(/^\/login\?/);
      });
    });

    test('MOD-03 Погодження створює акаунт і надсилає лист з активацією', { tag: ['@smoke', '@critical'] }, async ({ app, admin, mail }) => {
      const user = applicant();
      await approveApplication(admin, user.email);

      await test.step('Заявка у вкладці «Схвалено», акаунт у LMS створено', async () => {
        await admin.moderation.open('approved');
        await expect(admin.moderation.row(user.email)).toContainText('Схвалено');
        expect(await findLmsAccount(admin, user.email)).toBeTruthy();
      });

      await test.step('Заявник бачить «Схвалено» на сторінці статусу', async () => {
        await app.registration.openStatus(user.applicationId);
        await expect(app.registration.statusApproved).toBeVisible();
      });

      const letter = await expectDecisionLetter(admin, mail, { email: user.email, tab: 'approved', type: 'Заявку схвалено', match: () => true });
      expect(findActivationLink(letter), 'У листі про схвалення немає посилання активації (вимоги, п. 3.1)').toBeTruthy();
    });

    test('REG-04 Email існуючого акаунта не пускає до повторної реєстрації', async ({ app }) => {
      await app.entry.open();
      await app.entry.goToRegistration();
      await app.registration.submitEmail(applicant().email);
      await expect(app.registration.emailError).toHaveText(EMAIL_BLOCKED);
      await expect(app.registration.form).toBeHidden();
    });

    test('AUTH-06 Неправильний код не дає доступу', { tag: '@critical' }, async ({ app }) => {
      // Лист не потрібен: будь-який код, крім надісланого, неправильний (шанс вгадати 6 цифр — 10⁻⁶)
      await app.otp.open();
      await app.otp.requestCode(applicant().email);
      await app.otp.submitCode('000000');
      await expect(app.otp.invalidError).toBeVisible();
      await app.otp.expectNotLoggedIn();
    });

    test('AUTH-01 Посилання активації активує акаунт', { tag: ['@smoke', '@critical'] }, async ({ app, mail }) => {
      await activateAccount(app, mail, applicant().email);
    });

    test('AUTH-02 Повторний перехід за використаним посиланням не активує вдруге', async ({ app, mail }) => {
      // Посилання вже використав AUTH-01
      await app.account.openActivationLink(await getActivationLink(mail, applicant().email));
      await expect(app.account.activationFailedNotice).toBeVisible();
    });

    test('AUTH-03 Для активного користувача на email надходить одноразовий код', { tag: '@critical' }, async ({ app, mail }) => {
      expect(await requestOtp(app, mail, applicant().email)).toMatch(/^\d{6}$/);
    });

    test('AUTH-04 Правильний код протягом 10 хв дає доступ до платформи', { tag: ['@smoke', '@blocker'] }, async ({ app, mail }) => {
      await app.otp.submitCode(await requestOtp(app, mail, applicant().email));
      await app.otp.expectLoggedIn();
    });

    test('AUTH-05 Код після спливання строку дії не приймається', { tag: '@slow' }, async ({ app, mail }) => {
      test.setTimeout((env.otpTtlSeconds + 180) * 1000);
      const code = await requestOtp(app, mail, applicant().email);

      await test.step(`Чекаємо ${env.otpTtlSeconds + 15} с, поки сплине строк дії коду`, async () => {
        // eslint-disable-next-line playwright/no-wait-for-timeout -- чекаємо саме серверний TTL коду
        await app.page.waitForTimeout((env.otpTtlSeconds + 15) * 1000);
      });

      await app.otp.submitCode(code);
      await expect(app.otp.expiredError).toBeVisible();
      await app.otp.expectNotLoggedIn();
    });
  });
});

test.describe('Вхід за кодом: без заявки', { tag: '@foreign' }, () => {
  test('AUTH-07 Для email без акаунта крок з кодом той самий — наявність акаунта не розкривається', async ({ app, newUser }) => {
    await app.otp.open();
    await app.otp.requestCode(newUser.email); // requestCode перевіряє перехід на крок з кодом для цього email
    await app.otp.submitCode('000000');
    await expect(app.otp.invalidError).toBeVisible();
    await app.otp.expectNotLoggedIn();
  });
});
