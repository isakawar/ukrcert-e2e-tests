import fs from 'node:fs';
import path from 'node:path';
import type { ForeignUser } from '../data/users';

/** Заявник, створений у цьому прогоні: дані з форми + ідентифікатор заявки (uuid зі сторінки статусу). */
export type Applicant = ForeignUser & { applicationId: string };

/** Заявки прогону: A — схвалюється (tests/journey.spec.ts), B — відхиляється й подається повторно (tests/moderation.spec.ts). */
export const RUN_APPLICANTS = { approved: 'applicant-a', rejected: 'applicant-b' } as const;

/**
 * Стан ланцюга «одна заявка на кілька кейсів» (REG-05 → MOD → AUTH) між тестами одного прогону.
 * У файлі, а не в пам'яті: після падіння тесту Playwright перезапускає воркер, і змінні модуля зникають.
 * Лежить в outputDir (test-results) — Playwright очищує його на старті кожного прогону.
 */
const DIR = path.resolve('test-results', '.run-state');
const fileOf = (key: string) => path.join(DIR, `${key}.json`);

export const runState = {
  save(key: string, applicant: Applicant) {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(fileOf(key), JSON.stringify(applicant, null, 2));
  },

  /** `createdBy` — кейс, що мав створити заявку: так помилка одразу каже, звідки залежність. */
  get(key: string, createdBy: string): Applicant {
    if (!fs.existsSync(fileOf(key))) {
      throw new Error(`Заявку «${key}» не створено в цьому прогоні — кейс залежить від ${createdBy} (запускай увесь файл, а не окремий тест)`);
    }
    return JSON.parse(fs.readFileSync(fileOf(key), 'utf8')) as Applicant;
  },
};
