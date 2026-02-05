import { TestBed } from '@angular/core/testing';
import { StripeProviderFactory } from '@app/features/payments/infrastructure/stripe/core/factories/stripe-provider.factory';
import { StripeIntentFacade } from '@app/features/payments/infrastructure/stripe/workflows/intent/intent.facade';
import { I18nKeys } from '@core/i18n';
import {
  createOrderId,
  createPaymentIntentId,
} from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentsInfraConfigInput } from '@payments/infrastructure/config/payments-infra-config.types';
import { providePaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { CardStrategy } from '@payments/shared/strategies/card-strategy';
import { SpeiStrategy } from '@payments/shared/strategies/spei-strategy';
import { TEST_PAYMENTS_API_BASE_URL } from '@payments/shared/testing/fixtures/test-urls';
import { firstValueFrom, of } from 'rxjs';

describe('StripeProviderFactory', () => {
  let factory: StripeProviderFactory;

  const gatewayStub = {
    providerId: PAYMENT_PROVIDER_IDS.stripe,
    createIntent: vi.fn(),
  } satisfies Partial<StripeIntentFacade>;
  const infraConfigInput: PaymentsInfraConfigInput = {
    paymentsBackendBaseUrl: TEST_PAYMENTS_API_BASE_URL,
    timeouts: { stripeMs: 15_000, paypalMs: 15_000 },
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StripeProviderFactory,
        { provide: StripeIntentFacade, useValue: gatewayStub },
        providePaymentsInfraConfig(infraConfigInput),
      ],
    });

    factory = TestBed.inject(StripeProviderFactory);
  });

  it('creates a CardStrategy when type is card', () => {
    const strategy = factory.createStrategy('card');
    expect(strategy).toBeInstanceOf(CardStrategy);
    expect(strategy.type).toBe('card');
  });

  it('creates a SpeiStrategy when type is spei', () => {
    const strategy = factory.createStrategy('spei');
    expect(strategy).toBeInstanceOf(SpeiStrategy);
    expect(strategy.type).toBe('spei');
  });

  it('throws for unsupported payment method type', () => {
    expect(() => factory.createStrategy('unsupported' as any)).toThrow(
      expect.objectContaining({
        code: 'invalid_request',
        messageKey: I18nKeys.errors.invalid_request,
        params: {
          reason: 'unsupported_payment_method',
          supportedMethods: 'card, spei',
        },
      }),
    );
  });

  it('creates a strategy that delegates to the injected gateway', async () => {
    gatewayStub.createIntent = vi.fn(() =>
      of({
        id: createPaymentIntentId('pi_1'),
        provider: PAYMENT_PROVIDER_IDS.stripe,
        status: 'requires_payment_method',
        money: { amount: 100, currency: 'MXN' },
      }),
    );

    const strategy = factory.createStrategy('card');
    const result = await firstValueFrom(
      strategy.start({
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_test1234567890abc' },
      }),
    );

    expect(gatewayStub.createIntent).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe(PAYMENT_PROVIDER_IDS.stripe);
  });

  describe('getFieldRequirements', () => {
    it('returns field requirements for card method', () => {
      const requirements = factory.getFieldRequirements('card');

      expect(requirements.fields).toBeDefined();
      expect(requirements.fields.length).toBeGreaterThan(0);
      expect(requirements.descriptionKey).toBeDefined();
      expect(requirements.instructionsKey).toBeDefined();

      const tokenField = requirements.fields.find((f) => f.name === 'token');
      expect(tokenField).toBeDefined();
      expect(tokenField?.required).toBe(true);
      expect(tokenField?.type).toBe('hidden');
    });

    it('returns field requirements for spei method', () => {
      const requirements = factory.getFieldRequirements('spei');

      expect(requirements.fields).toBeDefined();
      expect(requirements.fields.length).toBeGreaterThan(0);
      expect(requirements.descriptionKey).toBeDefined();
      expect(requirements.instructionsKey).toBeDefined();

      const emailField = requirements.fields.find((f) => f.name === 'customerEmail');
      expect(emailField).toBeDefined();
      expect(emailField?.required).toBe(true);
      expect(emailField?.type).toBe('email');
    });

    it('throws for unsupported payment method type', () => {
      expect(() => factory.getFieldRequirements('unsupported' as any)).toThrow(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.invalid_request,
          params: {
            reason: 'unsupported_payment_method',
            supportedMethods: 'card, spei',
          },
        }),
      );
    });
  });
});
