import { firstValueFrom, of, throwError } from 'rxjs';
import { CreatePaymentRequest, PaymentIntent } from '../../domain/models/payment.types';
import { PaymentStrategy } from '../../domain/ports/payment-strategy.port';
import { StartPaymentUseCase } from './start-payment.use-case'
import { PaymentStrategyFactory } from '../factories/payment-strategy.factory';
import { TestBed } from '@angular/core/testing';
describe('StartPaymentUseCase', () => {
    let useCase: StartPaymentUseCase;
    let strategyMock: PaymentStrategy;
    let strategyFactoryMock: { create: ReturnType<typeof vi.fn> };
    const req: CreatePaymentRequest = {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' }
    }

    beforeEach(() => {
        strategyMock = {
            type: 'card',
            start: vi.fn(() => of({
                id: 'pi_1',
                provider: 'stripe',
                status: 'requires_payment_method',
                amount: 100,
                currency: 'MXN'
            } satisfies PaymentIntent))
        }

        strategyFactoryMock = {
            create: vi.fn(() => strategyMock)
        }

        TestBed.configureTestingModule({
            providers: [
                { provide: PaymentStrategyFactory, useValue: strategyFactoryMock }
            ]
        })

        useCase = TestBed.inject(StartPaymentUseCase);
    })

    it('calls factory with default provider and request method type, then calls strategy.start(req)', async () => {
        const result = await firstValueFrom(useCase.execute(req));

        expect(strategyFactoryMock.create).toBeCalledTimes(1);
        expect(strategyFactoryMock.create).toHaveBeenCalledWith('stripe', 'card');

        expect(strategyMock.start).toHaveBeenCalledTimes(1);
        expect(strategyMock.start).toHaveBeenCalledWith(req);

        expect(result).toEqual(
            expect.objectContaining({
                id: 'pi_1',
                provider: 'stripe',
                amount: 100,
                currency: 'MXN'
            })
        )
    })

    it('propagates errors from strategy.start()', async () => {
        (strategyMock.start as any).mockReturnValueOnce(
            throwError(() => new Error('boom'))
        )

        await expect(firstValueFrom(useCase.execute(req))).rejects.toThrow('boom');
    })

    it('propagates errors from strategyFactory.create()', async () => {
        strategyFactoryMock.create.mockImplementationOnce(() => {
            throw new Error('factory failed');
        })

        await expect(firstValueFrom(useCase.execute(req))).rejects.toThrow('factory failed');
    })

    it('does not call factory.create until subscribed (because of defer)', () => {
        useCase.execute(req); // no subscription
        expect(strategyFactoryMock.create).not.toHaveBeenCalled();
    });

})