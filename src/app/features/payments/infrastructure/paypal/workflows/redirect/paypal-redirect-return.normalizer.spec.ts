import { PaypalRedirectReturnNormalizer } from '@payments/infrastructure/paypal/workflows/redirect/paypal-redirect-return.normalizer';

describe('PaypalRedirectReturnNormalizer', () => {
  let normalizer: PaypalRedirectReturnNormalizer;

  beforeEach(() => {
    normalizer = new PaypalRedirectReturnNormalizer();
  });

  it('returns null when token is missing', () => {
    const result = normalizer.normalize({ query: { status: 'ok' } });
    expect(result).toBeNull();
  });

  it('maps token to referenceId', () => {
    const result = normalizer.normalize({ query: { token: 'ORDER_123' } });
    expect(result).toEqual({ providerId: 'paypal', referenceId: 'ORDER_123' });
  });

  it('uses last value when token is repeated', () => {
    const result = normalizer.normalize({ query: { token: ['first', 'last'] } });
    expect(result).toEqual({ providerId: 'paypal', referenceId: 'last' });
  });
});
