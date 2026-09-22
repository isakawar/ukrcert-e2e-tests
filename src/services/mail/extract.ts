import type { MailMessage } from './MailClient';

// TODO(dev): звірити з реальним шаблоном листа (довжина коду, вигляд посилання)
const OTP_RE = /\b(\d{6})\b/;
const ACTIVATION_URL_RE = /activat|confirm|verify/i;

const bodyOf = (m: MailMessage) => `${m.text}\n${m.html}`;

export const hasOtpCode = (m: MailMessage) => OTP_RE.test(m.text || m.html.replace(/<[^>]+>/g, ' '));

export function extractOtpCode(m: MailMessage): string {
  const code = (m.text || m.html.replace(/<[^>]+>/g, ' ')).match(OTP_RE)?.[1];
  if (!code) throw new Error(`[mail] У листі «${m.subject}» не знайдено одноразового коду`);
  return code;
}

export function findActivationLink(m: MailMessage): string | undefined {
  const urls = bodyOf(m).match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  return urls.map((u) => u.replace(/&amp;/g, '&')).find((u) => ACTIVATION_URL_RE.test(u));
}

export const hasActivationLink = (m: MailMessage) => findActivationLink(m) !== undefined;

export function extractActivationLink(m: MailMessage): string {
  const link = findActivationLink(m);
  if (!link) throw new Error(`[mail] У листі «${m.subject}» не знайдено посилання активації`);
  return link;
}

export const mentions = (text: string) => (m: MailMessage) => bodyOf(m).includes(text);
