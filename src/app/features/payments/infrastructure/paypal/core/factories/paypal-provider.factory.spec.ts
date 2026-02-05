import { TestBed } from '@angular/core/testing';
import { PaypalRedirectStrategy } from '@app/features/payments/infrastructure/paypal/payment-methods/redirect/strategies/paypal-redirect.strategy';
import {
  createOrderId,
  createPaymentIntentId,
} from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentsInfraConfigInput } from '@payments/infrastructure/config/payments-infra-config.types';
import { providePaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import { PaypalProviderFactory } from '@payments/infrastructure/paypal/core/factories/paypal-provider.factory';
import { PaypalIntentFacade } from '@payments/infrastructure/paypal/workflows/order/order.facade';
import { PaypalFinalizeHandler } from '@payments/infrastructure/paypal/workflows/redirect/handlers/paypal-finalize.handler';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import {
  TEST_PAYMENTS_API_BASE_URL,
  TEST_PAYMENTS_CANCEL_URL,
  TEST_PAYMENTS_RETURN_URL,
} from '@payments/shared/testing/fixtures/test-urls';
import { firstValueFrom, of } from 'rxjs';

describe('PaypalProviderFactory', () => {
  let factory: PaypalProviderFactory;
  const gatewayStub = {
    providerId: PAYMENT_PROVIDER_IDS.paypal,
    createIntent: vi.fn(),
  } satisfies Partial<PaypalIntentFacade>;
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
        PaypalProviderFactory,
        { provide: PaypalIntentFacade, useValue: gatewayStub },
        // Factory now exposes finalize capability via DI; stub is enough for these unit tests.
        {
          provide: PaypalFinalizeHandler,
          useValue: { providerId: PAYMENT_PROVIDER_IDS.paypal, execute: vi.fn() },
        },
        providePaymentsInfraConfig(infraConfigInput),
      ],
    });

    factory = TestBed.inject(PaypalProviderFactory);
  });

  it('creates a PaypalRedirectStrategy when type is card', () => {
    const strategy = factory.createStrategy('card');
    expect(strategy).toBeInstanceOf(PaypalRedirectStrategy);
    expect(strategy.type).toBe('card');
  });

  it('throws for unsupported payment method type', () => {
    expect(() => factory.createStrategy('spei' as any)).toThrow(
      expect.objectContaining({
        code: 'invalid_request',
        messageKey: PAYMENT_ERROR_KEYS.INVALID_REQUEST,
        params: {
          reason: 'unsupported_payment_method',
          supportedMethods: 'card',
        },
      }),
    );
  });

  it('creates a strategy that delegates to the injected gateway', async () => {
    gatewayStub.createIntent = vi.fn(() =>
      of({
        id: createPaymentIntentId('pi_1'),
        provider: PAYMENT_PROVIDER_IDS.paypal,
        status: 'requires_payment_method',
        money: { amount: 100, currency: 'MXN' },
      }),
    );

    const strategy = factory.createStrategy('card');
    const context = {
      returnUrl: TEST_PAYMENTS_RETURN_URL,
      cancelUrl: TEST_PAYMENTS_CANCEL_URL,
      isTest: true,
    };
    const result = await firstValueFrom(
      strategy.start(
        {
          orderId: createOrderId('o1'),
          money: { amount: 100, currency: 'MXN' },
          method: { type: 'card', token: 'tok' },
        },
        context,
      ),
    );

    expect(gatewayStub.createIntent).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe(PAYMENT_PROVIDER_IDS.paypal);
  });

  describe('getFieldRequirements', () => {
    it('returns field requirements for card method', () => {
      const requirements = factory.getFieldRequirements('card');

      expect(requirements.fields).toBeDefined();
      expect(Array.isArray(requirements.fields)).toBe(true);
      expect(requirements.descriptionKey).toBeDefined();
      expect(requirements.instructionsKey).toBeDefined();
      // returnUrl/cancelUrl come from StrategyContext (flow), not from UI fields
      expect(requirements.fields.find((f) => f.name === 'returnUrl')).toBeUndefined();
      expect(requirements.fields.find((f) => f.name === 'cancelUrl')).toBeUndefined();
    });

    it('does not expose returnUrl or cancelUrl as form fields (they come from flow context)', () => {
      const requirements = factory.getFieldRequirements('card');

      expect(requirements.fields.find((f) => f.name === 'returnUrl')).toBeUndefined();
      expect(requirements.fields.find((f) => f.name === 'cancelUrl')).toBeUndefined();
    });

    it('throws for unsupported payment method type', () => {
      expect(() => factory.getFieldRequirements('spei' as any)).toThrow(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: PAYMENT_ERROR_KEYS.INVALID_REQUEST,
          params: {
            reason: 'unsupported_payment_method',
            supportedMethods: 'card',
          },
        }),
      );
    });
  });
});
