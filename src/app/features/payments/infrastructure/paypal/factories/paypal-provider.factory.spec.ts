import { TestBed } from '@angular/core/testing';
import { PaypalPaymentGateway } from '../gateways/paypal-payment.gateway';
import { PaypalProviderFactory } from './paypal-provider.factory'
import { PaypalRedirectStrategy } from '../strategies/paypal-redirect.strategy';
import { firstValueFrom, of } from 'rxjs';

describe('PaypalProviderFactory', () => {
    let factory: PaypalProviderFactory;
    let gatewayStub = {
        providerId: 'paypal',
        createIntent: vi.fn()
    } satisfies Partial<PaypalPaymentGateway>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                PaypalProviderFactory,
                { provide: PaypalPaymentGateway, useValue: gatewayStub }
            ]
        })

        factory = TestBed.inject(PaypalProviderFactory);
    });

    it('creates a PaypalRedirectStrategy when type is card', () => {
        const strategy = factory.createStrategy('card');
        expect(strategy).toBeInstanceOf(PaypalRedirectStrategy);
        expect(strategy.type).toBe('card');
    })

    it('throws for unsupported payment method type', () => {
        expect(() =>
            factory.createStrategy('spei' as any)
        ).toThrow('Unsupported payment method type: spei');
    })

    it('creates a strategy that delegates to the injected gateway', async () => {
        gatewayStub.createIntent = vi.fn(() =>
            of({
                id: 'pi_1',
                provider: 'paypal',
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
            method: { type: 'card', token: 'tok' },
        }));

        expect(gatewayStub.createIntent).toHaveBeenCalledTimes(1);
        expect(result.provider).toBe('paypal');
    });
})