import { getCardMinAmount, validateCardAmount } from './min-amount-by-currency.rule';

describe('min-amount-by-currency.rule', () => {
  describe('getCardMinAmount()', () => {
    it('returns 10 for MXN', () => {
      expect(getCardMinAmount('MXN')).toBe(10);
    });

    it('returns 1 for USD', () => {
      expect(getCardMinAmount('USD')).toBe(1);
    });
  });

  describe('validateCardAmount()', () => {
    it('returns no violations for valid amounts', () => {
      expect(validateCardAmount({ amount: 100, currency: 'MXN' })).toEqual([]);
      expect(validateCardAmount({ amount: 10, currency: 'MXN' })).toEqual([]);
      expect(validateCardAmount({ amount: 1, currency: 'USD' })).toEqual([]);
      expect(validateCardAmount({ amount: 50, currency: 'USD' })).toEqual([]);
    });

    it('returns CARD_AMOUNT_TOO_LOW for MXN below 10', () => {
      const violations = validateCardAmount({ amount: 5, currency: 'MXN' });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toEqual({
        code: 'CARD_AMOUNT_TOO_LOW',
        meta: { amount: 5, currency: 'MXN', min: 10 },
      });
    });

    it('returns CARD_AMOUNT_TOO_LOW for USD below 1', () => {
      const violations = validateCardAmount({ amount: 0.5, currency: 'USD' });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toEqual({
        code: 'CARD_AMOUNT_TOO_LOW',
        meta: { amount: 0.5, currency: 'USD', min: 1 },
      });
    });
  });
});
