import { documents } from '../src/data/documents';
import type { ForeignUser, RegistrationField } from '../src/data/users';
import { test, expect } from '../src/fixtures';
import { routes } from '../src/config/routes';
import { openRegistrationForm, registerForeignUser } from '../src/flows/registration';

const EMAIL_BLOCKED = 'Не можна продовжити реєстрацію з цією адресою електронної пошти.';
const DOCUMENT_FORMAT_ERROR = /у форматі PDF, JPEG або PNG/;
const DOCUMENT_SIZE_ERROR = 'Розмір документа, що посвідчує особу, перевищує дозволений.';
const DOCUMENT_CONTENT_ERROR = 'Вміст документа, що посвідчує особу, не відповідає розширенню файлу.';
const EMAIL_INVALID = 'Введіть коректну адресу електронної пошти.';
const REQUIRED = "Це поле обов'язкове.";

test.describe('Реєстрація іноземного користувача', { tag: '@foreign' }, () => {
  test('REG-01 Іноземцю на головній доступні «Зареєструватися» та «Увійти»', { tag: ['@smoke', '@critical'] }, async ({ app }) => {
    await app.entry.open();
    await app.entry.expectForeignEntryVisible();
  });

  test('REG-03 Новий email відкриває форму заявки з цим email', async ({ app, newUser }) => {
    await openRegistrationForm(app, newUser.email);
    await expect(app.page.getByText(newUser.email)).toBeVisible();
  });

  test('REG-04 Email існуючого акаунта не пускає до повторної реєстрації', async ({ app, activeUser }) => {
    await app.entry.open();
    await app.entry.goToRegistration();
    await app.registration.submitEmail(activeUser.email);
    await expect(app.registration.emailError).toBeVisible();
    await expect(app.registration.form).toBeHidden();
  });

  // Формат і ознаку перевіряємо БЕЗ створення заявки: разом з ними надсилаємо заздалегідь невалідну країну.
  // Сервер валідує всі поля одразу, тож відсутність помилки під полем = значення прийнято (перевірено на dev).
  for (const [format, document] of [
    ['JPG', documents.jpg],
    ['PNG', documents.png],
  ] as const) {
    test(`REG-06 Документ у форматі ${format} приймається`, async ({ app, newUser }) => {
      await app.registration.expectAcceptedWithoutApplication(app, { ...newUser, document });
      await expect(app.registration.fieldError('document')).toHaveCount(0);
    });
  }

  test('REG-12 Ознака «тимчасова посвідка в Україні» приймається формою', async ({ app, newUser }) => {
    // Що ознака збереглась у заявці, перевіряє MOD-02 (етап модерації)
    await app.registration.expectAcceptedWithoutApplication(app, { ...newUser, hasUaResidencePermit: true });
    await expect(app.registration.fieldError('document')).toHaveCount(0);
    await expect(app.registration.residencePermit).toBeChecked();
  });

  for (const [format, document] of [
    ['.exe', documents.exe],
    ['DOCX', documents.docx],
  ] as const) {
    test(`REG-07 Файл недопустимого формату (${format}) відхиляється з поясненням`, async ({ app, newUser }) => {
      await openRegistrationForm(app, newUser.email);
      await app.registration.fill({ ...newUser, document });
      await app.registration.submit();
      await app.registration.expectNotSubmitted();
      await expect(app.registration.fieldError('document')).toHaveText(DOCUMENT_FORMAT_ERROR);
    });
  }

  test('REG-08 Файл, більший за допустимий розмір, відхиляється', async ({ app, newUser }) => {
    await openRegistrationForm(app, newUser.email);
    await app.registration.fill({ ...newUser, document: documents.oversizedPdf() });
    await app.registration.submit();
    await app.registration.expectNotSubmitted();
    await expect(app.registration.fieldError('document')).toHaveText(DOCUMENT_SIZE_ERROR);
  });

  const requiredFields: [RegistrationField, string][] = [
    ['lastName', 'Прізвище'],
    ['firstName', "Ім'я"],
    ['document', 'Документ, що посвідчує особу'],
  ];
  for (const [field, label] of requiredFields) {
    test(`REG-09 Без обов'язкового поля «${label}» заявка не надсилається`, async ({ app, newUser }) => {
      await openRegistrationForm(app, newUser.email);
      await app.registration.fill(newUser, { skip: [field] });
      await app.registration.submit();
      await app.registration.expectFieldInvalid(field);
      await app.registration.expectNotSubmitted();
    });
  }

  test('REG-10 Без підтвердження остаточності написання імені заявка не надсилається', async ({ app, newUser }) => {
    await openRegistrationForm(app, newUser.email);
    await app.registration.fill({ ...newUser, nameConfirmed: false });
    await app.registration.submit();
    await app.registration.expectFieldInvalid('nameConfirmed');
    await app.registration.expectNotSubmitted();
  });

  test('REG-11 Без згоди на обробку персональних даних заявка не надсилається', async ({ app, newUser }) => {
    await openRegistrationForm(app, newUser.email);
    await app.registration.fill({ ...newUser, consent: false });
    await app.registration.submit();
    await app.registration.expectFieldInvalid('consent');
    await app.registration.expectNotSubmitted();
  });

});

