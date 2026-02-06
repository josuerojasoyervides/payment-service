import { SPECIAL_TOKENS } from '@app/features/payments/infrastructure/fake/shared/constants/special-tokens';
import { getTokenBehavior } from '@app/features/payments/infrastructure/fake/shared/helpers/get-token-behavior';

describe('getTokenBehavior', () => {
  it('returns normal when token is undefined', () => {
    expect(getTokenBehavior(undefined)).toBe('normal');
  });

  it('returns normal when token is empty', () => {
    expect(getTokenBehavior('')).toBe('normal');
  });

  it('returns success for tok_success', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.SUCCESS)).toBe('success');
    expect(getTokenBehavior('tok_success_abc')).toBe('success');
  });

  it('returns 3ds for tok_3ds', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.THREE_DS)).toBe('3ds');
    expect(getTokenBehavior('tok_3ds_xyz')).toBe('3ds');
  });

  it('returns client_confirm for tok_client_confirm', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.CLIENT_CONFIRM)).toBe('client_confirm');
    expect(getTokenBehavior('tok_client_confirm_abc')).toBe('client_confirm');
  });

  it('returns fail for tok_fail', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.FAIL)).toBe('fail');
  });

  it('returns timeout for tok_timeout', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.TIMEOUT)).toBe('timeout');
  });

  it('returns decline for tok_decline', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.DECLINE)).toBe('decline');
  });

  it('returns insufficient for tok_insufficient', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.INSUFFICIENT)).toBe('insufficient');
  });

  it('returns expired for tok_expired', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.EXPIRED)).toBe('expired');
  });

  it('returns processing for tok_processing', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.PROCESSING)).toBe('processing');
  });

  it('returns circuit for tok_circuit', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.CIRCUIT_TRIP)).toBe('circuit');
    expect(getTokenBehavior('tok_circuit_abc')).toBe('circuit');
  });

  it('returns rate_limit for tok_rate_limit', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.RATE_LIMIT_HIT)).toBe('rate_limit');
    expect(getTokenBehavior('tok_rate_limit_abc')).toBe('rate_limit');
  });

  it('returns retry_exhaust for tok_retry_exhaust', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.RETRY_EXHAUST)).toBe('retry_exhaust');
    expect(getTokenBehavior('tok_retry_exhaust_abc')).toBe('retry_exhaust');
  });

  it('returns half_open_fail for tok_half_open_fail', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.HALF_OPEN_FAIL)).toBe('half_open_fail');
    expect(getTokenBehavior('tok_half_open_fail_abc')).toBe('half_open_fail');
  });

  it('returns slow_response for tok_slow', () => {
    expect(getTokenBehavior(SPECIAL_TOKENS.SLOW_RESPONSE)).toBe('slow_response');
    expect(getTokenBehavior('tok_slow_abc')).toBe('slow_response');
  });

  it('returns normal for unknown token', () => {
    expect(getTokenBehavior('tok_visa1234567890abcdef')).toBe('normal');
    expect(getTokenBehavior('pm_abc')).toBe('normal');
  });
});
