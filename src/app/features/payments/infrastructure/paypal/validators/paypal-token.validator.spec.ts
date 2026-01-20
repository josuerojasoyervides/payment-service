import { PaypalTokenValidator } from './paypal-token.validator';

describe('PaypalTokenValidator', () => {
    let validator: PaypalTokenValidator;

    beforeEach(() => {
        validator = new PaypalTokenValidator();
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
