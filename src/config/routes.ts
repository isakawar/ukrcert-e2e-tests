/**
 * Шляхи застосунку в одному місці.
 * ✅ — звірено з dev (lms-exam-foreign-dev), TODO(dev) — ще припущення.
 */
export const routes = {
  home: '/', // ✅
  registration: '/foreign/registration/', // ✅ крок 1: email
  registrationApply: '/foreign/registration/apply/', // ✅ крок 2: форма заявки
  registrationStatus: '/foreign/registration/status/', // ✅ + <uuid заявки>/
  login: '/foreign/registration/login/', // ✅ вхід за одноразовим кодом
  exams: '/exams', // TODO(dev)
  myExams: '/exams/my', // TODO(dev)
  profile: '/profile', // TODO(dev)
  staffLogin: '/admin/login/', // TODO(dev)
  moderation: '/admin/foreign-users/applications/', // TODO(dev)
  testCenters: '/admin/test-centers/', // TODO(dev)
  admission: '/admin/admission/', // TODO(dev)
} as const;
