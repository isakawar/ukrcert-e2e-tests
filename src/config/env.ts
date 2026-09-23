import path from 'node:path';

// .env не обов'язковий: у CI змінні приходять з оточення раннера
try {
  process.loadEnvFile(path.resolve(process.cwd(), '.env'));
} catch {
  /* файлу немає — працюємо зі змінними процесу */
}

/** Помилки конфігурації мають префікс [env] — так вони потрапляють в окрему категорію Allure. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[env] Не задано змінну оточення ${name} — див. .env.example`);
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

function number(name: string, fallback: number): number {
  const raw = optional(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (Number.isNaN(value)) throw new Error(`[env] ${name} має бути числом, отримано "${raw}"`);
  return value;
}

export type GeoMode = 'proxy' | 'header' | 'none';

/**
 * Змінні читаються ліниво (getter-и): `playwright test --list` і typecheck працюють без .env,
 * а відсутня змінна падає лише в тесті, якому вона реально потрібна.
 */
export const env = {
  get envName() { return optional('ENV_NAME') ?? 'dev'; },
  get baseUrl() { return optional('BASE_URL'); },
  get adminBaseUrl() { return optional('ADMIN_BASE_URL') ?? required('BASE_URL'); },
  get buildVersion() { return optional('BUILD_VERSION'); },

  /** Без обліковки адміністратора кейси модерації/допуску пропускаються (етап 1 — лише реєстрація). */
  get hasAdmin() { return !!optional('ADMIN_EMAIL'); },
  get adminEmail() { return required('ADMIN_EMAIL'); },
  get adminPassword() { return required('ADMIN_PASSWORD'); },
  get proctorEmail() { return optional('PROCTOR_EMAIL'); },
  get proctorPassword() { return required('PROCTOR_PASSWORD'); },
  get uaUserStorageState() { return optional('UA_USER_STORAGE_STATE'); },

  get geoMode(): GeoMode {
    const mode = optional('GEO_MODE') ?? 'none';
    if (mode !== 'proxy' && mode !== 'header' && mode !== 'none') {
      throw new Error(`[env] GEO_MODE має бути proxy | header | none, отримано "${mode}"`);
    }
    return mode;
  },
  get geoProxy() {
    return {
      server: required('GEO_PROXY_SERVER'),
      username: optional('GEO_PROXY_USERNAME'),
      password: optional('GEO_PROXY_PASSWORD'),
    };
  },
  get geoHeader() {
    return { name: optional('GEO_HEADER_NAME') ?? 'X-Test-Country', value: optional('GEO_HEADER_VALUE') ?? 'CA' };
  },

  get mailProvider() { return optional('MAIL_PROVIDER') ?? 'maildrop'; },
  get mailApiUrl() { return required('MAIL_API_URL'); },
  get testEmailDomain() { return optional('TEST_EMAIL_DOMAIN') ?? 'e2e.test'; },

  /** Без іспиту й пунктів тестування на dev кейси EXAM/ADMIT пропускаються (етап 3). */
  get hasExamData() { return !!optional('EXAM_NAME'); },
  get examName() { return required('EXAM_NAME'); },
  get foreignTestCenter() { return required('FOREIGN_TEST_CENTER_NAME'); },
  get regularTestCenter() { return required('REGULAR_TEST_CENTER_NAME'); },
  get toggleTestCenter() { return required('TOGGLE_TEST_CENTER_NAME'); },

  /** Паралельні воркери для foreign: dev віддає 403 на часті реєстрації з одного IP. */
  get foreignWorkers() { return number('FOREIGN_WORKERS', 2); },

  get otpTtlSeconds() { return number('OTP_TTL_SECONDS', 600); },
  get maxUploadMb() { return number('MAX_UPLOAD_MB', 10); },

  get testPlanUrl() { return optional('TEST_PLAN_URL'); },
  get reportOwner() { return optional('REPORT_OWNER'); },
  get includeSlow() { return optional('INCLUDE_SLOW') === '1'; },
};
