import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { GetPaymentStatusUseCase } from './get-payment-status.use-case';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { ProviderFactory } from '../../domain/ports/provider-factory.port';
import { PaymentGateway } from '../../domain/ports/payment-gateway.port';
import { GetPaymentStatusRequest } from '../../domain/models/payment.requests';
import { PaymentIntent, PaymentMethodType, PaymentProviderId } from '../../domain/models/payment.types';

describe('GetPaymentStatusUseCase', () => {
    let useCase: GetPaymentStatusUseCase;

    const req: GetPaymentStatusRequest = {
        intentId: 'pi_1',
    };

    const gatewayMock = {
        getIntent: vi.fn(() =>
            of({
                id: 'pi_1',
                provider: 'stripe',
                status: 'requires_action',
                amount: 100,
                currency: 'MXN',
            } satisfies PaymentIntent)
        ),
    } as Pick<PaymentGateway, 'getIntent'>;

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

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                GetPaymentStatusUseCase,
                { provide: ProviderFactoryRegistry, useValue: registryMock },
            ],
        });

        useCase = TestBed.inject(GetPaymentStatusUseCase);
        vi.clearAllMocks();
    });

    it('resolves provider and calls gateway.getIntent', async () => {
        const result = await firstValueFrom(useCase.execute(req, 'stripe'));

        expect(registryMock.get).toHaveBeenCalledWith('stripe');
        expect(providerFactoryMock.getGateway).toHaveBeenCalledTimes(1);
        expect(gatewayMock.getIntent).toHaveBeenCalledWith(req);
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

        it('propagates observable errors from gateway.getIntent()', async () => {
            (gatewayMock.getIntent as any).mockReturnValueOnce(
                throwError(() => new Error('boom'))
            );

            await expect(firstValueFrom(useCase.execute(req, 'stripe')))
                .rejects.toThrowError('boom');
        });
    });
});
