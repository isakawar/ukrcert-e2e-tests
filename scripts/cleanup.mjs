#!/usr/bin/env node
/**
 * Прибирання тестових даних на dev: заявки іноземців і акаунти LMS з email тестових скриньок.
 *   npm run cleanup -- --dry-run   — лише показати знайдене
 *   npm run cleanup                — видалити (поки НЕ ПІДТРИМУЄТЬСЯ: на dev немає API видалення, див. PLAN.md, розділ 7)
 *
 * Пошук — під модератором (ADMIN_*): список «Заявки на реєстрацію іноземців» (усі вкладки) + /api/user/v1/accounts?email=.
 * Захист: беремо ЛИШЕ адреси, що точно відповідають TEST_EMAIL — інших користувачів скрипт не бачить узагалі.
 */
try {
  process.loadEnvFile('.env');
} catch {
  /* без .env — змінні з оточення */
}

/** Скриньки, які генерує MaildropProvider: ukrcert-<prefix>-<id>@maildrop.cc. Не послаблювати. */
const TEST_EMAIL = /^ukrcert-[a-z0-9-]+@maildrop\.cc$/;
const TABS = ['pending', 'approved', 'rejected', 'pending_document'];

const DRY_RUN = process.argv.includes('--dry-run');
const base = process.env.ADMIN_BASE_URL || process.env.BASE_URL;
const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
if (!base || !email || !password) fail('Потрібні ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD (див. .env.example)');

const session = await login();
const applications = await findTestApplications();

console.log(`Тестових заявок на ${new URL(base).host}: ${applications.length} (шаблон ${TEST_EMAIL})`);
for (const a of applications) {
  const account = await findAccount(a.email);
  a.account = account;
  console.log(`  #${a.reviewId}\t${a.status}\t${a.email}\t${account ? `акаунт ${account}` : 'без акаунта'}`);
}

if (DRY_RUN || !applications.length) process.exit(0);

// Endpoint-ів не вигадуємо: що потрібно від розробників — у PLAN.md, розділ 7 («Прибирання тестових даних»)
fail('Видалення ще не реалізоване: на dev немає API для видалення заявок і вилучення акаунтів — див. PLAN.md, розділ 7');

// ── HTTP під сесією модератора ──────────────────────────────

async function login() {
  const jar = new Map();
  const request = async (path, init = {}) => {
    const res = await fetch(new URL(path, base), {
      ...init,
      redirect: 'manual',
      headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), referer: new URL('/login', base).toString(), ...init.headers },
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  };

  await request('/login');
  const res = await request('/user_api/v1/account/login_session/', {
    method: 'POST',
    headers: { 'x-csrftoken': jar.get('csrftoken') ?? '', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, password }),
  });
  if (!res.ok) fail(`Логін модератора → HTTP ${res.status}`);
  return request;
}

async function findTestApplications() {
  const found = new Map();
  for (const tab of TABS) {
    const res = await session(`/foreign/registration/review/?status=${tab}`);
    if (!res.ok) fail(`Список заявок (${tab}) → HTTP ${res.status}`);
    const html = await res.text();
    // Рядок: <a class="foreign-identity-applicant-link" href="/foreign/registration/review/<id>/"> … <td>email</td>
    for (const [, id, row] of html.matchAll(/review\/(\d+)\/">([\s\S]*?)<\/tr>/g)) {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, c]) => c.replace(/<[^>]+>/g, '').trim());
      const address = cells.find((c) => c.includes('@'))?.toLowerCase();
      if (address && TEST_EMAIL.test(address)) found.set(id, { reviewId: Number(id), email: address, status: tab });
    }
  }
  return [...found.values()];
}

async function findAccount(address) {
  if (!TEST_EMAIL.test(address)) fail(`Відмова: ${address} не схожа на тестову адресу`);
  const res = await session(`/api/user/v1/accounts?email=${encodeURIComponent(address)}`);
  if (res.status === 404) return null;
  if (!res.ok) fail(`API акаунтів → HTTP ${res.status}`);
  const [account] = await res.json();
  return account.username;
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
