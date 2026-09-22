import { expect, type Locator, type Page } from '@playwright/test';

/** Кнопка або посилання з таким підписом — UI часто змішує обидва варіанти. */
export const clickable = (scope: Page | Locator, name: string | RegExp) =>
  scope.getByRole('button', { name }).or(scope.getByRole('link', { name }));

/** Варіант вибору: радіокнопка, опція списку, кнопка чи посилання (пункти тестування, таймслоти). */
export const choice = (scope: Page | Locator, name: string | RegExp) =>
  scope.getByRole('radio', { name }).or(scope.getByRole('option', { name })).or(clickable(scope, name));

/** Вибір значення і в нативному <select>, і в кастомному combobox. */
export async function chooseOption(field: Locator, label: string) {
  const tag = await field.evaluate((el) => el.tagName);
  if (tag === 'SELECT') {
    await field.selectOption({ label });
    return;
  }
  if (tag === 'INPUT') await field.fill(label);
  else await field.click();
  await field.page().getByRole('option', { name: label }).first().click();
}

/**
 * Поле невалідне — незалежно від тексту помилки: aria-invalid або нативна HTML5-валідація.
 * Так перевірки не ламаються, якщо копірайтинг помилок зміниться.
 */
export async function expectFieldInvalid(field: Locator, fieldName: string) {
  await expect
    .poll(
      () =>
        field.evaluate((el) => {
          if (el.getAttribute('aria-invalid') === 'true') return true;
          const control = el as HTMLInputElement;
          return typeof control.checkValidity === 'function' && !control.checkValidity();
        }),
      { message: `Поле «${fieldName}» мало бути позначене як невалідне` },
    )
    .toBe(true);
}
