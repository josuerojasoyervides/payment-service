import { StripeRedirectReturnNormalizer } from '@payments/infrastructure/stripe/workflows/redirect/stripe-redirect-return.normalizer';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

describe('StripeRedirectReturnNormalizer', () => {
  let normalizer: StripeRedirectReturnNormalizer;

  beforeEach(() => {
    normalizer = new StripeRedirectReturnNormalizer();
  });

  it('returns null when no relevant params exist', () => {
    const result = normalizer.normalize({ query: { status: 'ok' } });
    expect(result).toBeNull();
  });

  it('maps payment_intent to referenceId', () => {
    const result = normalizer.normalize({ query: { payment_intent: 'pi_123' } });
    expect(result).toEqual({ providerId: PAYMENT_PROVIDER_IDS.stripe, referenceId: 'pi_123' });
  });

  it('maps setup_intent to referenceId', () => {
    const result = normalizer.normalize({ query: { setup_intent: 'seti_456' } });
    expect(result).toEqual({ providerId: PAYMENT_PROVIDER_IDS.stripe, referenceId: 'seti_456' });
  });

  it('uses last value when payment_intent is repeated', () => {
    const result = normalizer.normalize({
      query: { payment_intent: ['pi_old', 'pi_new'] },
    });
    expect(result).toEqual({ providerId: PAYMENT_PROVIDER_IDS.stripe, referenceId: 'pi_new' });
  });
});
