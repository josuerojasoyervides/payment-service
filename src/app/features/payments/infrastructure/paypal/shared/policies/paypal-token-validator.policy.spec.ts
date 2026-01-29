import { PaypalTokenValidatorPolicy } from '@app/features/payments/infrastructure/paypal/shared/policies/paypal-token-validator.policy';

describe('PaypalTokenValidatorPolicy', () => {
  let validator: PaypalTokenValidatorPolicy;

  beforeEach(() => {
    validator = new PaypalTokenValidatorPolicy();
  });

  describe('requiresToken()', () => {
    it('returns false (PayPal uses redirect flow)', () => {
      expect(validator.requiresToken()).toBe(false);
    });
  });

  describe('validate()', () => {
    it('does not throw for any value (no-op)', () => {
      expect(() => validator.validate('anything')).not.toThrow();
      expect(() => validator.validate('')).not.toThrow();
      expect(() => validator.validate('random_token')).not.toThrow();
    });
  });

  describe('isValid()', () => {
    it('returns true for any value', () => {
      expect(validator.isValid('anything')).toBe(true);
      expect(validator.isValid('')).toBe(true);
      expect(validator.isValid('random')).toBe(true);
    });
  });

  describe('getAcceptedPatterns()', () => {
    it('returns message indicating no token required', () => {
      const patterns = validator.getAcceptedPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0]).toContain('redirect flow');
      expect(patterns[0]).toContain('no client-side token');
    });
  });
});
