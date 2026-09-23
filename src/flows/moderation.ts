import { expect, test } from '@playwright/test';
import { routes } from '../config/routes';
import type { AdminApp } from '../pages';
import type { DecisionNotification, ModerationTab } from '../pages/admin/ModerationPage';
import { attachEmail } from '../reporting/allure';
import type { MailClient, MailMessage } from '../services/mail';

export async function approveApplication(admin: AdminApp, email: string) {
  await test.step(`Модератор схвалює заявку ${email}`, () => admin.moderation.approve(email));
}

export async function rejectApplication(admin: AdminApp, email: string, reason: string) {
  await test.step(`Модератор відхиляє заявку ${email}: «${reason}»`, () => admin.moderation.reject(email, reason));
}

/** Акаунт Open edX з цим email (username) або null — через API акаунтів під сесією модератора. */
export async function findLmsAccount(admin: AdminApp, email: string): Promise<string | null> {
  const res = await admin.page.request.get(`${routes.accountsApi}?email=${encodeURIComponent(email)}`);
  if (res.status() === 404) return null;
  expect(res.status(), `GET ${routes.accountsApi}?email=… під сесією модератора`).toBe(200);
  const [account] = (await res.json()) as { username: string }[];
  return account.username;
}

/**
 * Лист з рішенням модератора. Спершу чекаємо фінальний статус у таблиці «Повідомлення про рішення»:
 * якщо dev сам пише «Не вдалося надіслати» — падаємо одразу з [mail], не чекаючи скриньку даремно.
 */
export async function expectDecisionLetter(
  admin: AdminApp,
  mail: MailClient,
  { email, tab, type, match }: { email: string; tab: ModerationTab; type: DecisionNotification; match: (m: MailMessage) => boolean },
): Promise<MailMessage> {
  return test.step(`Лист «${type}» надіслано на ${email}`, async () => {
    const { moderation } = admin;
    await moderation.openApplication(email, tab);
    const row = moderation.notification(type).first();
    await expect(row, `У «Повідомлення про рішення» немає листа «${type}»`).toBeVisible();

    let status = '';
    await expect
      .poll(
        async () => {
          await moderation.page.reload();
          status = await row.innerText();
          return /Триває надсилання/.test(status);
        },
        { timeout: 90_000, intervals: [5_000] },
      )
      .toBe(false);
    if (/Не вдалося надіслати/.test(status)) {
      throw new Error(`[mail] Dev не надіслав лист «${type}» на ${email}: у модерації «${status.replace(/\s+/g, ' ').trim()}»`);
    }

    const message = await mail.waitForMessage({ to: email, match, description: `Лист «${type}»` });
    await attachEmail(message);
    return message;
  });
}
