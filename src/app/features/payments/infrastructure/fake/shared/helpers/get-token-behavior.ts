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
  | 'circuit'
  | 'rate_limit'
  | 'retry_exhaust'
  | 'half_open_fail'
  | 'slow_response'
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
  if (token === SPECIAL_TOKENS.CIRCUIT_TRIP) return 'circuit';
  if (token === SPECIAL_TOKENS.RATE_LIMIT_HIT) return 'rate_limit';
  if (token === SPECIAL_TOKENS.RETRY_EXHAUST) return 'retry_exhaust';
  if (token === SPECIAL_TOKENS.HALF_OPEN_FAIL) return 'half_open_fail';
  if (token === SPECIAL_TOKENS.SLOW_RESPONSE) return 'slow_response';

  if (token.startsWith(SPECIAL_TOKENS.SUCCESS)) return 'success';
  if (token.startsWith(SPECIAL_TOKENS.THREE_DS)) return '3ds';
  if (token.startsWith(SPECIAL_TOKENS.CLIENT_CONFIRM)) return 'client_confirm';
  // Alphanumeric-only variant for integration tests (Stripe validator: tok_[a-zA-Z0-9]{14,})
  if (token.startsWith('tok_clientconfirm')) return 'client_confirm';
  if (token.startsWith(SPECIAL_TOKENS.FAIL)) return 'fail';
  if (token.startsWith(SPECIAL_TOKENS.TIMEOUT)) return 'timeout';
  if (token.startsWith(SPECIAL_TOKENS.DECLINE)) return 'decline';
  if (token.startsWith(SPECIAL_TOKENS.INSUFFICIENT)) return 'insufficient';
  if (token.startsWith(SPECIAL_TOKENS.EXPIRED)) return 'expired';
  if (token.startsWith(SPECIAL_TOKENS.PROCESSING)) return 'processing';
  if (token.startsWith(SPECIAL_TOKENS.CIRCUIT_TRIP)) return 'circuit';
  if (token.startsWith(SPECIAL_TOKENS.RATE_LIMIT_HIT)) return 'rate_limit';
  if (token.startsWith(SPECIAL_TOKENS.RETRY_EXHAUST)) return 'retry_exhaust';
  if (token.startsWith(SPECIAL_TOKENS.HALF_OPEN_FAIL)) return 'half_open_fail';
  if (token.startsWith(SPECIAL_TOKENS.SLOW_RESPONSE)) return 'slow_response';

  return 'normal';
}
