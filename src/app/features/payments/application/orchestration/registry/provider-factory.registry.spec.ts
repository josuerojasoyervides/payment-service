import { TestBed } from '@angular/core/testing';
import { PaymentMethodType } from '@payments/domain/models/payment/payment-intent.types';

import { ProviderFactory } from '../../api/ports/provider-factory.port';
import { PAYMENT_PROVIDER_FACTORIES } from '../../api/tokens/payment-provider-factories.token';
import { ProviderFactoryRegistry } from './provider-factory.registry';

describe('ProviderFactoryRegistry', () => {
  let registry: ProviderFactoryRegistry;

  const stripeFactoryMock: ProviderFactory = {
    providerId: 'stripe',
    getGateway: vi.fn(),
    createStrategy: vi.fn(),
    supportsMethod: vi.fn(() => true),
    getSupportedMethods: vi.fn((): PaymentMethodType[] => ['card', 'spei']),
    createRequestBuilder: vi.fn(),
    getFieldRequirements: vi.fn(() => ({ fields: [] })),
  };

  const paypalFactoryMock: ProviderFactory = {
    providerId: 'paypal',
    getGateway: vi.fn(),
    createStrategy: vi.fn(),
    supportsMethod: vi.fn((type) => type === 'card'),
    getSupportedMethods: vi.fn((): PaymentMethodType[] => ['card']),
    createRequestBuilder: vi.fn(),
    getFieldRequirements: vi.fn(() => ({ fields: [] })),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProviderFactoryRegistry,
        { provide: PAYMENT_PROVIDER_FACTORIES, useValue: stripeFactoryMock, multi: true },
        { provide: PAYMENT_PROVIDER_FACTORIES, useValue: paypalFactoryMock, multi: true },
      ],
    });

    registry = TestBed.inject(ProviderFactoryRegistry);
  });

  describe('get()', () => {
    it('should retrieve the correct provider factory', () => {
      const factory = registry.get('paypal');
      expect(factory.providerId).toBe('paypal');
    });

    it('should throw an error if provider factory is not found', () => {
      expect(() => registry.get('unknown' as any)).toThrowError(
        /Provider factory for "unknown" not found/,
      );
    });

    it('injects factories as an array (multi provider)', () => {
      const stripe = registry.get('stripe');
      const paypal = registry.get('paypal');

      expect(stripe).toBe(stripeFactoryMock);
      expect(paypal).toBe(paypalFactoryMock);
    });
  });

  describe('has()', () => {
    it('returns true for registered providers', () => {
      expect(registry.has('stripe')).toBe(true);
      expect(registry.has('paypal')).toBe(true);
    });

    it('returns false for unregistered providers', () => {
      expect(registry.has('square' as any)).toBe(false);
    });
  });

  describe('getAvailableProviders()', () => {
    it('returns all registered provider IDs', () => {
      const providers = registry.getAvailableProviders();
      expect(providers).toContain('stripe');
      expect(providers).toContain('paypal');
      expect(providers).toHaveLength(2);
    });
  });

  describe('getProvidersForMethod()', () => {
    it('returns providers that support a given method', () => {
      const cardProviders = registry.getProvidersForMethod('card');
      expect(cardProviders).toContain('stripe');
      expect(cardProviders).toContain('paypal');
    });

    it('filters providers that do not support a method', () => {
      // Mock PayPal to not support SPEI
      (paypalFactoryMock.supportsMethod as any).mockImplementation(
        (type: string) => type === 'card',
      );

      const speiProviders = registry.getProvidersForMethod('spei');
      expect(speiProviders).toContain('stripe');
      expect(speiProviders).not.toContain('paypal');
    });
  });

  describe('duplicate detection', () => {
    it('throws when duplicate factories for same providerId exist during construction', () => {
      TestBed.resetTestingModule();

      expect(() => {
        TestBed.configureTestingModule({
          providers: [
            ProviderFactoryRegistry,
            {
              provide: PAYMENT_PROVIDER_FACTORIES,
              useValue: {
                providerId: 'stripe',
                getGateway: vi.fn(),
                createStrategy: vi.fn(),
                supportsMethod: vi.fn(),
                getSupportedMethods: vi.fn(),
                createRequestBuilder: vi.fn(),
                getFieldRequirements: vi.fn(),
              },
              multi: true,
            },
            {
              provide: PAYMENT_PROVIDER_FACTORIES,
              useValue: {
                providerId: 'stripe',
                getGateway: vi.fn(),
                createStrategy: vi.fn(),
                supportsMethod: vi.fn(),
                getSupportedMethods: vi.fn(),
                createRequestBuilder: vi.fn(),
                getFieldRequirements: vi.fn(),
              },
              multi: true,
            },
          ],
        });

        // Registry constructor throws on duplicate
        TestBed.inject(ProviderFactoryRegistry);
      }).toThrowError(/Duplicate provider factory for "stripe"/);
    });
  });
});
