import { PaypalRedirectRequestBuilder } from './paypal-redirect-request.builder';

function expectSyncPaymentError(fn: () => unknown, expected: any) {
  try {
    fn();
    throw new Error('Expected to throw PaymentError');
  } catch (e) {
    expect(e).toMatchObject(expected);
  }
}

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
    it('throws PaymentError when orderId is missing', () => {
      expectSyncPaymentError(
        () =>
          builder
            .withAmount(100, 'MXN')
            .withOptions({ returnUrl: 'https://example.com/return' })
            .build(),
        {
          code: 'invalid_request',
          messageKey: 'errors.order_id_required',
          params: { field: 'orderId' },
        },
      );
    });

    it('throws PaymentError when amount is missing or invalid', () => {
      expectSyncPaymentError(
        () =>
          builder
            .forOrder('order_123')
            .withAmount(0 as any, 'MXN')
            .withOptions({ returnUrl: 'https://example.com/return' })
            .build(),
        {
          code: 'invalid_request',
          messageKey: 'errors.amount_invalid',
          params: { field: 'amount' },
        },
      );
    });

    it('throws PaymentError when currency is missing', () => {
      expectSyncPaymentError(
        () =>
          builder
            .forOrder('order_123')
            .withAmount(100, undefined as any)
            .withOptions({ returnUrl: 'https://example.com/return' })
            .build(),
        {
          code: 'invalid_request',
          messageKey: 'errors.currency_required',
          params: { field: 'currency' },
        },
      );
    });

    it('allows building without returnUrl (can come from StrategyContext)', () => {
      // returnUrl es opcional en el builder - puede venir de StrategyContext
      const request = builder.forOrder('order_123').withAmount(100, 'MXN').build();

      expect(request.orderId).toBe('order_123');
      expect(request.amount).toBe(100);
      expect(request.returnUrl).toBeUndefined();
    });

    it('throws PaymentError when returnUrl is not a valid URL', () => {
      expectSyncPaymentError(
        () =>
          builder
            .forOrder('order_123')
            .withAmount(100, 'MXN')
            .withOptions({ returnUrl: 'not-a-valid-url' })
            .build(),
        {
          code: 'invalid_request',
          messageKey: 'errors.return_url_invalid',
          params: { field: 'returnUrl' },
          // raw está en null porque invalidRequestError no lo está recibiendo en este caso
          raw: null,
        },
      );
    });

    it('throws PaymentError when cancelUrl is not a valid URL', () => {
      expectSyncPaymentError(
        () =>
          builder
            .forOrder('order_123')
            .withAmount(100, 'MXN')
            .withOptions({
              returnUrl: 'https://example.com/return',
              cancelUrl: 'not-a-valid-url',
            })
            .build(),
        {
          code: 'invalid_request',
          messageKey: 'errors.cancel_url_invalid',
          params: { field: 'cancelUrl' },
          raw: null,
        },
      );
    });
  });

  // NOTE: FIELD_REQUIREMENTS is now in PaypalProviderFactory.getFieldRequirements()
  // Field requirements tests should be in paypal-provider.factory.spec.ts

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
