/**
 * Special tokens to control fake gateway behavior.
 *
 * Usage:
 * - tok_success: Always immediate success
 * - tok_3ds: Requires 3D Secure
 * - tok_fail: Always fails
 * - tok_timeout: Simulates timeout (long delay)
 * - tok_decline: Card declined
 * - tok_insufficient: Insufficient funds
 * - tok_expired: Expired card
 * - tok_processing: Processing status
 */
export const SPECIAL_TOKENS = {
  SUCCESS: 'tok_success',
  THREE_DS: 'tok_3ds',
  FAIL: 'tok_fail',
  TIMEOUT: 'tok_timeout',
  DECLINE: 'tok_decline',
  INSUFFICIENT: 'tok_insufficient',
  EXPIRED: 'tok_expired',
  PROCESSING: 'tok_processing',
} as const;
