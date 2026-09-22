import { test } from '@playwright/test';
import type { UserApp } from '../pages';

export async function registerForExam(app: UserApp, { exam, center }: { exam: string; center: string }) {
  await test.step(`Реєстрація на іспит «${exam}» у пункті «${center}»`, async () => {
    await app.exams.open();
    await app.exams.selectExam(exam);
    await app.exams.selectTestCenter(center);
    await app.exams.selectFirstAvailableSlot();
    await app.exams.confirm();
  });
}
