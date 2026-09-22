/** Збережені сесії співробітників (створюються проєктом `setup`, у git не потрапляють). */
export const AUTH_FILES = {
  admin: '.auth/admin.json',
  proctor: '.auth/proctor.json',
} as const;
