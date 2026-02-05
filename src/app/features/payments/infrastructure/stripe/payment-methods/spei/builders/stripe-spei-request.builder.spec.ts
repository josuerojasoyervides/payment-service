import { I18nKeys } from '@core/i18n';
import { StripeSpeiRequestBuilder } from '@payments/infrastructure/stripe/payment-methods/spei/builders/stripe-spei-request.builder';
import { TEST_RETURN_URL } from '@payments/shared/testing/fixtures/test-urls';

export function expectSyncPaymentError(fn: () => unknown, expected: any) {
  try {
    fn();
    expect.fail('Expected to throw PaymentError');
  } catch (e) {
    // ensure minimum shape (avoid TypeError)
    expect(e).toMatchObject({
      code: expect.any(String),
      messageKey: expect.any(String),
      params: expect.any(Object),
    });

    expect(e).toMatchObject(expected);
  }
}

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

      expect(request.orderId.value).toBe('order_123');
      expect(request.money.amount).toBe(100);
      expect(request.money.currency).toBe('MXN');
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
          returnUrl: TEST_RETURN_URL,
        })
        .build();

      expect(request.method.token).toBeUndefined();
      expect(request.returnUrl).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('throws PaymentError when orderId is missing', () => {
      expectSyncPaymentError(
        () =>
          builder.withAmount(100, 'MXN').withOptions({ customerEmail: 'test@example.com' }).build(),
        {
          code: 'invalid_request',
          messageKey: I18nKeys.errors.order_id_required,
          params: { field: 'orderId' },
        },
      );
    });

    it('throws PaymentError when amount is missing or invalid', () => {
      // amount missing (undefined) - currency also missing, so currency_required throws first
      expectSyncPaymentError(
        () =>
          builder.forOrder('order_123').withOptions({ customerEmail: 'test@example.com' }).build(),
        {
          code: 'invalid_request',
          messageKey: I18nKeys.errors.currency_required,
          params: { field: 'currency' },
        },
      );

      // amount invalid (0) with valid currency
      expectSyncPaymentError(
        () =>
          builder
            .forOrder('order_123')
            .withAmount(0, 'MXN')
            .withOptions({ customerEmail: 'test@example.com' })
            .build(),
        {
          code: 'invalid_request',
          messageKey: I18nKeys.errors.amount_invalid,
          params: { field: 'amount', min: 1 },
          raw: { amount: 0 },
        },
      );
    });

    it('throws PaymentError when currency is missing', () => {
      expectSyncPaymentError(
        () =>
          builder
            .forOrder('order_123')
            .withAmount(100, undefined as any)
            .withOptions({ customerEmail: 'test@example.com' })
            .build(),
        {
          code: 'invalid_request',
          messageKey: I18nKeys.errors.currency_required,
          params: { field: 'currency' },
        },
      );
    });

    it('throws PaymentError when customerEmail is missing (SPEI requires email)', () => {
      expectSyncPaymentError(() => builder.forOrder('order_123').withAmount(100, 'MXN').build(), {
        code: 'invalid_request',
        messageKey: I18nKeys.errors.customer_email_required,
        params: { field: 'customerEmail' },
      });
    });

    it('throws PaymentError when customerEmail is invalid format', () => {
      expectSyncPaymentError(
        () =>
          builder
            .forOrder('order_123')
            .withAmount(100, 'MXN')
            .withOptions({ customerEmail: 'invalid-email' })
            .build(),
        {
          code: 'invalid_request',
          messageKey: I18nKeys.errors.customer_email_invalid,
          params: { field: 'customerEmail' },
          raw: { customerEmail: 'invalid-email' },
        },
      );
    });
  });

  // NOTE: FIELD_REQUIREMENTS is now in StripeProviderFactory.getFieldRequirements()
  // Field requirements tests should be in stripe-provider.factory.spec.ts

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
