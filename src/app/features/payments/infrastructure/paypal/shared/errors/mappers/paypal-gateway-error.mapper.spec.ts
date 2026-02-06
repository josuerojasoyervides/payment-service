import { mapPaypalGatewayError } from '@app/features/payments/infrastructure/paypal/shared/errors/mappers/paypal-gateway-error.mapper';

describe('mapPaypalGatewayError', () => {
  it('sanitizes unknown errors (no secrets in raw)', () => {
    const err = {
      token: 'tok_secret',
      clientSecret: 'secret',
      email: 'test@example.com',
    };

    const mapped = mapPaypalGatewayError(err, 1_000);

    expect(mapped.code).toBe('provider_error');
    expect(mapped.raw).toEqual({
      provider: 'paypal',
      reason: 'unexpected_error',
    });
  });
});
