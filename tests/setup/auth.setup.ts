import { test as setup } from '@playwright/test';
import { env } from '../../src/config/env';
import { AUTH_FILES } from '../../src/fixtures/authFiles';
import { StaffLoginPage } from '../../src/pages/admin/StaffLoginPage';

// Skip на рівні describe — до створення фікстур, тож без облікових даних браузер навіть не запускається

setup.describe('Адміністратор', () => {
  // eslint-disable-next-line playwright/no-skipped-test -- етап 1 (реєстрація) працює без співробітників
  setup.skip(!env.hasAdmin, 'ADMIN_EMAIL не задано — кейси модерації/допуску будуть пропущені');

  setup('Логін адміністратора', async ({ page }) => {
    await new StaffLoginPage(page).login(env.adminEmail, env.adminPassword);
    await page.context().storageState({ path: AUTH_FILES.admin });
  });
});

setup.describe('Відповідальний за пункт тестування', () => {
  // eslint-disable-next-line playwright/no-skipped-test -- умовний skip: роль опційна
  setup.skip(!env.proctorEmail, 'PROCTOR_EMAIL не задано — допуск виконується під адміністратором');

  setup('Логін відповідального за пункт тестування', async ({ page }) => {
    await new StaffLoginPage(page).login(env.proctorEmail!, env.proctorPassword);
    await page.context().storageState({ path: AUTH_FILES.proctor });
  });
});
