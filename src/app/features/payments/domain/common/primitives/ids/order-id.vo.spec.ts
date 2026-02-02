import { OrderId } from './order-id.vo';

describe('OrderId', () => {
  describe('from', () => {
    it('should create a valid OrderId from a valid string', () => {
      const result = OrderId.from('ORD-123456');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe('ORD-123456');
      }
    });

    it('should trim whitespace from the input', () => {
      const result = OrderId.from('  order123  ');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe('order123');
      }
    });

    it('should accept alphanumeric characters, underscores, and hyphens', () => {
      const result = OrderId.from('order_123-ABC');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe('order_123-ABC');
      }
    });

    it('should fail for empty string', () => {
      const result = OrderId.from('');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].code).toBe('ORDER_ID_EMPTY');
      }
    });

    it('should fail for whitespace-only string', () => {
      const result = OrderId.from('   ');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('ORDER_ID_EMPTY');
      }
    });

    it('should fail for string exceeding max length', () => {
      const longId = 'a'.repeat(65);
      const result = OrderId.from(longId);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('ORDER_ID_TOO_LONG');
        expect(result.violations[0].meta?.['length']).toBe(65);
        expect(result.violations[0].meta?.['max']).toBe(64);
      }
    });

    it('should accept string at max length', () => {
      const maxId = 'a'.repeat(64);
      const result = OrderId.from(maxId);

      expect(result.ok).toBe(true);
    });

    it('should fail for invalid characters (spaces)', () => {
      const result = OrderId.from('invalid id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('ORDER_ID_INVALID_CHARSET');
      }
    });

    it('should fail for invalid characters (special)', () => {
      const result = OrderId.from('id@#$%');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('ORDER_ID_INVALID_CHARSET');
      }
    });

    it('should handle null input gracefully', () => {
      const result = OrderId.from(null as unknown as string);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('ORDER_ID_EMPTY');
      }
    });

    it('should handle undefined input gracefully', () => {
      const result = OrderId.from(undefined as unknown as string);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations[0].code).toBe('ORDER_ID_EMPTY');
      }
    });
  });

  describe('sanitizeForSpei', () => {
    it('should uppercase and remove non-alphanumeric characters', () => {
      const result = OrderId.from('order_123-abc');
      expect(result.ok).toBe(true);

      if (result.ok) {
        const sanitized = OrderId.sanitizeForSpei(result.value);
        expect(sanitized).toBe('ORDER123ABC');
      }
    });

    it('should handle orderId with only alphanumeric characters', () => {
      const result = OrderId.from('ABC123');
      expect(result.ok).toBe(true);

      if (result.ok) {
        const sanitized = OrderId.sanitizeForSpei(result.value);
        expect(sanitized).toBe('ABC123');
      }
    });

    it('should handle orderId with underscores and hyphens', () => {
      const result = OrderId.from('order-123_test');
      expect(result.ok).toBe(true);

      if (result.ok) {
        const sanitized = OrderId.sanitizeForSpei(result.value);
        expect(sanitized).toBe('ORDER123TEST');
      }
    });
  });

  describe('MAX_LENGTH', () => {
    it('should expose the max length constant', () => {
      expect(OrderId.MAX_LENGTH).toBe(64);
    });
  });
});
