import { TestBed } from "@angular/core/testing";
import { PaymentGatewayFactory } from "./payment-gateway.factory";
import { PAYMENT_GATEWAYS } from "../../infrastructure/providers/payments.token";
import { PaymentGateway } from "../../domain/ports/payment-gateway.port";

describe('PaymentGatewayFactory', () => {
    let factory: PaymentGatewayFactory;

    const gatewaysStub = [
        { providerId: 'stripe' },
        { providerId: 'paypal' }
    ] satisfies Partial<PaymentGateway>[];

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                PaymentGatewayFactory,
                { provide: PAYMENT_GATEWAYS, useValue: gatewaysStub as unknown as PaymentGateway[] }
            ]
        })
        factory = TestBed.inject(PaymentGatewayFactory);
    });

    it('returns paypal gateway when providerId is paypal', () => {
        const gateway = factory.get('paypal');
        expect(gateway.providerId).toBe('paypal');
    })

    it('throws when providerId is not found', () => {
        expect(() =>
            factory.get('nonExistent' as any)
        ).toThrowError('Payment gateway for provider nonExistent not found.')
    })

    it('returns the exact gateway instance from the list', () => {
        const paypal = gatewaysStub[1] as any;
        expect(factory.get('paypal')).toBe(paypal);
    });
})