import type { Page } from '@playwright/test';
import { AccountPage } from './user/AccountPage';
import { EntryPage } from './user/EntryPage';
import { ExamPage } from './user/ExamPage';
import { ExamRegistrationPage } from './user/ExamRegistrationPage';
import { OtpLoginPage } from './user/OtpLoginPage';
import { ProfilePage } from './user/ProfilePage';
import { RegistrationPage } from './user/RegistrationPage';
import { AdmissionPage } from './admin/AdmissionPage';
import { ModerationPage } from './admin/ModerationPage';
import { TestCenterAdminPage } from './admin/TestCenterAdminPage';

/** Усі сторінки кінцевого користувача, прив'язані до однієї вкладки. */
export const userApp = (page: Page) => ({
  page,
  entry: new EntryPage(page),
  registration: new RegistrationPage(page),
  otp: new OtpLoginPage(page),
  account: new AccountPage(page),
  exams: new ExamRegistrationPage(page),
  exam: new ExamPage(page),
  profile: new ProfilePage(page),
});

export const adminApp = (page: Page) => ({
  page,
  moderation: new ModerationPage(page),
  testCenters: new TestCenterAdminPage(page),
});

export const proctorApp = (page: Page) => ({
  page,
  admission: new AdmissionPage(page),
});

export type UserApp = ReturnType<typeof userApp>;
export type AdminApp = ReturnType<typeof adminApp>;
export type ProctorApp = ReturnType<typeof proctorApp>;
