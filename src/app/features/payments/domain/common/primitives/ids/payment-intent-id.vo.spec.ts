import { PaymentIntentId } from './payment-intent-id.vo';

describe('PaymentIntentId', () => {
  describe('from', () => {
    it('should create a valid PaymentIntentId from a valid string', () => {
      const result = PaymentIntentId.from('pi_1234567890');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe('pi_1234567890');
      }
    });

    it('should trim whitespace from the input', () => {
      const result = PaymentIntentId.from('  abc123  ');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe('abc123');
      }
    });

    it('should accept alphanumeric characters, underscores, and hyphens', () => {
      const result = PaymentIntentId.from('order_123-ABC');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe('order_123-ABC');
      }
    });

    it('should fail for empty string', () => {
      const result = PaymentIntentId.from('');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].code).toBe('PAYMENT_INTENT_ID_EMPTY');
      }
    });

    it('should fail for whitespace-only string', () => {
      const result = PaymentIntentId.from('   ');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('PAYMENT_INTENT_ID_EMPTY');
      }
    });

    it('should fail for string exceeding max length', () => {
      const longId = 'a'.repeat(256);
      const result = PaymentIntentId.from(longId);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('PAYMENT_INTENT_ID_TOO_LONG');
        expect(result.violations[0].meta?.['length']).toBe(256);
        expect(result.violations[0].meta?.['max']).toBe(255);
      }
    });

    it('should accept string at max length', () => {
      const maxId = 'a'.repeat(255);
      const result = PaymentIntentId.from(maxId);

      expect(result.ok).toBe(true);
    });

    it('should fail for invalid characters (spaces)', () => {
      const result = PaymentIntentId.from('invalid id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('PAYMENT_INTENT_ID_INVALID_CHARSET');
      }
    });

    it('should fail for invalid characters (special)', () => {
      const result = PaymentIntentId.from('id@#$%');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('PAYMENT_INTENT_ID_INVALID_CHARSET');
      }
    });

    it('should handle null input gracefully', () => {
      const result = PaymentIntentId.from(null as unknown as string);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('PAYMENT_INTENT_ID_EMPTY');
      }
    });

    it('should handle undefined input gracefully', () => {
      const result = PaymentIntentId.from(undefined as unknown as string);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('PAYMENT_INTENT_ID_EMPTY');
      }
    });
  });

  describe('MAX_LENGTH', () => {
    it('should expose the max length constant', () => {
      expect(PaymentIntentId.MAX_LENGTH).toBe(255);
    });
  });
});
