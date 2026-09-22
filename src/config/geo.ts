import type { PlaywrightTestOptions } from '@playwright/test';
import { env } from './env';

/**
 * Налаштування контексту браузера, що робить запити "з-за кордону".
 * Використовується лише проєктом `foreign` у playwright.config.ts.
 */
export function foreignGeoUse(): Partial<PlaywrightTestOptions> {
  switch (env.geoMode) {
    case 'proxy':
      return { proxy: env.geoProxy };
    case 'header':
      return { extraHTTPHeaders: { [env.geoHeader.name]: env.geoHeader.value } };
    case 'none':
      return {};
  }
}
