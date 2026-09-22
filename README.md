# e2e-ukr-cert

E2E-тести УкрСертифікації для іноземних користувачів (перший запуск — Канада): реєстрація без Дії,
модерація документа, вхід за одноразовим кодом, реєстрація на іспит, допуск, заміна документа.
Архітектура і рішення — у [PLAN.md](PLAN.md). Тест-кейси — у тест-плані (вкладка «Тест-кейси»), ID кейсу = початок назви тесту.

## Швидкий старт

```bash
npm install
npx playwright install chromium
cp .env.example .env   # вже налаштовано на dev; ADMIN_* — на етапі модерації
npm run test:list      # перевірити, що тести підхопились (без .env теж працює)
npm run test:reg       # етап 1: реєстрація + перевірка поштового сервісу
npm run test:smoke     # наскрізний happy path
npm test               # усе, крім @slow
```

| Команда | Що робить |
| --- | --- |
| `npm run test:foreign` / `test:ua` | лише один гео-проєкт |
| `npm run test:slow` | кейси з реальним очікуванням (AUTH-05, ~11 хв) |
| `npm run report` | згенерувати й відкрити Allure-звіт |
| `npm run report:gate` | quality gate: exit 1, якщо впав хоч один `@smoke` (для CI) |
| `npm run test:qas` | прогін + автоматичний тест-ран з результатами в QA Sphere |
| `npm run report:qasphere` | залити результати останнього прогону в QA Sphere вручну |
| `npm run report:clean` | прибрати результати попередніх прогонів |
| `npm run typecheck` / `lint` | TypeScript і ESLint (ловить забуті `await`) |

Швидко прогнати анонімні кейси без логіну співробітників: `npx playwright test --project=ua --no-deps`.

## Перегляд тестів наживо

| Як | Команда | Що бачиш |
| --- | --- | --- |
| UI Mode (рекомендовано) | `npm run test:ui` | вікно Playwright: список тестів, запуск по одному, кожен крок зі знімком сторінки, «машина часу» по діях |
| Видимий браузер | `npm run test:reg:headed` / `npm run test:headed` | справжнє вікно Chromium, 1 потік, пауза 400 мс між діями (`SLOW_MO`) |
| UI Mode у Docker | `npm run docker:ui` → http://localhost:8080 | той самий UI Mode, але тести крутяться в контейнері |
| Відео кожного тесту | `npm run docker:reg:video` | відео в Allure / `reports/playwright-report` після прогону |

Для перших двох потрібні локальні залежності й браузер: `npm install && npx playwright install chromium`. Будь-який падіння в Docker/CI можна «переглянути» потім: `npx playwright show-trace reports/test-results/<тест>/trace.zip`.

## Docker

Той самий образ, що й у CI (`mcr.microsoft.com/playwright:v1.63.0-noble` — браузери вже всередині). Налаштування — з `.env`, ключ QA Sphere — з `$QASPHERE_API_KEY` хоста.

```bash
npm run docker:build                 # один раз / після зміни залежностей
npm run docker:reg                   # реєстрація
npm run docker:smoke                 # @smoke
npm run docker:test                  # усе, крім @slow
docker compose run --rm e2e --grep "REG-05"   # будь-які аргументи playwright test
QAS_REPORT=1 npm run docker:reg      # + тест-ран у QA Sphere
```

Результати — у `reports/` (Allure: `reports/allure-report/awesome/index.html`, відкривається подвійним кліком).

## GitHub Actions: запуск кнопкою

**Actions → E2E → Run workflow**, далі обрати:

| Поле | Значення |
| --- | --- |
| suite | `registration` (REG + INFRA), `smoke`, `full` (усе, крім @slow), `custom` |
| grep | для `custom`: регулярка по назві/тегу, напр. `REG-05\|AUTH-` або `@critical` |
| qasphere | створити тест-ран з результатами в QA Sphere (за замовчуванням — так) |
| include_slow | включити @slow (AUTH-05, +11 хв) |

Що робить workflow: збирає Docker-образ (з кешем шарів), перевіряє типи, запускає тести в контейнері, пише підсумок у сторінку прогону (лічильники, таблиця падінь, посилання на QA Sphere-ран), викладає артефакти `allure-report`, `playwright-report` і `test-results` (trace/відео падінь), зберігає історію Allure між прогонами.

Налаштування репозиторію (**Settings → Secrets and variables → Actions**):

