import type { PaymentsInfraConfigInput } from '@payments/infrastructure/config/payments-infra-config.types';
import { buildPaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import { TEST_PAYMENTS_API_BASE_URL } from '@payments/shared/testing/fixtures/test-urls';

describe('buildPaymentsInfraConfig', () => {
  const baseInput: PaymentsInfraConfigInput = {
    paymentsBackendBaseUrl: `${TEST_PAYMENTS_API_BASE_URL}/`,
    timeouts: { stripeMs: 10_000, paypalMs: 12_000 },
    paypal: {
      defaults: {
        brand_name: 'Payment Service',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
      },
    },
    spei: {
      displayConfig: {
        receivingBanks: { STP: 'STP (Transfers and Payments System)' },
        beneficiaryName: 'Payment Service',
      },
    },
  };

  it('derives provider baseUrls and timeouts', () => {
    const config = buildPaymentsInfraConfig(baseInput);

    expect(config.paymentsBackendBaseUrl).toBe(TEST_PAYMENTS_API_BASE_URL);
    expect(config.stripe.baseUrl).toBe(`${TEST_PAYMENTS_API_BASE_URL}/stripe`);
    expect(config.paypal.baseUrl).toBe(`${TEST_PAYMENTS_API_BASE_URL}/paypal`);
    expect(config.stripe.timeoutMs).toBe(10_000);
    expect(config.paypal.timeoutMs).toBe(12_000);
  });

  it('throws when paymentsBackendBaseUrl is empty', () => {
    expect(() =>
      buildPaymentsInfraConfig({
        ...baseInput,
        paymentsBackendBaseUrl: '  ',
      }),
    ).toThrow(/paymentsBackendBaseUrl/);
  });

  it('throws when timeouts are not positive', () => {
    expect(() =>
      buildPaymentsInfraConfig({
        ...baseInput,
        timeouts: { stripeMs: 0, paypalMs: 1000 },
      }),
    ).toThrow(/timeouts\.stripeMs/);
  });

  it('throws when PayPal defaults are invalid', () => {
    const invalidLandingPage =
      'INVALID' as unknown as PaymentsInfraConfigInput['paypal']['defaults']['landing_page'];

    expect(() =>
      buildPaymentsInfraConfig({
        ...baseInput,
        paypal: {
          defaults: {
            brand_name: 'Payment Service',
            landing_page: invalidLandingPage,
            user_action: 'PAY_NOW',
          },
        },
      }),
    ).toThrow(/paypal\.defaults\.landing_page/);
  });

  it('throws when SPEI display config is invalid', () => {
    expect(() =>
      buildPaymentsInfraConfig({
        ...baseInput,
        spei: {
          displayConfig: {
            receivingBanks: {},
            beneficiaryName: 'Payment Service',
          },
        },
      }),
    ).toThrow(/spei\.displayConfig\.receivingBanks/);
  });
});
