import { InjectionToken } from '@angular/core';
import type { RedirectReturnNormalizerPort } from '@app/features/payments/application/api/ports/redirect-return-normalizer.port';

export const REDIRECT_RETURN_NORMALIZERS = new InjectionToken<RedirectReturnNormalizerPort[]>(
  'REDIRECT_RETURN_NORMALIZERS',
  {
    factory: () => [],
  },
);
