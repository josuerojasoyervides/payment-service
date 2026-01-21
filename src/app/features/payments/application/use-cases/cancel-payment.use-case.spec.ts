import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { CancelPaymentUseCase } from './cancel-payment.use-case';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';
import { ProviderFactory, PaymentGateway } from '../../domain/ports';
import { CancelPaymentRequest, PaymentIntent, PaymentMethodType, PaymentProviderId, PaymentError } from '../../domain/models';

describe('CancelPaymentUseCase', () => {
    let useCase: CancelPaymentUseCase;

    const req: CancelPaymentRequest = {
        intentId: 'pi_1',
    };

    const gatewayMock = {
        cancelIntent: vi.fn(() =>
            of({
                id: 'pi_1',
                provider: 'stripe',
                status: 'canceled',
                amount: 100,
                currency: 'MXN',
            } satisfies PaymentIntent)
        ),
    } as Pick<PaymentGateway, 'cancelIntent'>;

    const providerFactoryMock: ProviderFactory = {
        providerId: 'stripe' as const,
        getGateway: vi.fn(() => gatewayMock as unknown as PaymentGateway),
        createStrategy: vi.fn(),
        supportsMethod: vi.fn(() => true),
        getSupportedMethods: vi.fn((): PaymentMethodType[] => ['card', 'spei']),
        createRequestBuilder: vi.fn(),
        getFieldRequirements: vi.fn(() => ({ fields: [] })),
    };

    const registryMock = {
        get: vi.fn((providerId: PaymentProviderId) => providerFactoryMock),
    } satisfies Pick<ProviderFactoryRegistry, 'get'>;

    const fallbackOrchestratorMock = {
        reportFailure: vi.fn(() => false),
        notifySuccess: vi.fn(),
        notifyFailure: vi.fn(),
        reset: vi.fn(),
        getSnapshot: vi.fn(() => ({ status: 'idle' as const, pendingEvent: null, failedAttempts: [], currentProvider: null, isAutoFallback: false })),
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                CancelPaymentUseCase,
                { provide: ProviderFactoryRegistry, useValue: registryMock },
                { provide: FallbackOrchestratorService, useValue: fallbackOrchestratorMock },
            ],
        });

        useCase = TestBed.inject(CancelPaymentUseCase);
        vi.clearAllMocks();
    });

    it('resolves provider and calls gateway.cancelIntent', async () => {
        const result = await firstValueFrom(useCase.execute(req, 'stripe'));

        expect(registryMock.get).toHaveBeenCalledWith('stripe');
        expect(providerFactoryMock.getGateway).toHaveBeenCalledTimes(1);
        expect(gatewayMock.cancelIntent).toHaveBeenCalledWith(req);
        expect(result.id).toBe('pi_1');
    });

    describe('error handling', () => {
        it('propagates errors from registry.get()', async () => {
            registryMock.get.mockImplementationOnce(() => {
                throw new Error('Registry failed');
            });

            await expect(firstValueFrom(useCase.execute(req, 'stripe')))
                .rejects.toThrowError('Registry failed');
        });

        it('propagates observable errors from gateway.cancelIntent() and reports to orchestrator', async () => {
            const error: PaymentError = { code: 'provider_error', message: 'boom', raw: {} };
            (gatewayMock.cancelIntent as any).mockReturnValueOnce(
                throwError(() => error)
            );

            await expect(firstValueFrom(useCase.execute(req, 'stripe')))
                .rejects.toThrow('boom');
            
            expect(fallbackOrchestratorMock.reportFailure).toHaveBeenCalledWith(
                'stripe',
                error,
                expect.objectContaining({
                    orderId: 'pi_1',
                    amount: 0,
                    currency: 'MXN',
                    method: { type: 'card' },
                }),
                false
            );
        });
    });
});