| Тип | Назва | Що це |
| --- | --- | --- |
| Secret | `QASPHERE_API_KEY` | API-ключ QA Sphere (той самий, що в `~/.zshrc`) |
| Secret | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | модератор (етап 2), поки можна не задавати |
| Secret | `PROCTOR_EMAIL`, `PROCTOR_PASSWORD` | відповідальний за пункт тестування (необов'язково) |
| Variable | `BASE_URL`, `ENV_NAME`, `GEO_MODE`, `MAIL_PROVIDER`, `QAS_PROJECT` | є дефолти для dev (`lms-exam-foreign-dev`, `none`, `maildrop`, `UKR`) — задавати лише для іншого оточення |
| Variable | `EXAM_NAME`, `*_TEST_CENTER_NAME` | тестові дані для кейсів іспитів (етап 3) |
| Variable | `TEST_PLAN_URL`, `REPORT_OWNER` | посилання й власник у звіті |
| Variable | `E2E_RUNNER` | мітка self-hosted runner, якщо dev недоступний з інтернету (VPN/білий список IP) |

## Що потрібно від dev-оточення

1. **Закордонний IP** для проєкту `foreign`. Dev (`lms-exam-foreign-dev`) емулює його сам → `GEO_MODE=none`. Для інших оточень — проксі/VPN (`proxy`) або тестовий заголовок (`header`). Якщо точок входу для іноземця немає — тест падає з `[geo]` в окрему категорію звіту.
2. **Пошта**: за замовчуванням [Maildrop](https://maildrop.cc) — публічні скриньки без реєстрації й ключів, кожен тест генерує свою адресу `ukrcert-…@maildrop.cc` і читає листи через GraphQL API. Скриньки публічні — лише тестові дані. Альтернатива — власний Mailpit (`MAIL_PROVIDER=mailpit`); інший сервіс = ще один `MailProvider` у `src/services/mail`.
3. **Обліковки** (етап 2): адміністратор (модерація, пункти тестування) і, за наявності, відповідальний за пункт тестування. Без `ADMIN_*` кейси модерації/допуску автоматично skipped, реєстрація працює.
4. **Дані**: іспит і три пункти тестування — «тільки для іноземних», звичайний і окремий для перемикання в EXAM-03.
5. Бажано: короткий TTL одноразового коду на dev, слот іспиту «зараз» (див. обмеження в PLAN.md).

## Сесія українського користувача (для EXAM-02/03, REGR-02)

Вхід лише через Дію, тому сесію знімаємо вручну один раз:

```bash
npx playwright codegen --save-storage=.auth/ua-user.json "$BASE_URL"
# увійти через Дію у вікні, що відкрилось, і закрити його
```

Потім у `.env`: `UA_USER_STORAGE_STATE=.auth/ua-user.json`. Без неї ці кейси позначаються skipped з поясненням.

## Allure-звіт

- Дерево epic → область (feature) → ID кейсу (story), severity з тегів `@blocker/@critical/@minor`, посилання на тест-план.
- Два оточення в одному звіті: «Іноземний користувач (CA)» і «Український користувач (UA)».
- Категорії падінь: пошта, гео, не налаштоване оточення, flaky, елемент не знайдено під час дії, провалена перевірка.
- У кроках — отримані листи (активація, код, відмова) і дані тестового користувача; на падіннях — trace, скріншот, відео.
- Тренди між прогонами — `allure-history/` (у CI кешувати цю теку).

## QA Sphere: кейси й результати прогонів

Документація кейсів живе в QA Sphere, автотести прив'язані до неї через `qasphere/cases.json` (назва тесту → номер кейсу).

**1. Створити кейси** (один раз і при появі нових тестів) — будь-яким способом:

- агентом з QA Sphere MCP: `npm run qasphere:export` → віддати агенту промпт із [`qasphere/AGENT_PROMPT.md`](qasphere/AGENT_PROMPT.md); він створить папку «Іноземні користувачі (Канада)», 46 кейсів з кроками й запише `cases.json`;
- або скриптом: `QAS_PROJECT=<код> npm run qasphere:sync -- --dry-run`, потім без `--dry-run`.

Кроки й передумови — `qasphere/catalog.json` (за ID з назви тесту); пріоритет — з тегів (`@blocker/@critical` → high, `@minor` → low). `cases.json` — у git.

**2. Прогони з репортом у QA Sphere:**

```bash
npm run test:qas              # усі тести → після прогону автоматично створюється тест-ран у QA Sphere
npm run test:reg:qas          # лише реєстрація (етап 1)
npm run report:qasphere       # залити останній прогін вручну (новий ран)
npm run report:qasphere -- -r <URL наявного рану>
```

- Ран називається `E2E · <ENV_NAME> · <дата час> · <BUILD_VERSION>` (або `QAS_RUN_NAME`), містить статуси, помилки, скріншоти/відео/trace падінь; повтори (retries) враховуються — береться останній результат.
- Звичайний `npm test` у QA Sphere нічого не пише — лише з `QAS_REPORT=1` (у CI — виставити змінну).
- Авторизація: `$QASPHERE_API_KEY` з `~/.zshrc` (стандарт qa-base) підхоплюється сам; інакше `npm run qasphere:login` або `QAS_TOKEN` + `QAS_URL` у `.env`.
- Перейменував тест — перейменуй і ключ у `cases.json` (`qasphere:sync --dry-run` покаже «осиротілі» ключі).

## Де що міняти

- **Локатори й тексти UI** — лише `src/pages/**` (позначені `TODO(dev)`), шляхи — `src/config/routes.ts`.
- **Шаблони листів** (довжина коду, вигляд посилання активації) — `src/services/mail/extract.ts`.
- **Новий кейс** — назва починається з ID (`'REG-13 …'`), тег `@foreign` або `@ua` на describe; Allure-мітки проставляються автоматично.
