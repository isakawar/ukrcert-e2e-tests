import { env } from '../../config/env';
import { MailClient } from './MailClient';
import { MaildropProvider } from './MaildropProvider';
import { MailpitProvider } from './MailpitProvider';

export { MailClient } from './MailClient';
export type { MailMessage } from './MailClient';
export * from './extract';

/** Точка заміни поштового сервісу: MAIL_PROVIDER у .env. */
export function createMailClient(): MailClient {
  switch (env.mailProvider) {
    case 'maildrop':
      return new MailClient(new MaildropProvider());
    case 'mailpit':
      return new MailClient(new MailpitProvider(env.mailApiUrl, env.testEmailDomain));
    default:
      throw new Error(`[env] Невідомий MAIL_PROVIDER="${env.mailProvider}" — підтримуються: maildrop, mailpit`);
  }
}
