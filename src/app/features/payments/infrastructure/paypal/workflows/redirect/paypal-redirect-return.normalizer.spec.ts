import { PaypalRedirectReturnNormalizer } from '@payments/infrastructure/paypal/workflows/redirect/paypal-redirect-return.normalizer';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

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
    expect(result).toEqual({ providerId: PAYMENT_PROVIDER_IDS.paypal, referenceId: 'ORDER_123' });
  });

  it('uses last value when token is repeated', () => {
    const result = normalizer.normalize({ query: { token: ['first', 'last'] } });
    expect(result).toEqual({ providerId: PAYMENT_PROVIDER_IDS.paypal, referenceId: 'last' });
  });

  it('returns null for invalid payloads', () => {
    const result = normalizer.normalize({} as never);
    expect(result).toBeNull();
  });
});
