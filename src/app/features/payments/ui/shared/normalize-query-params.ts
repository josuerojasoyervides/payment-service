import type { Params } from '@angular/router';

/**
 * Normalizes Angular route query params to a flat Record<string, string>.
 * Used by return/redirect pages before passing params to the payment state port.
 */
export function normalizeQueryParams(params: Params): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) out[k] = v.join(',');
    else if (v == null) out[k] = '';
    else out[k] = String(v);
  }
  return out;
}
