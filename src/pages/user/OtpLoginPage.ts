import { expect, type Locator, type Page } from '@playwright/test';
import { routes } from '../../config/routes';

/**
 * Вхід за одноразовим кодом з email: /login/ (email) → /login/code/ (код, 6 цифр). ✅ звірено з dev.
 * Для будь-якого email (і невідомого теж) сервер відкриває крок з кодом — наявність акаунта не розкривається.
 */
export class OtpLoginPage {
  readonly emailInput: Locator;
  readonly sendCodeButton: Locator;
  readonly codeStepHint: Locator;
  readonly codeInput: Locator;
  readonly submitButton: Locator;
  readonly requestNewCodeLink: Locator;
  /** На dev один текст і для неправильного, і для простроченого коду. */
  readonly invalidError: Locator;
  readonly expiredError: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel('Електронна пошта');
    this.sendCodeButton = page.getByRole('button', { name: 'Надіслати одноразовий код' });
    this.codeStepHint = page.getByText(/Введіть код, надісланий на адресу/);
    this.codeInput = page.getByLabel('Одноразовий код з електронної пошти');
    this.submitButton = page.locator('main').getByRole('button', { name: 'Увійти', exact: true });
    this.requestNewCodeLink = page.getByRole('link', { name: 'Запросити новий код' });
    this.invalidError = page.getByText('Одноразовий код недійсний або строк його дії минув.');
    this.expiredError = this.invalidError;
  }

  async open() {
    await this.page.goto(routes.login);
  }

  /** Крок з email → відкрито крок з кодом для цієї адреси. */
  async requestCode(email: string) {
    await this.emailInput.fill(email);
    await this.sendCodeButton.click();
    await expect(this.page).toHaveURL(new RegExp(`${routes.loginCode}$`));
    await expect(this.codeStepHint).toContainText(email);
  }

  async submitCode(code: string) {
    await this.codeInput.fill(code);
    await this.submitButton.click();
  }

  /**
   * TODO(dev): звірити, куди веде успішний вхід, — на dev листи з кодом поки не доходять (див. PLAN.md, розділ 7).
   * Поки що: пішли з кроку коду, а в шапці немає гостьових «Увійти» / «Зареєструватися».
   */
  async expectLoggedIn() {
    await expect(this.page).not.toHaveURL(/\/login\//);
    await expect(this.page.getByRole('link', { name: 'Зареєструватися', exact: true })).toBeHidden();
  }

  async expectNotLoggedIn() {
    await expect(this.page).toHaveURL(new RegExp(`${routes.loginCode}$`));
    await expect(this.codeInput).toBeVisible();
  }
}
