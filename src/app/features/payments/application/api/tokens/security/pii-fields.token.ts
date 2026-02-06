import { InjectionToken } from '@angular/core';

/**
 * Injectable list of PII field names to redact in logs/errors.
 */
export const PII_FIELDS = new InjectionToken<readonly string[]>('PII_FIELDS');
