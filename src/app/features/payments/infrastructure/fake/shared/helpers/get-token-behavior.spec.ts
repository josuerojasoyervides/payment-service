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

  it('returns normal for unknown token', () => {
    expect(getTokenBehavior('tok_visa1234567890abcdef')).toBe('normal');
    expect(getTokenBehavior('pm_abc')).toBe('normal');
  });
});
