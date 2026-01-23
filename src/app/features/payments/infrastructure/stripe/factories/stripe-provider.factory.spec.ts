import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { CardStrategy } from '../../../shared/strategies/card-strategy';
import { SpeiStrategy } from '../../../shared/strategies/spei-strategy';
import { IntentFacade } from '../gateways/intent/intent.facade';
import { StripeProviderFactory } from './stripe-provider.factory';

describe('StripeProviderFactory', () => {
  let factory: StripeProviderFactory;

  const gatewayStub = {
    providerId: 'stripe',
    createIntent: vi.fn(),
  } satisfies Partial<IntentFacade>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StripeProviderFactory, { provide: IntentFacade, useValue: gatewayStub }],
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
      /Payment method "unsupported" is not supported by Stripe/,
    );
  });

  it('creates a strategy that delegates to the injected gateway', async () => {
    gatewayStub.createIntent = vi.fn(() =>
      of({
        id: 'pi_1',
        provider: 'stripe',
        status: 'requires_payment_method',
        amount: 100,
        currency: 'MXN',
      }),
    );

    const strategy = factory.createStrategy('card');
    const result = await firstValueFrom(
      strategy.start({
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_test1234567890abc' },
      }),
    );

    expect(gatewayStub.createIntent).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('stripe');
  });

  describe('getFieldRequirements', () => {
    it('returns field requirements for card method', () => {
      const requirements = factory.getFieldRequirements('card');

      expect(requirements.fields).toBeDefined();
      expect(requirements.fields.length).toBeGreaterThan(0);
      expect(requirements.description).toBeDefined();
      expect(requirements.instructions).toBeDefined();

      const tokenField = requirements.fields.find((f) => f.name === 'token');
      expect(tokenField).toBeDefined();
      expect(tokenField?.required).toBe(true);
      expect(tokenField?.type).toBe('hidden');
    });

    it('returns field requirements for spei method', () => {
      const requirements = factory.getFieldRequirements('spei');

      expect(requirements.fields).toBeDefined();
      expect(requirements.fields.length).toBeGreaterThan(0);
      expect(requirements.description).toBeDefined();
      expect(requirements.instructions).toBeDefined();

      const emailField = requirements.fields.find((f) => f.name === 'customerEmail');
      expect(emailField).toBeDefined();
      expect(emailField?.required).toBe(true);
      expect(emailField?.type).toBe('email');
    });

    it('throws for unsupported payment method type', () => {
      expect(() => factory.getFieldRequirements('unsupported' as any)).toThrow(
        /Payment method "unsupported" is not supported by Stripe/,
      );
    });
  });
});
