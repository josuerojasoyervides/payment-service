import {
  getSpeiLimitsMxn,
  SPEI_MAX_AMOUNT_MXN,
  SPEI_MIN_AMOUNT_MXN,
  validateSpeiAmount,
} from './spei-amount.rule';

describe('spei-amount.rule', () => {
  describe('SPEI_MIN_AMOUNT_MXN / SPEI_MAX_AMOUNT_MXN', () => {
    it('exports correct limits', () => {
      expect(SPEI_MIN_AMOUNT_MXN).toBe(1);
      expect(SPEI_MAX_AMOUNT_MXN).toBe(8_000_000);
    });
  });

  describe('getSpeiLimitsMxn()', () => {
    it('returns min and max', () => {
      expect(getSpeiLimitsMxn()).toEqual({ min: 1, max: 8_000_000 });
    });
  });

  describe('validateSpeiAmount()', () => {
    it('returns no violations for valid MXN amount', () => {
      expect(validateSpeiAmount({ amount: 100, currency: 'MXN' })).toEqual([]);
      expect(validateSpeiAmount({ amount: 1, currency: 'MXN' })).toEqual([]);
      expect(validateSpeiAmount({ amount: 8_000_000, currency: 'MXN' })).toEqual([]);
    });

    it('returns SPEI_INVALID_CURRENCY for non-MXN', () => {
      const violations = validateSpeiAmount({ amount: 100, currency: 'USD' });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toEqual({
        code: 'SPEI_INVALID_CURRENCY',
        meta: { currency: 'USD' },
      });
    });

    it('returns SPEI_AMOUNT_TOO_LOW for amount below min', () => {
      const violations = validateSpeiAmount({ amount: 0.5, currency: 'MXN' });
      expect(violations).toHaveLength(1);
      expect(violations[0].code).toBe('SPEI_AMOUNT_TOO_LOW');
      expect(violations[0].meta).toMatchObject({
        amount: 0.5,
        currency: 'MXN',
        min: 1,
      });
    });

    it('returns SPEI_AMOUNT_TOO_HIGH for amount above max', () => {
      const violations = validateSpeiAmount({ amount: 10_000_000, currency: 'MXN' });
      expect(violations).toHaveLength(1);
      expect(violations[0].code).toBe('SPEI_AMOUNT_TOO_HIGH');
      expect(violations[0].meta).toMatchObject({
        amount: 10_000_000,
        currency: 'MXN',
        max: 8_000_000,
      });
    });

    it('returns both violations when amount is 0 (below min)', () => {
      const violations = validateSpeiAmount({ amount: 0, currency: 'MXN' });
      expect(violations).toHaveLength(1);
      expect(violations[0].code).toBe('SPEI_AMOUNT_TOO_LOW');
    });
  });
});
