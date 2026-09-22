import { expect, type Locator, type Page } from '@playwright/test';
import { routes } from '../../config/routes';
import type { UploadFile } from '../../data/documents';

/** Профіль: актуальний документ і заміна документа (розділ 9 вимог). TODO(dev): звірити з UI. */
export class ProfilePage {
  readonly currentDocument: Locator;
  readonly pendingDocumentNotice: Locator;
  readonly uploadInput: Locator;
  readonly uploadSubmit: Locator;

  constructor(private readonly page: Page) {
    this.currentDocument = page.locator('section, div, li').filter({ hasText: /актуальний документ/i }).last();
    this.pendingDocumentNotice = page.getByText(/на модерац|очікує перевірки/i).first();
    this.uploadInput = page.locator('input[type="file"]');
    this.uploadSubmit = page.getByRole('button', { name: /надіслати|завантажити|зберегти/i });
  }

  async open() {
    await this.page.goto(routes.profile);
  }

  async uploadNewDocument(file: UploadFile) {
    await this.uploadInput.setInputFiles(file);
    await this.uploadSubmit.click();
    await expect(this.pendingDocumentNotice).toBeVisible();
  }

  async expectCurrentDocument(fileName: string) {
    await expect(this.currentDocument).toContainText(fileName);
  }
}
