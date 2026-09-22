import { expect, type Page } from '@playwright/test';
import { env } from '../../config/env';
import { routes } from '../../config/routes';

/** Вхід співробітника (адміністратор / відповідальний за пункт тестування). TODO(dev): звірити з UI. */
export class StaffLoginPage {
  constructor(private readonly page: Page) {}

  async login(email: string, password: string) {
    await this.page.goto(new URL(routes.staffLogin, env.adminBaseUrl).toString());
    await this.page.getByLabel(/e-?mail|ім['’ʼ]я користувача|username/i).fill(email);
    const passwordField = this.page.getByLabel(/пароль|password/i);
    await passwordField.fill(password);
    await this.page.getByRole('button', { name: /увійти|log in|sign in/i }).click();
    await expect(passwordField, 'Логін співробітника не вдався — перевір ADMIN_* / PROCTOR_* у .env').toBeHidden();
  }
}
