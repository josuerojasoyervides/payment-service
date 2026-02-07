import { mapStripeGatewayError } from '@app/features/payments/infrastructure/stripe/shared/errors/stripe-gateway-error.mapper';

describe('mapStripeGatewayError', () => {
  it('sanitizes unknown errors (no secrets in raw)', () => {
    const err = {
      token: 'tok_secret',
      clientSecret: 'secret',
      email: 'test@example.com',
    };

    const mapped = mapStripeGatewayError(err, 1_000);

    expect(mapped.code).toBe('provider_error');
    expect(mapped.raw).toEqual({
      provider: 'stripe',
      reason: 'unexpected_error',
    });
  });
});
