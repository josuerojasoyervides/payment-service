import { TestBed } from '@angular/core/testing';
import { StripeProviderFactory } from './stripe-provider.factory';
import { StripePaymentGateway } from '../gateways/stripe-payment.gateway';
import { firstValueFrom, of } from 'rxjs';
import { CardStrategy } from '../../../shared/strategies/card-strategy';
import { SpeiStrategy } from '../../../shared/strategies/spei-strategy';

describe('StripeProviderFactory', () => {
    let factory: StripeProviderFactory;

    let gatewayStub = {
        providerId: 'stripe',
        createIntent: vi.fn(),
    } satisfies Partial<StripePaymentGateway>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                StripeProviderFactory,
                { provide: StripePaymentGateway, useValue: gatewayStub }
            ]
        })

        factory = TestBed.inject(StripeProviderFactory);
    })

    it('creates a CardStrategy when type is card', () => {
        const strategy = factory.createStrategy('card');
        expect(strategy).toBeInstanceOf(CardStrategy);
        expect(strategy.type).toBe('card');
    })

    it('creates a SpeiStrategy when type is spei', () => {
        const strategy = factory.createStrategy('spei');
        expect(strategy).toBeInstanceOf(SpeiStrategy);
        expect(strategy.type).toBe('spei');
    })

    it('throws for unsupported payment method type', () => {
        expect(() =>
            factory.createStrategy('unsupported' as any)
        ).toThrow(/Payment method "unsupported" is not supported by Stripe/);
    })

    it('creates a strategy that delegates to the injected gateway', async () => {
        gatewayStub.createIntent = vi.fn(() =>
            of({
                id: 'pi_1',
                provider: 'stripe',
                status: 'requires_payment_method',
                amount: 100,
                currency: 'MXN',
            })
        );

        const strategy = factory.createStrategy('card');
        const result = await firstValueFrom(strategy.start({
            orderId: 'o1',
            amount: 100,
            currency: 'MXN',
            method: { type: 'card', token: 'tok_valid123' }, // Token válido
        }));

        expect(gatewayStub.createIntent).toHaveBeenCalledTimes(1);
        expect(result.provider).toBe('stripe');
    });
})