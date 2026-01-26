import { TestBed } from '@angular/core/testing';
import { I18nKeys } from '@core/i18n';
import { firstValueFrom, of } from 'rxjs';

import { PaypalIntentFacade } from '../facades/intent.facade';
import { PaypalRedirectStrategy } from '../strategies/paypal-redirect.strategy';
import { PaypalProviderFactory } from './paypal-provider.factory';

describe('PaypalProviderFactory', () => {
  let factory: PaypalProviderFactory;
  const gatewayStub = {
    providerId: 'paypal',
    createIntent: vi.fn(),
  } satisfies Partial<PaypalIntentFacade>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PaypalProviderFactory, { provide: PaypalIntentFacade, useValue: gatewayStub }],
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
        messageKey: I18nKeys.errors.invalid_request,
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
        id: 'pi_1',
        provider: 'paypal',
        status: 'requires_payment_method',
        amount: 100,
        currency: 'MXN',
      }),
    );

    const strategy = factory.createStrategy('card');
    const context = {
      returnUrl: 'https://example.com/payments/return',
      cancelUrl: 'https://example.com/payments/cancel',
      isTest: true,
    };
    const result = await firstValueFrom(
      strategy.start(
        {
          orderId: 'o1',
          amount: 100,
          currency: 'MXN',
          method: { type: 'card', token: 'tok' },
        },
        context,
      ),
    );

    expect(gatewayStub.createIntent).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('paypal');
  });

  describe('getFieldRequirements', () => {
    it('returns field requirements for card method', () => {
      const requirements = factory.getFieldRequirements('card');

      expect(requirements.fields).toBeDefined();
      expect(requirements.fields.length).toBeGreaterThan(0);
      expect(requirements.descriptionKey).toBeDefined();
      expect(requirements.instructionsKey).toBeDefined();

      const returnUrlField = requirements.fields.find((f) => f.name === 'returnUrl');
      expect(returnUrlField).toBeDefined();
      expect(returnUrlField?.required).toBe(true);
      expect(returnUrlField?.type).toBe('hidden');
      // autoFill can be set, but PaymentFormComponent ignores it for returnUrl/cancelUrl
      // These URLs come from StrategyContext, not from the form
    });

    it('includes cancelUrl as optional field', () => {
      const requirements = factory.getFieldRequirements('card');

      const cancelUrlField = requirements.fields.find((f) => f.name === 'cancelUrl');
      expect(cancelUrlField).toBeDefined();
      expect(cancelUrlField?.required).toBe(false);
      expect(cancelUrlField?.type).toBe('hidden');
    });

    it('throws for unsupported payment method type', () => {
      expect(() => factory.getFieldRequirements('spei' as any)).toThrow(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.invalid_request,
          params: {
            reason: 'unsupported_payment_method',
            supportedMethods: 'card',
          },
        }),
      );
    });
  });
});
