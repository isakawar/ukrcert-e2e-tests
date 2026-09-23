import { expect, type Page } from '@playwright/test';
import { env } from '../../config/env';
import { routes } from '../../config/routes';

/** Вхід співробітника (модератор / відповідальний за пункт тестування) у LMS за паролем. ✅ звірено з dev. */
export class StaffLoginPage {
  constructor(private readonly page: Page) {}

  async login(email: string, password: string) {
    await this.page.goto(new URL(routes.staffLogin, env.adminBaseUrl).toString());
    await this.page.getByLabel('Електронна пошта').fill(email);
    await this.page.getByLabel('Пароль').fill(password);
    // exact: у шапці є ще посилання «Увійти»
    await this.page.getByRole('button', { name: 'Увійти', exact: true }).click();
    await expect(this.page, 'Логін співробітника не вдався — перевір ADMIN_* / PROCTOR_* у .env').toHaveURL(/\/dashboard/);
  }
}
