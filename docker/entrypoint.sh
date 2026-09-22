#!/usr/bin/env bash
# Прогін тестів у контейнері: playwright test "$@" → Allure-звіт → копія результатів у /out → вихід з кодом тестів.
# QA Sphere-ран створює репортер самого Playwright, якщо QAS_REPORT=1.
#
# Результати пишуться всередині контейнера і лише наприкінці копіюються в змонтовану теку /out
# (docker compose: ./reports). Так Playwright може спокійно чистити свої теки, а старі прогони не змішуються з новими.
set -uo pipefail
cd "$(dirname "$0")/.."
OUT="${OUT_DIR:-/out}"
DIRS=(test-results playwright-report allure-results allure-report allure-history)

# Історія Allure (тренди між прогонами) приходить з попередніх результатів
mkdir -p allure-history
if [ -d "$OUT/allure-history" ]; then
  cp -r "$OUT/allure-history/." allure-history/
fi

./node_modules/.bin/playwright test "$@"
code=$?

if compgen -G "allure-results/*-result.json" >/dev/null; then
  ./node_modules/.bin/allure generate ./allure-results >/dev/null \
    || echo "⚠ Allure-звіт не згенеровано"
fi

if [ -d "$OUT" ]; then
  for d in "${DIRS[@]}"; do
    rm -rf "${OUT:?}/$d"
    [ -d "$d" ] && cp -r "$d" "$OUT/"
  done
  echo "📁 Результати: reports/ (Allure: reports/allure-report/awesome/index.html)"
fi

exit $code
