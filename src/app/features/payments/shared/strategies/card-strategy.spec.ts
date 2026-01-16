import { CreatePaymentRequest } from "../../domain/models/payment.types";
import { PaymentGateway } from "../../domain/ports/payment-gateway.port";
import { CardStrategy } from "./card-strategy"
import { firstValueFrom, of } from "rxjs";

describe('CardStrategy', () => {
    let strategy: CardStrategy;

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

        strategy = new CardStrategy(gatewayMock as any);
    })

    it('delegates to gateway.createIntent(req)', async () => {
        const result = await firstValueFrom(strategy.start(req));

        expect(gatewayMock.createIntent).toHaveBeenCalledTimes(1);
        expect(gatewayMock.createIntent).toHaveBeenCalledWith(req);

        expect(result.id).toBe('pi_1');
    });
})