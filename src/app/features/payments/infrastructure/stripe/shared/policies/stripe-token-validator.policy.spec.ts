import { StripeTokenValidatorPolicy } from '@app/features/payments/infrastructure/stripe/shared/policies/stripe-token-validator.policy';
import { I18nKeys } from '@core/i18n';

describe('StripeTokenValidatorPolicy', () => {
  let policy: StripeTokenValidatorPolicy;

  beforeEach(() => {
    policy = new StripeTokenValidatorPolicy();
  });

  describe('requiresToken()', () => {
    it('returns true (Stripe requires tokens)', () => {
      expect(policy.requiresToken()).toBe(true);
    });
  });

  describe('validate()', () => {
    it('accepts valid tok_ tokens (14+ chars after prefix)', () => {
      expect(() => policy.validate('tok_1234567890abcdef')).not.toThrow();
      expect(() => policy.validate('tok_abcdefghijklmn')).not.toThrow();
    });

    it('accepts valid pm_ tokens (PaymentMethod)', () => {
      expect(() => policy.validate('pm_1234567890abcdef')).not.toThrow();
      expect(() => policy.validate('pm_abcdefghijklmnop')).not.toThrow();
    });

    it('accepts valid card_ tokens (legacy)', () => {
      expect(() => policy.validate('card_1234567890abcd')).not.toThrow();
      expect(() => policy.validate('card_abcdefghijklmn')).not.toThrow();
    });

    it('throws PaymentError for tokens with less than 14 chars after prefix', () => {
      expect(() => policy.validate('tok_short')).toThrow(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.card_token_invalid_format,
        }),
      );
      expect(() => policy.validate('pm_123')).toThrow(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.card_token_invalid_format,
        }),
      );
      expect(() => policy.validate('card_abc')).toThrow(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.card_token_invalid_format,
        }),
      );
    });

    it('throws PaymentError for invalid prefixes', () => {
      expect(() => policy.validate('invalid_token1234567890')).toThrow(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.card_token_invalid_format,
        }),
      );
      expect(() => policy.validate('stripe_1234567890abcd')).toThrow(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.card_token_invalid_format,
        }),
      );
    });

    it('throws PaymentError for empty token', () => {
      expect(() => policy.validate('')).toThrow(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.card_token_required,
        }),
      );
    });

    it('throws PaymentError for null/undefined token', () => {
      expect(() => policy.validate(null as any)).toThrow(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.card_token_required,
        }),
      );
      expect(() => policy.validate(undefined as any)).toThrow(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.card_token_required,
        }),
      );
    });
  });

  describe('isValid()', () => {
    it('returns true for valid tokens', () => {
      expect(policy.isValid('tok_1234567890abcdef')).toBe(true);
      expect(policy.isValid('pm_1234567890abcdefg')).toBe(true);
      expect(policy.isValid('card_1234567890abcd')).toBe(true);
    });

    it('returns false for invalid tokens', () => {
      expect(policy.isValid('tok_short')).toBe(false);
      expect(policy.isValid('invalid')).toBe(false);
      expect(policy.isValid('')).toBe(false);
    });
  });

  describe('getAcceptedPatterns()', () => {
    it('returns pattern descriptions', () => {
      const patterns = policy.getAcceptedPatterns();
      expect(patterns).toContain('tok_* (Stripe.js token)');
      expect(patterns).toContain('pm_* (PaymentMethod ID)');
      expect(patterns).toContain('card_* (Card ID)');
    });
  });

  describe('isSavedCard()', () => {
    it('returns true for pm_ tokens', () => {
      expect(policy.isSavedCard('pm_1234567890abcdef')).toBe(true);
    });

    it('returns false for tok_ tokens', () => {
      expect(policy.isSavedCard('tok_1234567890abcdef')).toBe(false);
    });

    it('returns false for card_ tokens', () => {
      expect(policy.isSavedCard('card_1234567890abcd')).toBe(false);
    });
  });

  describe('isStripeJsToken()', () => {
    it('returns true for tok_ tokens', () => {
      expect(policy.isStripeJsToken('tok_1234567890abcdef')).toBe(true);
    });

    it('returns false for pm_ tokens', () => {
      expect(policy.isStripeJsToken('pm_1234567890abcdef')).toBe(false);
    });
  });

  describe('getTokenType()', () => {
    it('returns stripe_js for tok_ prefix', () => {
      expect(policy.getTokenType('tok_anything')).toBe('stripe_js');
    });

    it('returns payment_method for pm_ prefix', () => {
      expect(policy.getTokenType('pm_anything')).toBe('payment_method');
    });

    it('returns card for card_ prefix', () => {
      expect(policy.getTokenType('card_anything')).toBe('card');
    });

    it('returns unknown for unrecognized prefix', () => {
      expect(policy.getTokenType('invalid_token')).toBe('unknown');
      expect(policy.getTokenType('random')).toBe('unknown');
    });
  });
});
