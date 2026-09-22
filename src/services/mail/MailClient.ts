export interface MailMessage {
  id: string;
  subject: string;
  html: string;
  text: string;
}

export interface WaitForMessageOptions {
  to: string;
  /** Що саме чекаємо: лист з кодом, з посиланням активації, з причиною відмови… */
  match?: (message: MailMessage) => boolean;
  /** Листи, які вже були в скриньці до дії (див. `listIds`) — щоб не взяти старий код. */
  excludeIds?: string[];
  /** Для зрозумілого повідомлення про помилку та назви кроку у звіті. */
  description?: string;
  timeoutMs?: number;
}

/** Мінімальний контракт до поштового сервісу. */
export interface MailProvider {
  /** Нова унікальна адреса, листи на яку можна прочитати через цей же провайдер. */
  newAddress(prefix: string): string;
  /** Листи адресата (лише id), порядок не важливий. */
  listIds(to: string): Promise<string[]>;
  getMessage(to: string, id: string): Promise<MailMessage>;
}

export class MailClient {
  constructor(private readonly provider: MailProvider) {}

  newAddress(prefix = 'foreign'): string {
    return this.provider.newAddress(prefix);
  }

  listIds(to: string): Promise<string[]> {
    return this.provider.listIds(to);
  }

  /** Опитує скриньку, доки не з'явиться новий лист, що відповідає умові. */
  async waitForMessage({ to, match, excludeIds = [], description = 'лист', timeoutMs = 90_000 }: WaitForMessageOptions): Promise<MailMessage> {
    const deadline = Date.now() + timeoutMs;
    const checked = new Set(excludeIds);

    while (Date.now() < deadline) {
      for (const id of await this.provider.listIds(to)) {
        if (checked.has(id)) continue;
        checked.add(id);
        const message = await this.provider.getMessage(to, id);
        if (!match || match(message)) return message;
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    // Префікс [mail] → категорія «Інфраструктура: пошта» в Allure
    throw new Error(`[mail] ${description} для ${to} не надійшов за ${timeoutMs / 1000} с`);
  }
}
