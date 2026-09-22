import type { Locator, Page } from '@playwright/test';
import { clickable } from '../helpers';

/** Вхід за одноразовим кодом з email. Крок з email ✅ звірено з dev; крок з кодом — TODO(dev, етап 2). */
export class OtpLoginPage {
  readonly emailInput: Locator;
  readonly sendCodeButton: Locator;
  readonly codeInput: Locator;
  readonly submitButton: Locator;
  readonly expiredError: Locator;
  readonly invalidError: Locator;
  /** Ознака, що користувач увійшов. */
  readonly loggedInMarker: Locator;

  constructor(page: Page) {
    this.emailInput = page.getByLabel('Електронна пошта');
    this.sendCodeButton = page.getByRole('button', { name: 'Надіслати одноразовий код' });
    this.codeInput = page.getByLabel(/код/i);
    this.submitButton = page.getByRole('button', { name: /увійти|підтвердити/i });
    this.expiredError = page.getByText(/термін дії.*(минув|сплив|закінчився)|прострочен/i);
    this.invalidError = page.getByText(/невірний|неправильний|недійсний код/i);
    this.loggedInMarker = clickable(page, /вийти/i);
  }

  async requestCode(email: string) {
    await this.emailInput.fill(email);
    await this.sendCodeButton.click();
  }

  async submitCode(code: string) {
    await this.codeInput.fill(code);
    await this.submitButton.click();
  }
}
