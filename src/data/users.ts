import { documents, type UploadFile } from './documents';

/** Поля — як у реальній формі заявки на dev (пароля немає: вхід лише за одноразовим кодом). */
export interface ForeignUser {
  email: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  /** Підпис опції у списку «Країна проживання» (на dev: Канада, Польща). */
  country: string;
  consent: boolean;
  nameConfirmed: boolean;
  hasUaResidencePermit: boolean;
  document: UploadFile;
}

/** Латиниця, як у паспорті іноземця; унікальність дає email зі скриньки поштового сервісу. */
export function buildForeignUser(email: string, overrides: Partial<ForeignUser> = {}): ForeignUser {
  return {
    email,
    lastName: 'Smith',
    firstName: 'John',
    country: 'Канада',
    consent: true,
    nameConfirmed: true,
    hasUaResidencePermit: false,
    document: documents.pdf,
    ...overrides,
  };
}

/** Обов'язкові поля форми (HTML required на dev). */
export type RegistrationField = 'lastName' | 'firstName' | 'document' | 'consent' | 'nameConfirmed';
