import { test, expect } from '../src/fixtures';

test.describe('Інфраструктура тестів', { tag: ['@foreign', '@smoke'] }, () => {
  test('INFRA-01 Поштовий сервіс доступний і видає нові скриньки', async ({ mail }) => {
    const address = mail.newAddress('infra');
    // Нова скринька порожня; якщо API недоступне — впаде з [mail] ще до бізнес-кейсів
    expect(await mail.listIds(address)).toEqual([]);
  });
});
