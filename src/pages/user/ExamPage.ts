import { expect, type Locator, type Page } from '@playwright/test';
import { routes } from '../../config/routes';
import { clickable } from '../helpers';

/**
 * Проходження іспиту в пункті тестування (розділ 8 вимог).
 * TODO(dev): вміст іспиту (питання) і таймінг слоту — уточнити на dev.
 */
export class ExamPage {
  readonly startButton: Locator;
  readonly notAdmittedNotice: Locator;
  readonly finishButton: Locator;
  readonly result: Locator;

  constructor(private readonly page: Page) {
    this.startButton = page.getByRole('button', { name: /(розпочати|почати) іспит/i });
    this.notAdmittedNotice = page.getByText(/не допущено/i).first();
    this.finishButton = page.getByRole('button', { name: /завершити/i });
    this.result = page.getByText(/ваш результат|результат іспиту/i).first();
  }

  async openRegistration(examName: string) {
    await this.page.goto(routes.myExams);
    await clickable(this.page, examName).first().click();
  }

  async start() {
    await this.startButton.click();
  }

  /** Завершує іспит без відповідей і підтверджує діалог, якщо він є. */
  async finish() {
    await this.finishButton.first().click();
    const dialog = this.page.getByRole('dialog');
    if (await dialog.isVisible()) await dialog.getByRole('button', { name: /так|підтвердити|завершити/i }).click();
    await expect(this.result).toBeVisible();
  }
}
