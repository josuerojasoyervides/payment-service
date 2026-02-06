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
 * - tok_circuit: Simulates circuit open error
 * - tok_rate_limit: Simulates rate limit error
 * - tok_retry_exhaust: Forces finalize retries to exhaust
 * - tok_half_open_fail: Simulates half-open probe failure
 * - tok_slow: Simulates slow network response
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
  CIRCUIT_TRIP: 'tok_circuit',
  RATE_LIMIT_HIT: 'tok_rate_limit',
  RETRY_EXHAUST: 'tok_retry_exhaust',
  HALF_OPEN_FAIL: 'tok_half_open_fail',
  SLOW_RESPONSE: 'tok_slow',
} as const;
