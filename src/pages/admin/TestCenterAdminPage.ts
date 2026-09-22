import { expect, type Page } from '@playwright/test';
import { routes } from '../../config/routes';

/** Існуюча адмін-панель пунктів тестування + нова ознака (розділ 6 вимог). TODO(dev): звірити з UI. */
export class TestCenterAdminPage {
  constructor(private readonly page: Page) {}

  async setForeignOnly(centerName: string, value: boolean) {
    await this.page.goto(routes.testCenters);
    await this.page.getByRole('link', { name: centerName, exact: true }).click();
    await this.page.getByLabel(/Тільки для іноземних користувачів/i).setChecked(value);
    await this.page.getByRole('button', { name: /зберегти|save/i }).first().click();
    await expect(this.page.getByText(/збережено|успішно|changed successfully/i).first()).toBeVisible();
  }
}
