import { expect, type Locator, type Page } from '@playwright/test';
import { routes } from '../../config/routes';
import { choice, clickable } from '../helpers';

/** Реєстрація на іспит: іспит → пункт тестування → таймслот (розділ 5 вимог). TODO(dev): звірити з UI. */
export class ExamRegistrationPage {
  readonly availableSlot: Locator;
  readonly confirmButton: Locator;
  readonly confirmation: Locator;

  constructor(private readonly page: Page) {
    // Таймслот зазвичай підписаний часом, напр. «10:30»
    this.availableSlot = choice(page, /\b\d{1,2}:\d{2}\b/).and(page.locator(':not([disabled]):not([aria-disabled="true"])')).first();
    this.confirmButton = page.getByRole('button', { name: /зареєструватись|записатись|підтвердити/i });
    this.confirmation = page.getByText(/ви зареєстровані|реєстраці\w* (на іспит )?(створено|підтверджено)/i).first();
  }

  testCenter(name: string): Locator {
    return choice(this.page, name);
  }

  async open() {
    await this.page.goto(routes.exams);
  }

  async selectExam(name: string) {
    await clickable(this.page, name).first().click();
  }

  async expectTestCenterVisible(name: string) {
    await expect(this.testCenter(name).first()).toBeVisible();
  }

  async expectTestCenterHidden(name: string) {
    await expect(this.testCenter(name)).toHaveCount(0);
  }

  async selectTestCenter(name: string) {
    await this.testCenter(name).first().click();
  }

  async selectFirstAvailableSlot() {
    await this.availableSlot.click();
  }

  async confirm() {
    await this.confirmButton.click();
    await expect(this.confirmation).toBeVisible();
  }
}
