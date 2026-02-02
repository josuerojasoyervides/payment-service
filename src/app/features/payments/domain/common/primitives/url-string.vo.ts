import type { Result } from '@payments/domain/common/primitives/result.types';

export type UrlStringViolationCode =
  | 'URL_STRING_EMPTY'
  | 'URL_STRING_INVALID_FORMAT'
  | 'URL_STRING_INVALID_SCHEME'
  | 'URL_STRING_NOT_ABSOLUTE';

export interface UrlStringViolation {
  code: UrlStringViolationCode;
  meta?: Record<string, number | string>;
}

/**
 * UrlString value object.
 * Represents a valid absolute URL for redirects, webhooks, etc.
 *
 * Invariants:
 * - Non-empty after trim
 * - Valid URL format (parseable by URL constructor)
 * - Absolute URL (has protocol)
 * - Allowed schemes: http, https (configurable via options)
 *
 * NOTE: Deep links (e.g., myapp://) can be allowed by passing custom schemes.
 * This keeps Domain flexible while Application layer can enforce stricter rules.
 */
export interface UrlString {
  readonly value: string;
}

export interface UrlStringOptions {
  /**
   * Allowed URL schemes. Defaults to ['http:', 'https:']
   * For deep links, pass ['http:', 'https:', 'myapp:']
   */
  allowedSchemes?: string[];
}

const DEFAULT_ALLOWED_SCHEMES = ['http:', 'https:'];

/**
 * Creates a UrlString value object.
 *
 * @param raw - The raw string URL
 * @param options - Optional configuration for validation
 * @returns Result with UrlString or violations
 */
function from(raw: string, options?: UrlStringOptions): Result<UrlString, UrlStringViolation> {
  const violations: UrlStringViolation[] = [];
  const allowedSchemes = options?.allowedSchemes ?? DEFAULT_ALLOWED_SCHEMES;

  const trimmed = (raw ?? '').trim();

  if (trimmed.length === 0) {
    violations.push({
      code: 'URL_STRING_EMPTY',
    });
    return { ok: false, violations };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    violations.push({
      code: 'URL_STRING_INVALID_FORMAT',
      meta: { value: trimmed },
    });
    return { ok: false, violations };
  }

  // Check if URL is absolute (has protocol)
  if (!url.protocol) {
    violations.push({
      code: 'URL_STRING_NOT_ABSOLUTE',
      meta: { value: trimmed },
    });
    return { ok: false, violations };
  }

  // Check if scheme is allowed
  if (!allowedSchemes.includes(url.protocol)) {
    violations.push({
      code: 'URL_STRING_INVALID_SCHEME',
      meta: { scheme: url.protocol, allowed: allowedSchemes.join(', ') },
    });
    return { ok: false, violations };
  }

  return {
    ok: true,
    value: { value: trimmed },
  };
}

export const UrlString = {
  from,
  DEFAULT_ALLOWED_SCHEMES,
};
