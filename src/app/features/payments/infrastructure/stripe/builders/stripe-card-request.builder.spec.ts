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
    it('throws PaymentError when orderId is missing', () => {
      try {
        builder.withAmount(100, 'MXN').build();
        throw new Error('Expected builder.build() to throw');
      } catch (e) {
        expect(e).toMatchObject({
          code: 'invalid_request',
          messageKey: 'errors.order_id_required',
          params: { field: 'orderId' },
        });
      }
    });

    it('throws PaymentError when amount is missing or invalid', () => {
      try {
        builder
          .forOrder('order_123')
          .withAmount(0 as any, 'MXN')
          .build();
        throw new Error('Expected builder.build() to throw');
      } catch (e) {
        expect(e).toMatchObject({
          code: 'invalid_request',
          messageKey: 'errors.amount_invalid',
          params: { field: 'amount' },
        });
      }
    });

    it('throws PaymentError when amount is zero', () => {
      try {
        builder
          .forOrder('order_123')
          .withAmount(0, 'MXN')
          .withOptions({ token: 'tok_test1234567890abc' })
          .build();

        throw new Error('Expected builder.build() to throw');
      } catch (e) {
        expect(e).toMatchObject({
          code: 'invalid_request',
          messageKey: 'errors.amount_invalid',
          params: { field: 'amount', min: 1 },
          raw: { amount: 0 },
        });
      }
    });

    it('throws PaymentError when amount is negative', () => {
      try {
        builder
          .forOrder('order_123')
          .withAmount(-100, 'MXN')
          .withOptions({ token: 'tok_test1234567890abc' })
          .build();

        throw new Error('Expected builder.build() to throw');
      } catch (e) {
        expect(e).toMatchObject({
          code: 'invalid_request',
          messageKey: 'errors.amount_invalid',
          params: { field: 'amount', min: 1 },
          raw: { amount: -100 },
        });
      }
    });

    it('throws PaymentError when currency is missing', () => {
      try {
        builder
          .forOrder('order_123')
          .withAmount(100, undefined as any)
          .withOptions({ token: 'tok_test1234567890abc' })
          .build();

        throw new Error('Expected builder.build() to throw');
      } catch (e) {
        expect(e).toMatchObject({
          code: 'invalid_request',
          messageKey: 'errors.currency_required',
          params: { field: 'currency' },
        });
      }
    });

    it('throws PaymentError when token is missing (Stripe Card requires token)', () => {
      try {
        builder.forOrder('order_123').withAmount(100, 'MXN').build();
        throw new Error('Expected builder.build() to throw');
      } catch (e) {
        expect(e).toMatchObject({
          code: 'invalid_request',
          messageKey: 'errors.card_token_required',
          params: { field: 'method.token' },
        });
      }
    });
  });

  // NOTE: FIELD_REQUIREMENTS is now in StripeProviderFactory.getFieldRequirements()
  // Field requirements tests should be in stripe-provider.factory.spec.ts

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
