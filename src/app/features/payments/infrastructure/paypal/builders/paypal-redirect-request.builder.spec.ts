import { PaypalRedirectRequestBuilder } from './paypal-redirect-request.builder';

describe('PaypalRedirectRequestBuilder', () => {
    let builder: PaypalRedirectRequestBuilder;

    beforeEach(() => {
        builder = new PaypalRedirectRequestBuilder();
    });

    describe('build()', () => {
        it('builds a valid request with all required fields', () => {
            const request = builder
                .forOrder('order_123')
                .withAmount(100, 'MXN')
                .withOptions({ returnUrl: 'https://example.com/return' })
                .build();

            expect(request.orderId).toBe('order_123');
            expect(request.amount).toBe(100);
            expect(request.currency).toBe('MXN');
            expect(request.method.type).toBe('card');
            expect(request.returnUrl).toBe('https://example.com/return');
        });

        it('uses returnUrl as default cancelUrl when cancelUrl not provided', () => {
            const request = builder
                .forOrder('order_123')
                .withAmount(100, 'MXN')
                .withOptions({ returnUrl: 'https://example.com/return' })
                .build();

            expect(request.cancelUrl).toBe('https://example.com/return');
        });

        it('uses provided cancelUrl when specified', () => {
            const request = builder
                .forOrder('order_123')
                .withAmount(100, 'MXN')
                .withOptions({
                    returnUrl: 'https://example.com/return',
                    cancelUrl: 'https://example.com/cancel',
                })
                .build();

            expect(request.returnUrl).toBe('https://example.com/return');
            expect(request.cancelUrl).toBe('https://example.com/cancel');
        });

        it('does not include token in method (PayPal uses redirect)', () => {
            const request = builder
                .forOrder('order_123')
                .withAmount(100, 'MXN')
                .withOptions({ returnUrl: 'https://example.com/return' })
                .build();

            expect(request.method.token).toBeUndefined();
        });

        it('ignores token option (PayPal does not use client-side tokens)', () => {
            const request = builder
                .forOrder('order_123')
                .withAmount(100, 'MXN')
                .withOptions({
                    returnUrl: 'https://example.com/return',
                    token: 'tok_should_be_ignored',
                })
                .build();

            expect(request.method.token).toBeUndefined();
        });
    });

    describe('validation', () => {
        it('throws when orderId is missing', () => {
            expect(() =>
                builder
                    .withAmount(100, 'MXN')
                    .withOptions({ returnUrl: 'https://example.com/return' })
                    .build()
            ).toThrow(/orderId is required/);
        });

        it('throws when amount is missing or invalid', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withOptions({ returnUrl: 'https://example.com/return' })
                    .build()
            ).toThrow(/amount must be greater than 0/);

            expect(() =>
                builder
                    .forOrder('order_123')
                    .withAmount(-50, 'MXN')
                    .withOptions({ returnUrl: 'https://example.com/return' })
                    .build()
            ).toThrow(/amount must be greater than 0/);
        });

        it('throws when currency is missing', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withAmount(100, undefined as any)
                    .withOptions({ returnUrl: 'https://example.com/return' })
                    .build()
            ).toThrow(/currency is required/);
        });

        it('throws when returnUrl is missing (PayPal requires redirect URL)', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withAmount(100, 'MXN')
                    .build()
            ).toThrow(/require returnUrl/);
        });

        it('throws when returnUrl is not a valid URL', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withAmount(100, 'MXN')
                    .withOptions({ returnUrl: 'not-a-valid-url' })
                    .build()
            ).toThrow(/valid URL/);
        });

        it('throws when cancelUrl is not a valid URL', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withAmount(100, 'MXN')
                    .withOptions({
                        returnUrl: 'https://example.com/return',
                        cancelUrl: 'not-a-valid-url',
                    })
                    .build()
            ).toThrow(/cancelUrl must be a valid URL/);
        });
    });

    // Nota: FIELD_REQUIREMENTS ahora está en PaypalProviderFactory.getFieldRequirements()
    // Los tests de field requirements deben estar en paypal-provider.factory.spec.ts

    describe('fluent interface', () => {
        it('returns this from all setter methods for chaining', () => {
            const result1 = builder.forOrder('order_123');
            const result2 = result1.withAmount(100, 'MXN');
            const result3 = result2.withOptions({ returnUrl: 'https://example.com' });

            expect(result1).toBe(builder);
            expect(result2).toBe(builder);
            expect(result3).toBe(builder);
        });
    });
});
