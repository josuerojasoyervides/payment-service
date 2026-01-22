import { TestBed } from '@angular/core/testing';
import { PaypalPaymentGateway } from '../gateways/paypal-payment.gateway';
import { PaypalProviderFactory } from './paypal-provider.factory';
import { PaypalRedirectStrategy } from '../strategies/paypal-redirect.strategy';
import { firstValueFrom, of } from 'rxjs';
import { I18nService } from '@core/i18n';

describe('PaypalProviderFactory', () => {
  let factory: PaypalProviderFactory;
  const gatewayStub = {
    providerId: 'paypal',
    createIntent: vi.fn(),
  } satisfies Partial<PaypalPaymentGateway>;

  beforeEach(() => {
    const i18nMock = {
      t: vi.fn((key: string) => key),
      setLanguage: vi.fn(),
      getLanguage: vi.fn(() => 'es'),
      has: vi.fn(() => true),
      currentLang: { asReadonly: vi.fn() } as any,
    } as any;

    TestBed.configureTestingModule({
      providers: [
        PaypalProviderFactory,
        { provide: PaypalPaymentGateway, useValue: gatewayStub },
        { provide: I18nService, useValue: i18nMock },
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
      /Payment method "spei" is not supported by PayPal/,
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
      expect(requirements.description).toBeDefined();
      expect(requirements.instructions).toBeDefined();

      const returnUrlField = requirements.fields.find((f) => f.name === 'returnUrl');
      expect(returnUrlField).toBeDefined();
      expect(returnUrlField?.required).toBe(true);
      expect(returnUrlField?.type).toBe('hidden');
      // autoFill puede estar definido, pero PaymentFormComponent lo ignora para returnUrl/cancelUrl
      // Estas URLs vienen de StrategyContext, no del formulario
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
        /Payment method "spei" is not supported by PayPal/,
      );
    });
  });
});
