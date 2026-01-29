import { SPECIAL_TOKENS } from '@app/features/payments/infrastructure/fake/shared/constants/special-tokens';

/**
 * Checks if token is special and determines behavior.
 *
 * Supports:
 * - Exact match: tok_3ds
 * - With underscore: tok_3ds_abc
 * - Without underscore: tok_3ds123 (for backward compatibility)
 */
export function getTokenBehavior(
  token?: string,
):
  | 'success'
  | '3ds'
  | 'fail'
  | 'timeout'
  | 'decline'
  | 'insufficient'
  | 'expired'
  | 'processing'
  | 'normal' {
  if (!token) return 'normal';

  // Check exact match first
  if (token === SPECIAL_TOKENS.SUCCESS) return 'success';
  if (token === SPECIAL_TOKENS.THREE_DS) return '3ds';
  if (token === SPECIAL_TOKENS.FAIL) return 'fail';
  if (token === SPECIAL_TOKENS.TIMEOUT) return 'timeout';
  if (token === SPECIAL_TOKENS.DECLINE) return 'decline';
  if (token === SPECIAL_TOKENS.INSUFFICIENT) return 'insufficient';
  if (token === SPECIAL_TOKENS.EXPIRED) return 'expired';
  if (token === SPECIAL_TOKENS.PROCESSING) return 'processing';

  // Check prefix match (with or without underscore)
  if (token.startsWith(SPECIAL_TOKENS.SUCCESS)) return 'success';
  if (token.startsWith(SPECIAL_TOKENS.THREE_DS)) return '3ds';
  if (token.startsWith(SPECIAL_TOKENS.FAIL)) return 'fail';
  if (token.startsWith(SPECIAL_TOKENS.TIMEOUT)) return 'timeout';
  if (token.startsWith(SPECIAL_TOKENS.DECLINE)) return 'decline';
  if (token.startsWith(SPECIAL_TOKENS.INSUFFICIENT)) return 'insufficient';
  if (token.startsWith(SPECIAL_TOKENS.EXPIRED)) return 'expired';
  if (token.startsWith(SPECIAL_TOKENS.PROCESSING)) return 'processing';

  return 'normal';
}
