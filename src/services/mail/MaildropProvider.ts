import { randomUUID } from 'node:crypto';
import type { MailMessage, MailProvider } from './MailClient';

/**
 * Maildrop (https://maildrop.cc): публічні скриньки без реєстрації та ключів, GraphQL API.
 * Будь-яка адреса *@maildrop.cc існує одразу — тест просто генерує унікальне ім'я скриньки.
 * Обмеження: скриньки публічні (лише тестові дані!), листи живуть ~24 год.
 */
export class MaildropProvider implements MailProvider {
  private static readonly API = 'https://api.maildrop.cc/graphql';
  private static readonly DOMAIN = 'maildrop.cc';

  newAddress(prefix: string): string {
    return `ukrcert-${prefix}-${randomUUID().slice(0, 12)}@${MaildropProvider.DOMAIN}`;
  }

  async listIds(to: string): Promise<string[]> {
    const data = await this.query<{ inbox: { id: string }[] | null }>(
      'query ($mailbox: String!) { inbox(mailbox: $mailbox) { id } }',
      { mailbox: mailboxOf(to) },
    );
    return (data.inbox ?? []).map((m) => m.id);
  }

  async getMessage(to: string, id: string): Promise<MailMessage> {
    const { message } = await this.query<{ message: { id: string; subject: string; html: string | null; data: string | null } }>(
      'query ($mailbox: String!, $id: String!) { message(mailbox: $mailbox, id: $id) { id subject html data } }',
      { mailbox: mailboxOf(to), id },
    );
    const html = message.html ?? '';
    return { id: message.id, subject: message.subject, html, text: html ? htmlToText(html) : (message.data ?? '') };
  }

  private async query<T>(query: string, variables: Record<string, string>): Promise<T> {
    const res = await fetch(MaildropProvider.API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`[mail] Maildrop API → HTTP ${res.status}`);
    const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (body.errors?.length || !body.data) throw new Error(`[mail] Maildrop API: ${body.errors?.map((e) => e.message).join('; ') ?? 'порожня відповідь'}`);
    return body.data;
  }
}

const mailboxOf = (address: string) => address.split('@')[0];

const htmlToText = (html: string) =>
  html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
