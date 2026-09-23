import { expect, type Locator, type Page } from '@playwright/test';
import type { ForeignUser, RegistrationField } from '../../data/users';
import { routes } from '../../config/routes';
import { expectFieldInvalid } from '../helpers';

/**
 * Реєстрація іноземного заявника: крок 1 (email) → крок 2 (заявка) → сторінка статусу.
 * ✅ Локатори звірено з dev (Django-форма `.foreign-identity-form`).
 */
export class RegistrationPage {
  // Крок 1
  readonly emailInput: Locator;
  readonly continueButton: Locator;
  readonly emailError: Locator;

  // Крок 2
  readonly form: Locator;
  readonly emailSummary: Locator;
  readonly lastName: Locator;
  readonly firstName: Locator;
  readonly middleName: Locator;
  readonly document: Locator;
  readonly country: Locator;
  readonly residencePermit: Locator;
  readonly consent: Locator;
  readonly nameConfirmed: Locator;
  readonly submitButton: Locator;
  /** Приховане поле email у формі заявки (для перевірки підміни) */
  readonly hiddenEmail: Locator;
  /** Помилки форми в цілому (не прив'язані до поля) */
  readonly formErrors: Locator;

  /** Сторінка «403 Forbidden» — dev відсікає частину запитів (ймовірно, обмеження частоти) */
  readonly forbidden: Locator;

  // Статус заявки
  readonly statusHeading: Locator;
  readonly statusPending: Locator;
  readonly statusNotice: Locator;
  readonly statusApproved: Locator;
  readonly statusRejected: Locator;
  /** «Причина: …» на сторінці статусу відхиленої заявки */
  readonly rejectionReason: Locator;
  readonly resubmitLink: Locator;
  readonly loginLink: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel('Електронна пошта');
    this.continueButton = page.getByRole('button', { name: 'Продовжити' });
    this.emailError = page.locator('.form-group', { has: this.emailInput }).locator('.errorlist');

