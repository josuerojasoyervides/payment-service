import { TestBed } from '@angular/core/testing';
import { ProviderFactory } from '../../domain/ports/provider-factory.port';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { StartPaymentUseCase } from './start-payment.use-case'
import { PaymentIntent, PaymentProviderId } from '../../domain/models/payment.types';
import { CreatePaymentRequest } from '../../domain/models/payment.requests';
import { PaymentStrategy } from '../../domain/ports/payment-strategy.port';
import { firstValueFrom, of, throwError } from 'rxjs';

describe('StartPaymentUseCase', () => {
    let useCase: StartPaymentUseCase;

    const req: CreatePaymentRequest = {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
    };

    const strategyMock: PaymentStrategy = {
        type: 'card',
        start: vi.fn(() =>
            of({
                id: 'pi_1',
                provider: 'stripe',
                status: 'requires_payment_method',
                amount: 100,
                currency: 'MXN',
            } satisfies PaymentIntent)
        ),
    };

    const providerFactoryMock = {
        providerId: 'stripe' as const,
        createStrategy: vi.fn(() => strategyMock),
    }

    const providerFactoryWithGetGatewayMock = {
        ...providerFactoryMock,
        getGateway: vi.fn(),
    };

    const registryMock = {
        get: vi.fn((providerId: PaymentProviderId) => providerFactoryWithGetGatewayMock),
    } satisfies Pick<ProviderFactoryRegistry, 'get'>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                StartPaymentUseCase,
                { provide: ProviderFactoryRegistry, useValue: registryMock }
            ]
        })
        useCase = TestBed.inject(StartPaymentUseCase);

        vi.clearAllMocks();
    })

    it('uses default provider when providerId is not provided', async () => {
        const result = await firstValueFrom(useCase.execute(req, 'stripe'));

        expect(registryMock.get).toHaveBeenCalledTimes(1);
        expect(registryMock.get).toHaveBeenCalledWith('stripe');

        expect(providerFactoryMock.createStrategy).toHaveBeenCalledTimes(1);
        expect(providerFactoryMock.createStrategy).toHaveBeenCalledWith(req.method.type);

        expect(strategyMock.start).toHaveBeenCalledTimes(1);
        expect(strategyMock.start).toHaveBeenCalledWith(req);

        expect(result.id).toBe('pi_1');
    })

    it('uses provided providerId when passed', async () => {
        const result = await firstValueFrom(useCase.execute(req, 'paypal'));

        expect(registryMock.get).toHaveBeenCalledTimes(1);
        expect(registryMock.get).toHaveBeenCalledWith('paypal');
    })

    describe('error handling', () => {
        it('propagates errors from registry.get()', async () => {
            registryMock.get.mockImplementationOnce(() => {
                throw new Error('Registry failed');
            })

            await expect(firstValueFrom(useCase.execute(req, 'stripe')))
                .rejects.toThrowError('Registry failed');
        })

        it('propagates errors from providerFactory.createStrategy()', async () => {
            (providerFactoryMock.createStrategy as any).mockImplementationOnce(() => {
                throw new Error('Strategy creation failed');
            })
            await expect(firstValueFrom(useCase.execute(req, 'paypal')))
                .rejects.toThrowError('Strategy creation failed');
        })

        it('propagates observable errors from strategy.start()', async () => {
            (strategyMock.start as any).mockReturnValueOnce(
                throwError(() => new Error('boom'))
            );

            await expect(firstValueFrom(useCase.execute(req, 'stripe'))).rejects.toThrow(
                'boom'
            );
        })

        it('throws when providerId is not registered', async () => {
            registryMock.get.mockImplementationOnce((providerId: any) => {
                throw new Error(`Provider factory for ${providerId} not found.`);
            });


            await expect(firstValueFrom(useCase.execute(req, 'nonExistent' as any)))
                .rejects.toThrowError('Provider factory for nonExistent not found.');
        });

        it('does not call createStrategy when registry.get fails', async () => {
            registryMock.get.mockImplementationOnce(() => {
                throw new Error('registry failed');
            });

            await expect(firstValueFrom(useCase.execute(req, 'paypal')))
                .rejects.toThrowError('registry failed');

            expect(providerFactoryMock.createStrategy).not.toHaveBeenCalled();
            expect(strategyMock.start).not.toHaveBeenCalled();
        });
    })
})