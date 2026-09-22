import { documents } from '../src/data/documents';
import { test, expect } from '../src/fixtures';
import { getActivationLink } from '../src/flows/account';
import { approveApplication, rejectApplication } from '../src/flows/moderation';
import { openRegistrationForm, registerForeignUser } from '../src/flows/registration';
import { attachEmail } from '../src/reporting/allure';
import { mentions } from '../src/services/mail';

test.describe('Модерація документа', { tag: '@foreign' }, () => {
  test('MOD-01 Нова заявка з\'являється в черзі модерації', async ({ admin, pendingUser }) => {
    await admin.moderation.open();
    await expect(admin.moderation.pendingRow(pendingUser.email)).toBeVisible();
  });

  test('MOD-02 У заявці видно дані користувача та документ', async ({ admin, pendingUser }) => {
    await admin.moderation.openPendingApplication(pendingUser.email);
    await expect(admin.page.getByText(pendingUser.lastName).first()).toBeVisible();
    await expect(admin.moderation.documentPreview).toBeVisible();
  });

  test('MOD-03 Погодження створює акаунт і надсилає лист з активацією', { tag: ['@smoke', '@critical'] }, async ({ admin, mail, pendingUser }) => {
    await approveApplication(admin, pendingUser.email);
    expect(await getActivationLink(mail, pendingUser.email)).toMatch(/^https?:\/\//);
  });

  test('MOD-04 Відхилення: лист з причиною, акаунт не створено', { tag: '@critical' }, async ({ app, admin, mail, pendingUser }) => {
    const reason = `Документ нечитабельний (e2e ${Date.now()})`;
    await rejectApplication(admin, pendingUser.email, reason);

    const letter = await mail.waitForMessage({ to: pendingUser.email, match: mentions(reason), description: 'Лист з причиною відмови' });
    await attachEmail(letter);

    await test.step('Після відмови з цим email знову можна подати заявку', async () => {
      await openRegistrationForm(app, pendingUser.email);
    });
  });

  test('MOD-05 Після відмови той самий документ повторно йде на модерацію', async ({ app, admin, pendingUser }) => {
    await rejectApplication(admin, pendingUser.email, 'Потрібне чіткіше фото');
    await registerForeignUser(app, pendingUser); // той самий email і той самий файл
    await admin.moderation.open();
    await expect(admin.moderation.pendingRow(pendingUser.email)).toBeVisible();
  });

  test('MOD-06 Після відмови інший документ іде на модерацію як нова заявка', async ({ app, admin, pendingUser }) => {
    await rejectApplication(admin, pendingUser.email, 'Документ не відповідає вимогам');
    await registerForeignUser(app, { ...pendingUser, document: documents.jpg });
    await admin.moderation.open();
    await expect(admin.moderation.pendingRow(pendingUser.email)).toBeVisible();
  });
});
