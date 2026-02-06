import type { Params } from '@angular/router';
import type { RedirectReturnRaw } from '@payments/application/api/contracts/redirect-return.contract';

/**
 * Convert Angular route query params to RedirectReturnRaw.
 * Keeps arrays intact so normalizers can apply \"last wins\" consistently.
 */
export function toRedirectReturnRaw(params: Params): RedirectReturnRaw {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      query[key] = value.map((item) => (item == null ? '' : String(item)));
      continue;
    }
    if (value == null) {
      query[key] = '';
      continue;
    }
    query[key] = String(value);
  }
  return { query };
}
