import { test } from '@playwright/test';
import type { AdminApp } from '../pages';

export async function approveApplication(admin: AdminApp, email: string) {
  await test.step(`Адміністратор погоджує документ ${email}`, () => admin.moderation.approve(email));
}

export async function rejectApplication(admin: AdminApp, email: string, reason: string) {
  await test.step(`Адміністратор відхиляє документ ${email}: «${reason}»`, () => admin.moderation.reject(email, reason));
}
