import { expect, type Locator, type Page } from '@playwright/test';
import { routes } from '../../config/routes';

/** Сторінка модерації заявок/документів іноземних користувачів (розділ 3 вимог). TODO(dev): звірити з UI. */
export class ModerationPage {
  readonly documentPreview: Locator;
  readonly residencePermitFlag: Locator;
  readonly approveButton: Locator;
  readonly rejectButton: Locator;

  constructor(private readonly page: Page) {
    this.documentPreview = page
      .locator('iframe, embed, object, img')
      .or(page.getByRole('link', { name: /документ|переглянути|завантажити/i }))
      .first();
    this.residencePermitFlag = page.getByText(/тимчасов\w* посвідк/i).first();
    this.approveButton = page.getByRole('button', { name: /погодити/i });
    this.rejectButton = page.getByRole('button', { name: /відхилити/i }).first();
  }

  row(email: string): Locator {
    return this.page.getByRole('row').filter({ hasText: email });
  }

  /** Рядок заявки, що ще очікує рішення (після відмови в списку може лишатися старий рядок). */
  pendingRow(email: string): Locator {
    return this.row(email).filter({ hasText: /очіку/i });
  }

  async open() {
    await this.page.goto(routes.moderation);
  }

  async openPendingApplication(email: string) {
    await this.open();
    const row = this.pendingRow(email);
    await expect(row, `Заявки ${email} немає в черзі модерації`).toBeVisible();
    const link = row.getByRole('link');
    await ((await link.count()) ? link.first() : row).click();
    await expect(this.page.getByText(email).first()).toBeVisible();
  }

  async approve(email: string) {
    await this.openPendingApplication(email);
    await this.approveButton.click();
    await expect(this.page.getByText(/погоджено/i).first()).toBeVisible();
  }

  async reject(email: string, reason: string) {
    await this.openPendingApplication(email);
    await this.rejectButton.click();
    // Причина — у діалозі або інлайн-формі під кнопкою
    const scope = (await this.page.getByRole('dialog').count()) ? this.page.getByRole('dialog') : this.page.locator('body');
    await scope.getByLabel(/причин/i).fill(reason);
    await scope.getByRole('button', { name: /відхилити|підтвердити/i }).last().click();
    await expect(this.page.getByText(/відхилено/i).first()).toBeVisible();
  }
}
