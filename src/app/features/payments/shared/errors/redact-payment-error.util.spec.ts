import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';

import { redactPaymentError } from './redact-payment-error.util';

describe('redactPaymentError', () => {
  it('redacts sensitive keys from raw', () => {
    const error: PaymentError = {
      code: 'provider_error',
      messageKey: 'errors.provider_error',
      raw: {
        token: 'tok_123',
        cardNumber: '4111111111111111',
        nested: { clientSecret: 'secret_123' },
      },
    };

    const result = redactPaymentError(error, []);

    expect(result?.raw).toEqual({
      token: '[REDACTED]',
      cardNumber: '[REDACTED]',
      nested: { clientSecret: '[REDACTED]' },
    });
  });

  it('redacts injectable PII fields', () => {
    const error: PaymentError = {
      code: 'provider_error',
      messageKey: 'errors.provider_error',
      raw: {
        customerEmail: 'test@example.com',
        metadata: { phone: '555-1234' },
      },
    };

    const result = redactPaymentError(error, ['customerEmail', 'phone']);

    expect(result?.raw).toEqual({
      customerEmail: '[REDACTED]',
      metadata: { phone: '[REDACTED]' },
    });
  });

  it('returns null when error is null', () => {
    expect(redactPaymentError(null, ['email'])).toBeNull();
  });
});
