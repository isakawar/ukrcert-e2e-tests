import { env } from '../src/config/env';
import { documents, fileNameOf } from '../src/data/documents';
import { test, expect } from '../src/fixtures';
import { RUN_APPLICANTS, runState } from '../src/fixtures/runState';
import { expectDecisionLetter, findLmsAccount, rejectApplication } from '../src/flows/moderation';
import { registerForeignUser } from '../src/flows/registration';
import { mentions } from '../src/services/mail';

/** Прізвище з HTML: MOD-07 перевіряє, що модератор бачить його як текст, а не розмітку. */
const HTML_LAST_NAME = '<b>Smith</b><img src=x onerror="window.__xss=1">';

/**
 * Заявка B — друга з двох справжніх заявок за прогін (перша — tests/journey.spec.ts):
 * відмова (MOD-04) → екранування імені (MOD-07) → повторна подача того самого (MOD-05) та іншого (MOD-06) документа.
 * Порядок і відсутність повторів — як у journey.spec.ts.
 */
test.describe('Заявка B: відмова і повторна подача', { tag: '@foreign' }, () => {
  test.describe.configure({ mode: 'default', retries: 0 });
  // eslint-disable-next-line playwright/no-skipped-test -- етап 1 (реєстрація) працює без модератора
  test.skip(!env.hasAdmin, 'ADMIN_EMAIL не задано — кейси модерації пропущено');
  const applicant = () => runState.get(RUN_APPLICANTS.rejected, 'MOD-04');

  test('MOD-04 Відхилення: лист з причиною, акаунт не створено', { tag: '@critical' }, async ({ app, admin, mail, newUser }) => {
    const user = { ...newUser, lastName: HTML_LAST_NAME };
    const applicationId = await registerForeignUser(app, user);
    runState.save(RUN_APPLICANTS.rejected, { ...user, applicationId });

    const reason = `Документ нечитабельний (e2e ${Date.now()})`;
    await rejectApplication(admin, user.email, reason);

    await test.step('Заявка у вкладці «Відхилено», причина — біля документа, акаунта немає', async () => {
      await expect(admin.moderation.documentRows().first()).toContainText(reason);
      await admin.moderation.open('rejected');
      await expect(admin.moderation.row(user.email)).toContainText('Відхилено');
      expect(await findLmsAccount(admin, user.email)).toBeNull();
    });

    await test.step('Заявник бачить причину і може подати заявку повторно', async () => {
      await app.registration.openStatus(applicationId);
      await expect(app.registration.statusRejected).toBeVisible();
      await expect(app.registration.rejectionReason).toHaveText(`Причина: ${reason}`);
      await expect(app.registration.resubmitLink).toBeVisible();
    });

    await expectDecisionLetter(admin, mail, { email: user.email, tab: 'rejected', type: 'Відхилення заявки', match: mentions(reason) });
  });

  test('MOD-07 HTML в імені заявника показується модератору як текст', { tag: '@critical' }, async ({ admin }) => {
    const user = applicant();
    const { moderation, page } = admin;
    const shownName = `${HTML_LAST_NAME} ${user.firstName}`;

    await moderation.open('rejected');
    await expect(moderation.row(user.email)).toContainText(shownName);
    await moderation.openApplication(user.email, 'rejected');
    await expect(moderation.field("Ім'я")).toHaveText(shownName);

    // Розмітка не стала DOM-елементами і не виконалась
    await expect(page.locator('main b, main img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
  });

  test('MOD-05 Після відмови той самий документ повторно йде на модерацію', async ({ app, admin }) => {
    const user = applicant();
    await app.registration.resubmit(user.applicationId, user); // той самий файл

    await admin.moderation.openApplication(user.email, 'pending');
    await admin.moderation.expectStatus('Очікує перевірки');
    const [resubmitted, rejected] = [admin.moderation.documentRows().nth(0), admin.moderation.documentRows().nth(1)];
    await expect(admin.moderation.documentRows()).toHaveCount(2);
    await expect(resubmitted).toContainText(fileNameOf(user.document));
    await expect(resubmitted).toContainText('Очікує перевірки');
    await expect(rejected).toContainText('Відхилено');
  });

  test('MOD-06 Після відмови інший документ повторно йде на модерацію', async ({ app, admin }) => {
    const user = applicant();
    await rejectApplication(admin, user.email, 'Документ не відповідає вимогам');
    await app.registration.resubmit(user.applicationId, { ...user, document: documents.jpg });

    await admin.moderation.openApplication(user.email, 'pending');
    await expect(admin.moderation.documentRows()).toHaveCount(3);
    await expect(admin.moderation.documentRows().first()).toContainText(fileNameOf(documents.jpg));
    await expect(admin.moderation.documentRows().first()).toContainText('Очікує перевірки');
  });
});