test.describe('Реєстрація: валідація і негативні сценарії', { tag: '@foreign' }, () => {
  // ── Крок 1: email ─────────────────────────────────────────
  for (const [label, email] of [
    ['без домену', 'abc'],
    ['без зони домену', 'a@b'],
    ['кирилиця в імені скриньки', 'кирилиця@maildrop.cc'],
  ] as const) {
    test(`REG-14 Некоректний email (${label}) не приймається`, async ({ app }) => {
      await app.entry.open();
      await app.entry.goToRegistration();
      await app.registration.submitEmail(email);
      await app.registration.expectEmailRejected(EMAIL_INVALID);
    });
  }

  test('REG-15 Порожній email не приймається', async ({ app }) => {
    await app.entry.open();
    await app.entry.goToRegistration();
    await app.registration.submitEmail('');
    await app.registration.expectEmailRejected();
  });

  test('REG-16 Поле email обмежене 254 символами', async ({ app }) => {
    await app.entry.open();
    await app.entry.goToRegistration();
    await app.registration.emailInput.fill(`${'x'.repeat(250)}@maildrop.cc`);
    // maxlength=254: довше значення в поле не потрапляє (сервер теж відхиляє >254 — перевірено вручну)
    await expect(app.registration.emailInput).toHaveValue(/^.{254}$/);
  });

  test('REG-18 Пробіли довкола email обрізаються', async ({ app, newUser }) => {
    await app.entry.open();
    await app.entry.goToRegistration();
    await app.registration.submitEmail(`  ${newUser.email}  `);
    await app.registration.waitFor(app.registration.form, 'Продовжити (email)');
    await expect(app.registration.hiddenEmail).toHaveValue(newUser.email);
  });

  // ── Крок 2: поля заявки ───────────────────────────────────
  test('REG-19 Прізвище з одних пробілів не приймається', async ({ app, newUser }) => {
    await openRegistrationForm(app, newUser.email);
    await app.registration.fill({ ...newUser, lastName: '   ' });
    await app.registration.submit();
    await app.registration.expectNotSubmitted();
    await expect(app.registration.fieldError('lastName')).toHaveText(REQUIRED);
  });

  test('REG-20 Поле «Прізвище» обмежене 255 символами', async ({ app, newUser }) => {
    await openRegistrationForm(app, newUser.email);
    await app.registration.lastName.fill('A'.repeat(256));
    // maxlength=255: довше значення в поле не потрапляє (сервер теж відхиляє 256 — перевірено вручну)
    await expect(app.registration.lastName).toHaveValue('A'.repeat(255));
  });

  // ── Крок 2: документ ──────────────────────────────────────
  for (const [label, document] of [
    ['EXE з розширенням .pdf', documents.exeAsPdf()],
    ['PDF з розширенням .png', documents.pdfAsPng()],
  ] as const) {
    test(`REG-21 Вміст файлу не відповідає розширенню (${label})`, { tag: '@critical' }, async ({ app, newUser }) => {
      await openRegistrationForm(app, newUser.email);
      await app.registration.fill({ ...newUser, document });
      await app.registration.submit();
      await app.registration.expectNotSubmitted();
      await expect(app.registration.fieldError('document')).toHaveText(DOCUMENT_CONTENT_ERROR);
    });
  }

  test('REG-22 Порожній файл (0 байт) не приймається', async ({ app, newUser }) => {
    await openRegistrationForm(app, newUser.email);
    await app.registration.fill({ ...newUser, document: documents.emptyPdf() });
    await app.registration.submit();
    await app.registration.expectNotSubmitted();
    // На dev текст з помилкою: «Відправленний файл порожній.» — перевіряємо суть, не орфографію
    await expect(app.registration.fieldError('document')).toHaveText(/файл порожній/);
  });

  // ── Обхід UI ──────────────────────────────────────────────
  test('REG-23 Форму заявки не відкрити напряму без кроку з email', async ({ app }) => {
    await app.page.goto(routes.registrationApply);
    await expect(app.page).toHaveURL(new RegExp(`${routes.registration}$`));
    await expect(app.registration.form).toBeHidden();
    await expect(app.registration.emailInput).toBeVisible();
  });

  test('REG-24 Підміна email у формі заявки блокується', { tag: '@critical' }, async ({ app, newUser }) => {
    await openRegistrationForm(app, newUser.email);
    await app.registration.fill(newUser);
    await app.registration.tamper(app.registration.hiddenEmail, `tampered-${newUser.email}`);
    await app.registration.submit();
    await app.registration.expectNotSubmitted();
    await expect(app.registration.formErrors.first()).toHaveText(/Почніть реєстрацію знову/);
  });

  test('REG-25 Країна поза списком не приймається', async ({ app, newUser }) => {
    await openRegistrationForm(app, newUser.email);
    await app.registration.fill(newUser);
    await app.registration.tamper(app.registration.country, 'US');
    await app.registration.submit();
    await app.registration.expectNotSubmitted();
    await expect(app.registration.form.locator('.form-group', { hasText: 'Країна проживання' }).locator('.errorlist')).toHaveText(/US немає серед варіантів/);
  });
});

