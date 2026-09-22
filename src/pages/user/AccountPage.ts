import type { Locator, Page } from '@playwright/test';

/** Результат переходу за посиланням активації. TODO(dev): звірити тексти з UI. */
export class AccountPage {
  readonly activatedNotice: Locator;
  readonly activationFailedNotice: Locator;

  constructor(private readonly page: Page) {
    this.activatedNotice = page.getByText(/(обліковий запис|акаунт).*активовано|успішно активовано/i);
    this.activationFailedNotice = page.getByText(/посилання.*(недійсне|вже використано|застаріло)|вже активовано/i);
  }

  async openActivationLink(link: string) {
    await this.page.goto(link);
  }
}
