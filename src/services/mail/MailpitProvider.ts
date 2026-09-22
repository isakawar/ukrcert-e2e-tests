import { randomUUID } from 'node:crypto';
import type { MailMessage, MailProvider } from './MailClient';

/** Mailpit HTTP API (https://mailpit.axllent.org/docs/api-v1/) — якщо на оточенні є власний mail-catcher. */
export class MailpitProvider implements MailProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly domain: string,
  ) {}

  newAddress(prefix: string): string {
    return `${prefix}-${randomUUID().slice(0, 12)}@${this.domain}`;
  }

  async listIds(to: string): Promise<string[]> {
    const data = await this.get<{ messages: { ID: string }[] }>(`/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    return data.messages.map((m) => m.ID);
  }

  async getMessage(_to: string, id: string): Promise<MailMessage> {
    const m = await this.get<{ ID: string; Subject: string; HTML: string; Text: string }>(`/api/v1/message/${id}`);
    return { id: m.ID, subject: m.Subject, html: m.HTML, text: m.Text };
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(new URL(path, this.baseUrl));
    if (!res.ok) throw new Error(`[mail] Mailpit ${path} → HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}
