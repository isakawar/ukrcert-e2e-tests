import { expect, type Locator, type Page } from '@playwright/test';
import { routes } from '../../config/routes';

/** Вкладки сторінки «Заявки на реєстрацію іноземців» (параметр ?status=). */
export type ModerationTab = 'pending' | 'approved' | 'rejected' | 'pending_document';

export type ApplicationStatus = 'Очікує перевірки' | 'Схвалено' | 'Відхилено';

/** Тип листа в таблиці «Повідомлення про рішення». */
export type DecisionNotification = 'Заявку схвалено' | 'Відхилення заявки';

/**
 * Модерація заявок іноземців (розділ 3 вимог), ADMIN_BASE_URL. ✅ звірено з dev.
 * Список: /foreign/registration/review/?status=… → заявка /review/<id>/ з даними, документами, рішенням і статусом листів.
 */
export class ModerationPage {
  readonly heading: Locator;
  readonly summary: Locator;
  readonly documents: Locator;
  readonly notifications: Locator;
  readonly approveButton: Locator;
  readonly rejectReason: Locator;
  readonly rejectButton: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Перевірка заявки на реєстрацію іноземця' });
    this.summary = page.locator('dl.foreign-identity-summary');
    this.documents = page.getByRole('table', { name: 'Документи, що посвідчують особу' });
    this.notifications = page.getByRole('table', { name: 'Повідомлення про рішення' });
    this.approveButton = page.getByRole('button', { name: 'Схвалити заявку' });
    this.rejectReason = page.getByLabel('Причина відхилення');
    this.rejectButton = page.getByRole('button', { name: 'Відхилити заявку' });
  }

  async open(tab: ModerationTab = 'pending') {
    await this.page.goto(`${routes.moderation}?status=${tab}`);
  }

  /** Рядок заявки у відкритій вкладці списку. */
  row(email: string): Locator {
    return this.page.getByRole('row').filter({ hasText: email });
  }

  /** Відкриває заявку зі списку вкладки `tab` → повертає її номер у модерації (/review/<id>/). */
  async openApplication(email: string, tab: ModerationTab = 'pending'): Promise<number> {
    await this.open(tab);
    await expect(this.row(email), `Заявки ${email} немає у вкладці «${tab}»`).toHaveCount(1);
    await this.row(email).getByRole('link').click();
    await expect(this.heading).toBeVisible();
    await expect(this.field('Електронна пошта')).toHaveText(email);
    return Number(this.page.url().match(/review\/(\d+)\//)?.[1]);
  }

  /** Значення з блоку даних заявки: «Ім'я», «Країна проживання», «Тимчасова посвідка…», «Статус»… */
  field(label: string | RegExp): Locator {
    return this.summary.locator('dt').filter({ hasText: label }).locator('xpath=following-sibling::dd[1]');
  }

  async expectStatus(status: ApplicationStatus) {
    await expect(this.field('Статус')).toHaveText(status);
  }

  /** Рядки таблиці документів — від найновішого до найстарішого. */
  documentRows(): Locator {
    return this.documents.locator('tbody tr');
  }

  documentLink(fileName: string): Locator {
    return this.documents.getByRole('link', { name: fileName, exact: true });
  }

  notification(type: DecisionNotification): Locator {
    return this.notifications.getByRole('row').filter({ hasText: type });
  }

  async approve(email: string) {
    await this.openApplication(email);
    await this.approveButton.click();
    await this.expectStatus('Схвалено');
  }

  async reject(email: string, reason: string) {
    await this.openApplication(email);
    await this.rejectReason.fill(reason);
    await this.rejectButton.click();
    await this.expectStatus('Відхилено');
  }
}
