import { TestBed } from "@angular/core/testing";
import { PaypalRedirectStrategy } from "./paypal-redirect.strategy";
import { PaypalPaymentGateway } from "../gateways/paypal-payment.gateway";
import { CreatePaymentRequest } from "../../../domain/models";
import { firstValueFrom, of } from "rxjs";
import { PaymentGateway } from "../../../domain/ports";
import { I18nService } from "@core/i18n";

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

        const i18nMock = {
            t: vi.fn((key: string) => key),
            setLanguage: vi.fn(),
            getLanguage: vi.fn(() => 'es'),
            has: vi.fn(() => true),
            currentLang: { asReadonly: vi.fn() } as any,
        } as any;

        TestBed.configureTestingModule({
            providers: [
                PaypalRedirectStrategy,
                { provide: PaypalPaymentGateway, useValue: gatewayMock },
                { provide: I18nService, useValue: i18nMock },
            ]
        })

        strategy = new PaypalRedirectStrategy(gatewayMock as any, i18nMock);
    })

    it('delegates to gateway.createIntent(req)', async () => {
        const result = await firstValueFrom(strategy.start(req));

        expect(gatewayMock.createIntent).toHaveBeenCalledTimes(1);
        // PayPal strategy removes token from request
        expect(gatewayMock.createIntent).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: req.orderId,
                amount: req.amount,
                currency: req.currency,
                method: { type: 'card' }, // Token removed
            })
        );

        expect(result.id).toBe('pi_1');
    });
})