    this.form = page.locator('form.foreign-identity-form').filter({ has: page.getByLabel('Прізвище') });
    this.emailSummary = this.form.getByText('Електронна пошта').locator('..');
    this.lastName = this.form.getByLabel('Прізвище');
    this.firstName = this.form.getByLabel(/^Ім['’ʼ]я$/); // на dev — типографський апостроф ’
    this.middleName = this.form.getByLabel('По батькові');
    this.document = this.form.getByLabel('Документ, що посвідчує особу');
    this.country = this.form.getByLabel('Країна проживання');
    this.residencePermit = this.form.getByLabel('Я маю тимчасову посвідку на проживання в Україні');
    this.consent = this.form.getByLabel('Я надаю згоду на обробку персональних даних');
    this.nameConfirmed = this.form.getByLabel(/написання мого імені є остаточним/);
    this.submitButton = this.form.getByRole('button', { name: 'Подати заявку' }); // і «Подати заявку повторно»
    this.hiddenEmail = this.form.locator('input[type="hidden"][name="email"]');
    this.formErrors = this.form.locator('.errorlist');

    this.forbidden = page.getByRole('heading', { name: /403 Forbidden/i });
    this.statusHeading = page.getByRole('heading', { name: 'Статус заявки на реєстрацію' });
    this.statusPending = page.getByText('Очікує перевірки', { exact: true });
    this.statusNotice = page.getByText('Ваша заявка очікує перевірки Модератором.');
    this.statusApproved = page.getByText('Вашу заявку схвалено. Тепер ви можете увійти за одноразовим кодом з електронної пошти.');
    this.statusRejected = page.getByText('Вашу заявку не схвалено.');
    this.rejectionReason = page.locator('main p').filter({ hasText: /^\s*Причина:/ }); // <p><strong>Причина:</strong> …</p>
    this.resubmitLink = page.getByRole('link', { name: 'Виправити та подати повторно' });
    this.loginLink = page.locator('main').getByRole('link', { name: 'Увійти', exact: true });
  }

  /** Крок 1: ввести email і перейти до форми заявки (або отримати помилку на тому ж кроці). */
  async submitEmail(email: string) {
    await this.emailInput.fill(email);
    await this.continueButton.click();
  }

  /**
   * Email на кроці 1 не прийнято: форма заявки не відкрилась, а поле email невалідне —
   * або браузерною валідацією (type=email/required), або серверною помилкою під полем.
   */
  async expectEmailRejected(serverMessage?: string | RegExp) {
    await expect(this.form).toBeHidden();
    const blockedByBrowser = await this.emailInput.evaluate((el) => !(el as HTMLInputElement).checkValidity());
    if (blockedByBrowser) return;
    if (serverMessage) await expect(this.emailError).toHaveText(serverMessage);
    else await expect(this.emailError).toBeVisible();
  }

  /**
   * Перевірка «сервер прийняв би» без створення заявки: заповнюємо форму, підміняємо країну на неіснуючу,
   * надсилаємо. Сервер валідує всі поля, повертає помилку лише під країною — заявка не створюється.
   */
  async expectAcceptedWithoutApplication(app: { page: Page }, user: ForeignUser) {
    await openRegistrationFormFor(app.page, this, user.email);
    await this.fill(user);
    await this.tamper(this.country, 'XX');
    await this.submit();
    await this.waitFor(this.countryError, 'Подати заявку (з невалідною країною)');
    await this.expectNotSubmitted();
  }

  get countryError(): Locator {
    return this.form.locator('.form-group', { hasText: 'Країна проживання' }).locator('.errorlist');
  }

  /** Підмінює значення поля в DOM (імітація зміни запиту поза UI). */
  async tamper(field: Locator, value: string) {
    await field.evaluate((el, v) => {
      if (el instanceof HTMLSelectElement && ![...el.options].some((o) => o.value === v)) el.add(new Option(v, v));
      (el as HTMLInputElement).value = v;
    }, value);
  }

  /** `skip` — поля, які навмисно лишаємо порожніми (негативні кейси). */
  async fill(user: ForeignUser, { skip = [] }: { skip?: RegistrationField[] } = {}) {
    const skipped = new Set(skip);
    if (!skipped.has('lastName')) await this.lastName.fill(user.lastName);
    if (!skipped.has('firstName')) await this.firstName.fill(user.firstName);
    if (user.middleName) await this.middleName.fill(user.middleName);
    if (!skipped.has('document')) await this.document.setInputFiles(user.document);
    await this.country.selectOption({ label: user.country });
    await this.residencePermit.setChecked(user.hasUaResidencePermit);
    if (!skipped.has('consent')) await this.consent.setChecked(user.consent);
    if (!skipped.has('nameConfirmed')) await this.nameConfirmed.setChecked(user.nameConfirmed);
  }

  async submit() {
    await this.submitButton.click();
  }

  /**
   * Чекає, доки з'явиться `expected`, або сторінка 403. 403 → помилка з префіксом [ratelimit]
   * (окрема категорія в Allure), щоб не плутати з дефектом форми.
   */
  async waitFor(expected: Locator, step: string) {
    await expect(expected.or(this.forbidden).first()).toBeVisible();
    if (await this.forbidden.isVisible()) {
      throw new Error(`[ratelimit] dev повернув «403 Forbidden» на кроці «${step}» — ймовірно, обмеження частоти запитів; зменш FOREIGN_WORKERS або попроси вимкнути ліміт на dev`);
    }
  }

  /** Після успішної подачі: сторінка статусу → повертає ідентифікатор заявки з URL. */
  async expectSubmittedForModeration(): Promise<string> {
    await this.waitFor(this.statusHeading, 'Подати заявку');
    await expect(this.statusPending).toBeVisible();
    await expect(this.statusNotice).toBeVisible();
    const id = this.page.url().match(/status\/([0-9a-f-]{36})/)?.[1];
    expect(id, 'Ідентифікатор заявки в URL сторінки статусу').toBeTruthy();
    return id!;
  }

  /** Сторінка статусу за ідентифікатором заявки (посилання, яке заявник отримує після подачі). */
  async openStatus(applicationId: string) {
    await this.page.goto(`${routes.registrationStatus}${applicationId}/`);
    await expect(this.statusHeading).toBeVisible();
  }

  /** Після відмови: «Виправити та подати повторно» → та сама форма з новим документом → знову «Очікує перевірки». */
  async resubmit(applicationId: string, user: ForeignUser) {
    await this.openStatus(applicationId);
    await this.resubmitLink.click();
    await expect(this.page).toHaveURL(new RegExp(`${routes.resubmit(applicationId)}$`));
    await this.fill(user);
    await this.submit(); // кнопка «Подати заявку повторно»
    expect(await this.expectSubmittedForModeration(), 'Повторна подача — та сама заявка').toBe(applicationId);
  }

  async expectNotSubmitted() {
    await expect(this.form).toBeVisible();
    await expect(this.statusHeading).toBeHidden();
  }

  field(name: RegistrationField): Locator {
    return { lastName: this.lastName, firstName: this.firstName, document: this.document, consent: this.consent, nameConfirmed: this.nameConfirmed }[name];
  }

  /** Серверна помилка Django під полем (`ul.errorlist` у `.form-group` з підписом поля). */
  fieldError(name: RegistrationField): Locator {
    const label = {
      lastName: 'Прізвище',
      firstName: /^Ім['’ʼ]я$/,
      document: 'Документ, що посвідчує особу',
      consent: 'Я надаю згоду на обробку персональних даних',
      nameConfirmed: /написання мого імені є остаточним/,
    }[name];
    return this.form.locator('.form-group').filter({ has: this.page.getByText(label, { exact: typeof label === 'string' }) }).locator('.errorlist');
  }

  /** Клієнтська (HTML5 required) валідація — форма навіть не відправляється. */
  async expectFieldInvalid(name: RegistrationField) {
    await expectFieldInvalid(this.field(name), name);
  }
}

/** Головна → «Зареєструватися» → email → форма заявки (без залежності від EntryPage, щоб уникнути циклу імпортів). */
async function openRegistrationFormFor(page: Page, registration: RegistrationPage, email: string) {
  await page.goto(routes.registration);
  await registration.submitEmail(email);
  await registration.waitFor(registration.form, 'Продовжити (email)');
}
