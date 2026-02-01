import {
  formatSpeiPaymentConcept,
  generateSpeiReference,
  SPEI_CONCEPT_MAX_LENGTH,
  SPEI_REFERENCE_LENGTH,
} from './spei-concept.rule';

describe('spei-concept.rule', () => {
  describe('SPEI_CONCEPT_MAX_LENGTH', () => {
    it('is 40', () => {
      expect(SPEI_CONCEPT_MAX_LENGTH).toBe(40);
    });
  });

  describe('formatSpeiPaymentConcept()', () => {
    it('returns prefixed concept with sanitized orderId', () => {
      expect(formatSpeiPaymentConcept('order_123')).toBe('PAGO ORDER123');
    });

    it('removes non-alphanumeric characters', () => {
      expect(formatSpeiPaymentConcept('order-456!@#')).toBe('PAGO ORDER456');
    });

    it('uppercases the orderId part', () => {
      expect(formatSpeiPaymentConcept('abc123')).toBe('PAGO ABC123');
    });

    it('truncates to max length', () => {
      const longOrderId = 'A'.repeat(50);
      const result = formatSpeiPaymentConcept(longOrderId);
      expect(result).toHaveLength(SPEI_CONCEPT_MAX_LENGTH);
      expect(result).toBe(`PAGO ${'A'.repeat(35)}`);
    });

    it('handles empty orderId', () => {
      expect(formatSpeiPaymentConcept('')).toBe('PAGO ');
    });
  });

  describe('generateSpeiReference()', () => {
    it('returns 7-digit string', () => {
      const ref = generateSpeiReference('order_123');
      expect(ref).toHaveLength(SPEI_REFERENCE_LENGTH);
      expect(ref).toMatch(/^\d{7}$/);
    });

    it('is deterministic for same orderId', () => {
      expect(generateSpeiReference('order_1')).toBe(generateSpeiReference('order_1'));
    });

    it('differs for different orderIds', () => {
      expect(generateSpeiReference('order_1')).not.toBe(generateSpeiReference('order_2'));
    });

    it('is zero-padded when hash is small', () => {
      const ref = generateSpeiReference('a');
      expect(ref).toHaveLength(7);
      expect(ref).toMatch(/^\d+$/);
    });
  });
});
