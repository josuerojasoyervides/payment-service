import { TestBed } from '@angular/core/testing';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { StartPaymentUseCase } from './start-payment.use-case'
import { PaymentIntent, PaymentMethodType, PaymentProviderId, CreatePaymentRequest } from '../../domain/models';
import { PaymentStrategy, StrategyContext } from '../../domain/ports';
import { firstValueFrom, of, throwError } from 'rxjs';

describe('StartPaymentUseCase', () => {
    let useCase: StartPaymentUseCase;

    const req: CreatePaymentRequest = {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
    };

    const intentResponse: PaymentIntent = {
        id: 'pi_1',
        provider: 'stripe',
        status: 'requires_payment_method',
        amount: 100,
        currency: 'MXN',
    };

    const strategyMock: PaymentStrategy = {
        type: 'card',
        validate: vi.fn(),
        prepare: vi.fn(() => ({ preparedRequest: req, metadata: {} })),
        start: vi.fn(() => of(intentResponse)),
        requiresUserAction: vi.fn(() => false),
        getUserInstructions: vi.fn(() => null),
    };

    const providerFactoryMock = {
        providerId: 'stripe' as const,
        createStrategy: vi.fn(() => strategyMock),
        getGateway: vi.fn(),
        supportsMethod: vi.fn(() => true),
        getSupportedMethods: vi.fn((): PaymentMethodType[] => ['card', 'spei']),
    };

    const registryMock = {
        get: vi.fn((_providerId: PaymentProviderId) => providerFactoryMock as any),
        has: vi.fn(() => true),
        getAvailableProviders: vi.fn((): PaymentProviderId[] => ['stripe', 'paypal']),
        getProvidersForMethod: vi.fn((): PaymentProviderId[] => ['stripe']),
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                StartPaymentUseCase,
                { provide: ProviderFactoryRegistry, useValue: registryMock }
            ]
        });
        useCase = TestBed.inject(StartPaymentUseCase);

        vi.clearAllMocks();
    });

    describe('execute()', () => {
        it('calls registry.get with the provided providerId', async () => {
            await firstValueFrom(useCase.execute(req, 'stripe'));

            expect(registryMock.get).toHaveBeenCalledTimes(1);
            expect(registryMock.get).toHaveBeenCalledWith('stripe');
        });

        it('calls factory.createStrategy with the payment method type', async () => {
            await firstValueFrom(useCase.execute(req, 'stripe'));

            expect(providerFactoryMock.createStrategy).toHaveBeenCalledTimes(1);
            expect(providerFactoryMock.createStrategy).toHaveBeenCalledWith(req.method.type);
        });

        it('calls strategy.start with request and context', async () => {
            const context: StrategyContext = { returnUrl: 'https://return.com' };
            await firstValueFrom(useCase.execute(req, 'stripe', context));

            expect(strategyMock.start).toHaveBeenCalledTimes(1);
            expect(strategyMock.start).toHaveBeenCalledWith(req, context);
        });

        it('returns the PaymentIntent from strategy.start', async () => {
            const result = await firstValueFrom(useCase.execute(req, 'stripe'));

            expect(result.id).toBe('pi_1');
            expect(result.provider).toBe('stripe');
        });

        it('works with different providers', async () => {
            await firstValueFrom(useCase.execute(req, 'paypal'));

            expect(registryMock.get).toHaveBeenCalledWith('paypal');
        });
    });

    describe('error handling', () => {
        it('propagates errors from registry.get()', async () => {
            registryMock.get.mockImplementationOnce(() => {
                throw new Error('Registry failed');
            });

            await expect(firstValueFrom(useCase.execute(req, 'stripe')))
                .rejects.toThrowError('Registry failed');
        });

        it('propagates errors from providerFactory.createStrategy()', async () => {
            (providerFactoryMock.createStrategy as any).mockImplementationOnce(() => {
                throw new Error('Strategy creation failed');
            });

            await expect(firstValueFrom(useCase.execute(req, 'paypal')))
                .rejects.toThrowError('Strategy creation failed');
        });

        it('propagates observable errors from strategy.start()', async () => {
            (strategyMock.start as any).mockReturnValueOnce(
                throwError(() => new Error('boom'))
            );

            await expect(firstValueFrom(useCase.execute(req, 'stripe')))
                .rejects.toThrow('boom');
        });

        it('throws when providerId is not registered', async () => {
            registryMock.get.mockImplementationOnce((providerId: any) => {
                throw new Error(`Provider factory for "${providerId}" not found.`);
            });

            await expect(firstValueFrom(useCase.execute(req, 'nonExistent' as any)))
                .rejects.toThrowError(/Provider factory for "nonExistent" not found/);
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

        it('does not call strategy.start when createStrategy fails', async () => {
            (providerFactoryMock.createStrategy as any).mockImplementationOnce(() => {
                throw new Error('Unsupported method');
            });

            await expect(firstValueFrom(useCase.execute(req, 'stripe')))
                .rejects.toThrowError('Unsupported method');

            expect(strategyMock.start).not.toHaveBeenCalled();
        });
    });
});