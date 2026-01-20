import { StripeCardRequestBuilder } from './stripe-card-request.builder';

describe('StripeCardRequestBuilder', () => {
    let builder: StripeCardRequestBuilder;

    beforeEach(() => {
        builder = new StripeCardRequestBuilder();
    });

    describe('build()', () => {
        it('builds a valid request with all required fields', () => {
            const request = builder
                .forOrder('order_123')
                .withAmount(100, 'MXN')
                .withOptions({ token: 'tok_test1234567890abc' })
                .build();

            expect(request.orderId).toBe('order_123');
            expect(request.amount).toBe(100);
            expect(request.currency).toBe('MXN');
            expect(request.method.type).toBe('card');
            expect(request.method.token).toBe('tok_test1234567890abc');
        });

        it('includes saveForFuture in metadata when provided', () => {
            const request = builder
                .forOrder('order_123')
                .withAmount(100, 'MXN')
                .withOptions({ token: 'tok_test1234567890abc', saveForFuture: true })
                .build();

            expect(request.metadata?.['saveForFuture']).toBe(true);
        });

        it('ignores returnUrl and cancelUrl (not needed for Stripe Card)', () => {
            const request = builder
                .forOrder('order_123')
                .withAmount(100, 'MXN')
                .withOptions({
                    token: 'tok_test1234567890abc',
                    returnUrl: 'https://example.com/return',
                    cancelUrl: 'https://example.com/cancel',
                })
                .build();

            expect(request.returnUrl).toBeUndefined();
            expect(request.cancelUrl).toBeUndefined();
        });
    });

    describe('validation', () => {
        it('throws when orderId is missing', () => {
            expect(() =>
                builder
                    .withAmount(100, 'MXN')
                    .withOptions({ token: 'tok_test1234567890abc' })
                    .build()
            ).toThrow(/orderId is required/);
        });

        it('throws when amount is missing', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withOptions({ token: 'tok_test1234567890abc' })
                    .build()
            ).toThrow(/amount must be greater than 0/);
        });

        it('throws when amount is zero', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withAmount(0, 'MXN')
                    .withOptions({ token: 'tok_test1234567890abc' })
                    .build()
            ).toThrow(/amount must be greater than 0/);
        });

        it('throws when amount is negative', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withAmount(-100, 'MXN')
                    .withOptions({ token: 'tok_test1234567890abc' })
                    .build()
            ).toThrow(/amount must be greater than 0/);
        });

        it('throws when currency is missing', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withAmount(100, undefined as any)
                    .withOptions({ token: 'tok_test1234567890abc' })
                    .build()
            ).toThrow(/currency is required/);
        });

        it('throws when token is missing (Stripe Card requires token)', () => {
            expect(() =>
                builder
                    .forOrder('order_123')
                    .withAmount(100, 'MXN')
                    .build()
            ).toThrow(/require a token/);
        });
    });

    describe('FIELD_REQUIREMENTS', () => {
        it('defines token as required hidden field', () => {
            const tokenField = StripeCardRequestBuilder.FIELD_REQUIREMENTS.fields
                .find(f => f.name === 'token');

            expect(tokenField).toBeDefined();
            expect(tokenField?.required).toBe(true);
            expect(tokenField?.type).toBe('hidden');
        });

        it('defines saveForFuture as optional field', () => {
            const saveField = StripeCardRequestBuilder.FIELD_REQUIREMENTS.fields
                .find(f => f.name === 'saveForFuture');

            expect(saveField).toBeDefined();
            expect(saveField?.required).toBe(false);
        });

        it('includes description and instructions', () => {
            expect(StripeCardRequestBuilder.FIELD_REQUIREMENTS.description).toBeDefined();
            expect(StripeCardRequestBuilder.FIELD_REQUIREMENTS.instructions).toBeDefined();
        });
    });

    describe('fluent interface', () => {
        it('returns this from all setter methods for chaining', () => {
            const result1 = builder.forOrder('order_123');
            const result2 = result1.withAmount(100, 'MXN');
            const result3 = result2.withOptions({ token: 'tok_test1234567890abc' });

            expect(result1).toBe(builder);
            expect(result2).toBe(builder);
            expect(result3).toBe(builder);
        });
    });
});
