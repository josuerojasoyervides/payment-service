/**
 * Special tokens to control fake gateway behavior.
 *
 * Usage:
 * - tok_success: Immediate success
 * - tok_3ds: requires_action with redirect (3DS)
 * - tok_client_confirm: requires_action with client_confirm (use_stripe_sdk)
 * - tok_fail: Always fails (provider_error)
 * - tok_timeout: Simulates delay then timeout error
 * - tok_decline: Card declined
 * - tok_insufficient: Insufficient funds
 * - tok_expired: Expired card
 * - tok_processing: Processing status (refresh => succeeded)
 */
export const SPECIAL_TOKENS = {
  SUCCESS: 'tok_success',
  THREE_DS: 'tok_3ds',
  CLIENT_CONFIRM: 'tok_client_confirm',
  FAIL: 'tok_fail',
  TIMEOUT: 'tok_timeout',
  DECLINE: 'tok_decline',
  INSUFFICIENT: 'tok_insufficient',
  EXPIRED: 'tok_expired',
  PROCESSING: 'tok_processing',
} as const;
