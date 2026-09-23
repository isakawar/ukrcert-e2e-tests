/**
 * Шляхи застосунку в одному місці.
 * ✅ — звірено з dev, TODO(dev) — ще припущення.
 * Кабінет іноземця — BASE_URL (lms-exam-foreign-dev), модерація — ADMIN_BASE_URL (lms-exam-dev).
 */
export const routes = {
  home: '/', // ✅
  registration: '/foreign/registration/', // ✅ крок 1: email
  registrationApply: '/foreign/registration/apply/', // ✅ крок 2: форма заявки
  registrationStatus: '/foreign/registration/status/', // ✅ + <uuid заявки>/
  resubmit: (applicationId: string) => `/foreign/registration/status/${applicationId}/resubmit/`, // ✅ після відмови
  login: '/foreign/registration/login/', // ✅ вхід за одноразовим кодом: крок з email
  loginCode: '/foreign/registration/login/code/', // ✅ крок з кодом
  exams: '/exams', // TODO(dev)
  myExams: '/exams/my', // TODO(dev)
  profile: '/profile', // TODO(dev)

  // ADMIN_BASE_URL
  staffLogin: '/login', // ✅ стандартний вхід Open edX за паролем
  moderation: '/foreign/registration/review/', // ✅ ?status=pending|approved|rejected|pending_document
  moderationApplication: (reviewId: number) => `/foreign/registration/review/${reviewId}/`, // ✅
  accountsApi: '/api/user/v1/accounts', // ✅ ?email= → 200 [акаунт] | 404 (сесія модератора)
  testCenters: '/exams/centers/', // TODO(dev): «Центри іспитування» у меню модератора
  admission: '/admin/admission/', // TODO(dev)
} as const;
