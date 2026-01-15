import { TestBed } from "@angular/core/testing"
import { PaymentGateway } from "../../domain/ports/payment-gateway.port"
import { PaymentStrategyFactory } from "./payment-strategy.factory"
import { PaymentGatewayFactory } from "./payment-gateway.factory"
import { CardStrategy } from "../../infrastructure/strategies/card-strategy"
import { SpeiStrategy } from "../../infrastructure/strategies/spei-strategy"

describe('PaymentStrategyFactory', () => {
    let factory: PaymentStrategyFactory

    const gatewayStub = {
        providerId: 'stripe'
    } as const satisfies Partial<PaymentGateway>;

    const gatewayFactoryMock = {
        get: vi.fn(() => gatewayStub)
    }

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                PaymentStrategyFactory,
                { provide: PaymentGatewayFactory, useValue: gatewayFactoryMock }
            ]
        })
        factory = TestBed.inject(PaymentStrategyFactory)
    })

    it('creates a CardStrategy when type is card', () => {
        const strategy = factory.create('stripe', 'card')
        expect(gatewayFactoryMock.get).toBeCalledWith('stripe')
        expect(strategy).toBeInstanceOf(CardStrategy);
    })

    it('creates a SpeiStrategy when type is spei', () => {
        const strategy = factory.create('stripe', 'spei')
        expect(gatewayFactoryMock.get).toBeCalledWith('stripe')
        expect(strategy).toBeInstanceOf(SpeiStrategy);
    })

    it('throws for unsupported payment method type', () => {
        expect(() =>
            factory.create('stripe', 'unsupported' as any)
        ).toThrowError('Payment method type unsupported is not supported.')
    })
})