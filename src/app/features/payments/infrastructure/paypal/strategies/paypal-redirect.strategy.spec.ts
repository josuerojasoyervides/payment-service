import { TestBed } from "@angular/core/testing";
import { PaypalRedirectStrategy } from "./paypal-redirect.strategy";
import { PaypalPaymentGateway } from "../gateways/paypal-payment.gateway";
import { CreatePaymentRequest } from "../../../domain/models/payment.requests";
import { firstValueFrom, of } from "rxjs";
import { PaymentGateway } from "../../../domain/ports/payment-gateway.port";

describe('PaypalRedirectStrategy', () => {
    let strategy: PaypalRedirectStrategy;

    let gatewayMock: Pick<PaymentGateway, 'createIntent' | 'providerId'>;

    const req: CreatePaymentRequest = {
        orderId: 'order_1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
    };


    beforeEach(() => {
        gatewayMock = {
            providerId: 'stripe',
            createIntent: vi.fn(() =>
                of({
                    id: 'pi_1',
                    provider: 'stripe',
                    status: 'requires_payment_method',
                    amount: 100,
                    currency: 'MXN',
                })
            )
        } as any;

        TestBed.configureTestingModule({
            providers: [
                PaypalRedirectStrategy,
                { provide: PaypalPaymentGateway, useValue: gatewayMock }
            ]
        })

        strategy = new PaypalRedirectStrategy(gatewayMock as any);
    })

    it('delegates to gateway.createIntent(req)', async () => {
        const result = await firstValueFrom(strategy.start(req));

        expect(gatewayMock.createIntent).toHaveBeenCalledTimes(1);
        expect(gatewayMock.createIntent).toHaveBeenCalledWith(req);

        expect(result.id).toBe('pi_1');
    });
})