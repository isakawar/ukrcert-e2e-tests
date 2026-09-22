import { env } from '../src/config/env';
import { test, expect } from '../src/fixtures';

test.describe('Допуск і проходження іспиту', { tag: '@foreign' }, () => {
  test('ADMIT-01 Відповідальний бачить реєстрацію «Очікує перевірки» і документ користувача', async ({ proctor, examRegisteredUser }) => {
    await proctor.admission.open();
    await proctor.admission.expectStatus(examRegisteredUser.email, 'Очікує перевірки');
    await proctor.admission.expectDocumentAvailable(examRegisteredUser.email);
  });

  test('ADMIT-02 «Допущено» → користувач може розпочати іспит', { tag: ['@smoke', '@critical'] }, async ({ app, proctor, examRegisteredUser }) => {
    await proctor.admission.open();
    await proctor.admission.admit(examRegisteredUser.email);

    await app.exam.openRegistration(env.examName);
    await expect(app.exam.startButton).toBeEnabled();
  });

  test('ADMIT-03 «Не допущено» → користувач не може розпочати іспит', { tag: '@critical' }, async ({ app, proctor, examRegisteredUser }) => {
    await proctor.admission.open();
    await proctor.admission.deny(examRegisteredUser.email);

    await app.exam.openRegistration(env.examName);
    await expect(app.exam.notAdmittedNotice).toBeVisible();
    await expect(app.exam.startButton.and(app.page.locator(':enabled'))).toHaveCount(0);
  });

  test('ADMIT-04 Допущений користувач проходить іспит, система формує результат', async ({ app, proctor, examRegisteredUser }) => {
    await proctor.admission.open();
    await proctor.admission.admit(examRegisteredUser.email);

    await app.exam.openRegistration(env.examName);
    await app.exam.start();
    await app.exam.finish();
    await expect(app.exam.result).toBeVisible();
  });

  const rdsBlocker = {
    type: 'blocked',
    description: 'Потрібна точка спостереження за передачею в РДС (статус в UI, лог в адмінці або API) і тестовий іспит з відомими правильними відповідями',
  };

  // eslint-disable-next-line playwright/expect-expect -- кейс заблокований, тіло з'явиться після розблокування
  test.fixme('ADMIT-05 Результат, що відповідає умовам, передається до РДС', { tag: '@blocked', annotation: rdsBlocker }, async () => {});

  // eslint-disable-next-line playwright/expect-expect -- див. ADMIT-05
  test.fixme('ADMIT-06 Результат нижче мінімального балу до РДС не передається', { tag: '@blocked', annotation: rdsBlocker }, async () => {});
});
