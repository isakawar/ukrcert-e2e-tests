import { expect, type Locator, type Page } from '@playwright/test';
import { routes } from '../../config/routes';
import { clickable } from '../helpers';

export type AdmissionStatus = 'Очікує перевірки' | 'Допущено' | 'Не допущено';

/** Допуск до іспиту відповідальним за пункт тестування (розділ 7 вимог). TODO(dev): звірити з UI. */
export class AdmissionPage {
  constructor(private readonly page: Page) {}

  row(email: string): Locator {
    return this.page.getByRole('row').filter({ hasText: email });
  }

  async open() {
    await this.page.goto(routes.admission);
  }

  async expectStatus(email: string, status: AdmissionStatus) {
    await expect(this.row(email)).toContainText(status);
  }

  /** Документ відкривається або превʼю на сторінці, або в новій вкладці — перевіряємо обидва варіанти. */
  async expectDocumentAvailable(email: string) {
    const popup = this.page.context().waitForEvent('page', { timeout: 5_000 }).catch(() => undefined);
    await clickable(this.row(email), /документ|переглянути/i).first().click();
    const opened = await popup;
    if (opened) {
      await expect(opened).not.toHaveURL('about:blank');
      await opened.close();
    } else {
      await expect(this.page.locator('iframe, embed, object, img').first()).toBeVisible();
    }
  }

  async admit(email: string) {
    await this.row(email).getByRole('button', { name: /^допустити$/i }).click();
    await this.expectStatus(email, 'Допущено');
  }

  async deny(email: string) {
    await this.row(email).getByRole('button', { name: /не допустити/i }).click();
    await this.expectStatus(email, 'Не допущено');
  }
}
