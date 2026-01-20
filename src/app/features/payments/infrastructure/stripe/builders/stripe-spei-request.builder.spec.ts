import { StripeSpeiRequestBuilder } from './stripe-spei-request.builder';

describe('StripeSpeiRequestBuilder', () => {
    let builder: StripeSpeiRequestBuilder;

    beforeEach(() => {
        builder = new StripeSpeiRequestBuilder();
    });

    describe('build()', () => {
        it('builds a valid request with all required fields', () => {
            const request = builder
                .forOrder('order_123')
                .withAmount(100, 'MXN')
                .withOptions({ customerEmail: 'test@example.com' })
                .build();

            expect(request.orderId).toBe('order_123');
            expect(request.amount).toBe(100);
            expect(request.currency).toBe('MXN');
            expect(request.method.type).toBe('spei');
            expect(request.customerEmail).toBe('test@example.com');
        });

        it('does not include token in method (SPEI does not use tokens)', () => {
            const request = builder
                .forOrder('order_123')
                .withAmount(100, 'MXN')
                .withOptions({ customerEmail: 'test@example.com' })
                .build();

            expect(request.method.token).toBeUndefined();
        });

        it('ignores token and returnUrl options (not needed for SPEI)', () => {
            const request = builder
                .forOrder('order_123')
                .withAmount(100, 'MXN')
                .withOptions({
                    customerEmail: 'test@example.com',
                    token: 'tok_should_be_ignored',
                    returnUrl: 'https://example.com/return',
                })
                .build();

            expect(request.method.token).toBeUndefined();
            expect(request.returnUrl).toBeUndefined();
        });
    });

    describe('validation', () => {
        it('throws when orderId is missing', () => {
            expect(() =>
                builder
                    .withAmount(100, 'MXN')
                    .withOptions({ customerEmail: 'test@example.com' })
                    .build()
            ).toThrow(/orderId is required/);
        });

        it('throws when amount is missing or invalid', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withOptions({ customerEmail: 'test@example.com' })
                    .build()
            ).toThrow(/amount must be greater than 0/);

            expect(() =>
                builder
                    .forOrder('order_123')
                    .withAmount(0, 'MXN')
                    .withOptions({ customerEmail: 'test@example.com' })
                    .build()
            ).toThrow(/amount must be greater than 0/);
        });

        it('throws when currency is missing', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withAmount(100, undefined as any)
                    .withOptions({ customerEmail: 'test@example.com' })
                    .build()
            ).toThrow(/currency is required/);
        });

        it('throws when customerEmail is missing (SPEI requires email)', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withAmount(100, 'MXN')
                    .build()
            ).toThrow(/require customerEmail/);
        });

        it('throws when customerEmail is invalid format', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withAmount(100, 'MXN')
                    .withOptions({ customerEmail: 'invalid-email' })
                    .build()
            ).toThrow(/valid email address/);
        });
    });

    describe('FIELD_REQUIREMENTS', () => {
        it('defines customerEmail as required email field', () => {
            const emailField = StripeSpeiRequestBuilder.FIELD_REQUIREMENTS.fields
                .find(f => f.name === 'customerEmail');

            expect(emailField).toBeDefined();
            expect(emailField?.required).toBe(true);
            expect(emailField?.type).toBe('email');
        });

        it('includes description and instructions', () => {
            expect(StripeSpeiRequestBuilder.FIELD_REQUIREMENTS.description).toContain('SPEI');
            expect(StripeSpeiRequestBuilder.FIELD_REQUIREMENTS.instructions).toBeDefined();
        });
    });

    describe('fluent interface', () => {
        it('returns this from all setter methods for chaining', () => {
            const result1 = builder.forOrder('order_123');
            const result2 = result1.withAmount(100, 'MXN');
            const result3 = result2.withOptions({ customerEmail: 'test@example.com' });

            expect(result1).toBe(builder);
            expect(result2).toBe(builder);
            expect(result3).toBe(builder);
        });
    });
});
