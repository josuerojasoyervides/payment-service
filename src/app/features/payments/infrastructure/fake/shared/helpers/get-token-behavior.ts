import { SPECIAL_TOKENS } from '@app/features/payments/infrastructure/fake/shared/constants/special-tokens';

/**
 * Checks if token is special and determines behavior.
 *
 * Supports:
 * - Exact match: tok_3ds
 * - With underscore: tok_3ds_abc
 * - Without underscore: tok_3ds123 (for backward compatibility)
 */
export type TokenBehavior =
  | 'success'
  | '3ds'
  | 'client_confirm'
  | 'fail'
  | 'timeout'
  | 'decline'
  | 'insufficient'
  | 'expired'
  | 'processing'
  | 'normal';

export function getTokenBehavior(token?: string): TokenBehavior {
  if (!token) return 'normal';

  if (token === SPECIAL_TOKENS.SUCCESS) return 'success';
  if (token === SPECIAL_TOKENS.THREE_DS) return '3ds';
  if (token === SPECIAL_TOKENS.CLIENT_CONFIRM) return 'client_confirm';
  if (token === SPECIAL_TOKENS.FAIL) return 'fail';
  if (token === SPECIAL_TOKENS.TIMEOUT) return 'timeout';
  if (token === SPECIAL_TOKENS.DECLINE) return 'decline';
  if (token === SPECIAL_TOKENS.INSUFFICIENT) return 'insufficient';
  if (token === SPECIAL_TOKENS.EXPIRED) return 'expired';
  if (token === SPECIAL_TOKENS.PROCESSING) return 'processing';

  if (token.startsWith(SPECIAL_TOKENS.SUCCESS)) return 'success';
  if (token.startsWith(SPECIAL_TOKENS.THREE_DS)) return '3ds';
  if (token.startsWith(SPECIAL_TOKENS.CLIENT_CONFIRM)) return 'client_confirm';
  if (token.startsWith(SPECIAL_TOKENS.FAIL)) return 'fail';
  if (token.startsWith(SPECIAL_TOKENS.TIMEOUT)) return 'timeout';
  if (token.startsWith(SPECIAL_TOKENS.DECLINE)) return 'decline';
  if (token.startsWith(SPECIAL_TOKENS.INSUFFICIENT)) return 'insufficient';
  if (token.startsWith(SPECIAL_TOKENS.EXPIRED)) return 'expired';
  if (token.startsWith(SPECIAL_TOKENS.PROCESSING)) return 'processing';

  return 'normal';
}
