import { documents, fileNameOf } from '../src/data/documents';
import { test } from '../src/fixtures';
import { approveApplication, rejectApplication } from '../src/flows/moderation';
import { attachEmail } from '../src/reporting/allure';
import { mentions } from '../src/services/mail';

const initialDocument = fileNameOf(documents.pdf); // з ним реєструється кожен тестовий користувач
const newDocument = fileNameOf(documents.jpg);

test.describe('Профіль і заміна документа', { tag: '@foreign' }, () => {
  // Кейси беруть схваленого заявника A (approvedUser) — нових заявок не створюють
  test.fixme(true, 'Етап 4: профіль і вкладка модерації «Новий документ очікує перевірки» ще не звірені з dev');

  test('PROFILE-01 У профілі видно актуальний документ', async ({ app, loggedInUser }) => {
    await app.profile.open();
    await app.profile.expectCurrentDocument(fileNameOf(loggedInUser.document));
  });

  test('PROFILE-02 Новий документ іде на модерацію і не замінює актуальний одразу', async ({ app, loggedInUser }) => {
    await app.profile.open();
    await app.profile.uploadNewDocument(documents.jpg);
    await app.profile.expectCurrentDocument(initialDocument);
  });

  test('PROFILE-03 Після погодження новий документ стає актуальним', { tag: '@critical' }, async ({ app, admin, loggedInUser }) => {
    await app.profile.open();
    await app.profile.uploadNewDocument(documents.jpg);
    await approveApplication(admin, loggedInUser.email);

    await app.profile.open();
    await app.profile.expectCurrentDocument(newDocument);
  });

  test('PROFILE-04 Після відмови лишається старий документ, користувач отримує причину', { tag: '@critical' }, async ({ app, admin, mail, loggedInUser }) => {
    const reason = `Фото розмите (e2e ${Date.now()})`;
    await app.profile.open();
    await app.profile.uploadNewDocument(documents.jpg);
    await rejectApplication(admin, loggedInUser.email, reason);

    await attachEmail(await mail.waitForMessage({ to: loggedInUser.email, match: mentions(reason), description: 'Лист з причиною відмови' }));
    await app.profile.open();
    await app.profile.expectCurrentDocument(initialDocument);
  });
});
