import { StripeTokenValidator } from './stripe-token.validator';

describe('StripeTokenValidator', () => {
  let validator: StripeTokenValidator;

  beforeEach(() => {
    validator = new StripeTokenValidator();
  });

  describe('requiresToken()', () => {
    it('returns true (Stripe requires tokens)', () => {
      expect(validator.requiresToken()).toBe(true);
    });
  });

  describe('validate()', () => {
    it('accepts valid tok_ tokens (14+ chars after prefix)', () => {
      expect(() => validator.validate('tok_1234567890abcdef')).not.toThrow();
      expect(() => validator.validate('tok_abcdefghijklmn')).not.toThrow();
    });

    it('accepts valid pm_ tokens (PaymentMethod)', () => {
      expect(() => validator.validate('pm_1234567890abcdef')).not.toThrow();
      expect(() => validator.validate('pm_abcdefghijklmnop')).not.toThrow();
    });

    it('accepts valid card_ tokens (legacy)', () => {
      expect(() => validator.validate('card_1234567890abcd')).not.toThrow();
      expect(() => validator.validate('card_abcdefghijklmn')).not.toThrow();
    });

    it('throws for tokens with less than 14 chars after prefix', () => {
      expect(() => validator.validate('tok_short')).toThrow(/Invalid token format/);
      expect(() => validator.validate('pm_123')).toThrow(/Invalid token format/);
      expect(() => validator.validate('card_abc')).toThrow(/Invalid token format/);
    });

    it('throws for invalid prefixes', () => {
      expect(() => validator.validate('invalid_token1234567890')).toThrow(/Invalid token format/);
      expect(() => validator.validate('stripe_1234567890abcd')).toThrow(/Invalid token format/);
    });

    it('throws for empty token', () => {
      expect(() => validator.validate('')).toThrow(/Token is required/);
    });

    it('throws for null/undefined token', () => {
      expect(() => validator.validate(null as any)).toThrow();
      expect(() => validator.validate(undefined as any)).toThrow();
    });
  });

  describe('isValid()', () => {
    it('returns true for valid tokens', () => {
      expect(validator.isValid('tok_1234567890abcdef')).toBe(true);
      expect(validator.isValid('pm_1234567890abcdefg')).toBe(true);
      expect(validator.isValid('card_1234567890abcd')).toBe(true);
    });

    it('returns false for invalid tokens', () => {
      expect(validator.isValid('tok_short')).toBe(false);
      expect(validator.isValid('invalid')).toBe(false);
      expect(validator.isValid('')).toBe(false);
    });
  });

  describe('getAcceptedPatterns()', () => {
    it('returns pattern descriptions', () => {
      const patterns = validator.getAcceptedPatterns();
      expect(patterns).toContain('tok_* (Stripe.js token)');
      expect(patterns).toContain('pm_* (PaymentMethod ID)');
      expect(patterns).toContain('card_* (Card ID)');
    });
  });

  describe('isSavedCard()', () => {
    it('returns true for pm_ tokens', () => {
      expect(validator.isSavedCard('pm_1234567890abcdef')).toBe(true);
    });

    it('returns false for tok_ tokens', () => {
      expect(validator.isSavedCard('tok_1234567890abcdef')).toBe(false);
    });

    it('returns false for card_ tokens', () => {
      expect(validator.isSavedCard('card_1234567890abcd')).toBe(false);
    });
  });

  describe('isStripeJsToken()', () => {
    it('returns true for tok_ tokens', () => {
      expect(validator.isStripeJsToken('tok_1234567890abcdef')).toBe(true);
    });

    it('returns false for pm_ tokens', () => {
      expect(validator.isStripeJsToken('pm_1234567890abcdef')).toBe(false);
    });
  });

  describe('getTokenType()', () => {
    it('returns stripe_js for tok_ prefix', () => {
      expect(validator.getTokenType('tok_anything')).toBe('stripe_js');
    });

    it('returns payment_method for pm_ prefix', () => {
      expect(validator.getTokenType('pm_anything')).toBe('payment_method');
    });

    it('returns card for card_ prefix', () => {
      expect(validator.getTokenType('card_anything')).toBe('card');
    });

    it('returns unknown for unrecognized prefix', () => {
      expect(validator.getTokenType('invalid_token')).toBe('unknown');
      expect(validator.getTokenType('random')).toBe('unknown');
    });
  });
});
