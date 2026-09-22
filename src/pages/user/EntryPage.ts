import { expect, type Locator, type Page } from '@playwright/test';
import { routes } from '../../config/routes';

/** Головна сторінка: точки входу для іноземного користувача. ✅ звірено з dev. */
export class EntryPage {
  readonly registerLink: Locator;
  readonly loginLink: Locator;
  readonly diiaLogin: Locator;

  constructor(private readonly page: Page) {
    this.registerLink = page.getByRole('link', { name: 'Зареєструватися', exact: true });
    this.loginLink = page.getByRole('link', { name: 'Увійти', exact: true });
    this.diiaLogin = page.getByRole('link', { name: /Ді[яю]/ }).or(page.getByRole('button', { name: /Ді[яю]/ })); // TODO(dev): UA-флоу
  }

  async open() {
    await this.page.goto(routes.home);
  }

  /** Немає посилань → запит не виглядає закордонним. Префікс [geo] → окрема категорія в Allure. */
  async expectForeignEntryVisible() {
    await expect(this.registerLink, '[geo] Немає «Зареєструватися» для іноземця — перевір GEO_MODE / оточення').toBeVisible();
    await expect(this.loginLink).toBeVisible();
  }

  async goToRegistration() {
    await this.expectForeignEntryVisible();
    await this.registerLink.click();
  }

  async goToLogin() {
    await this.expectForeignEntryVisible();
    await this.loginLink.click();
  }
}