/**
 * Єдина справжня заявка за прогін: REG-05 її створює, REG-13 і REG-17 перевіряють на її email блокування дубліката.
 * Serial — щоб тести йшли по черзі в одному воркері; без повторів — щоб retry не створив другу заявку.
 */
test.describe('Реєстрація: одна справжня заявка на прогін', { tag: '@foreign' }, () => {
  test.describe.configure({ mode: 'serial', retries: 0 });
  let applied: ForeignUser | undefined;
  const appliedEmail = () => {
    if (!applied) throw new Error('Заявку з REG-05 не створено — REG-13/REG-17 залежать від неї');
    return applied.email;
  };

  test('REG-05 Повна заявка з PDF → статус «Очікує перевірки», акаунт ще не створено', { tag: ['@smoke', '@critical'] }, async ({ app, newUser }) => {
    await registerForeignUser(app, newUser);
    applied = newUser;
  });

  test('REG-13 Email заявки, що очікує модерації, не можна використати повторно', async ({ app }) => {
    await app.entry.open();
    await app.entry.goToRegistration();
    await app.registration.submitEmail(appliedEmail());
    await expect(app.registration.emailError).toHaveText(EMAIL_BLOCKED);
    await expect(app.registration.form).toBeHidden();
  });

  test('REG-17 Той самий email у верхньому регістрі не обходить перевірку дубліката', { tag: '@critical' }, async ({ app }) => {
    await app.entry.open();
    await app.entry.goToRegistration();
    await app.registration.submitEmail(appliedEmail().toUpperCase());
    await expect(app.registration.emailError).toHaveText(EMAIL_BLOCKED);
    await expect(app.registration.form).toBeHidden();
  });
});

test.describe('Реєстрація: український IP', { tag: '@ua' }, () => {
  test('REG-02 Для українського IP точок входу для іноземців немає', async ({ app }) => {
    await app.entry.open();
    await expect(app.entry.registerLink).toBeHidden();
  });
});
