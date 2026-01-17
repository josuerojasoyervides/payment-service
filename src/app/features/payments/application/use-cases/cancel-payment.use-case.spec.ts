import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { CancelPaymentUseCase } from './cancel-payment.use-case';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { ProviderFactory } from '../../domain/ports/provider-factory.port';
import { PaymentGateway } from '../../domain/ports/payment-gateway.port';
import { CancelPaymentRequest } from '../../domain/models/payment.requests';
import { PaymentIntent, PaymentProviderId } from '../../domain/models/payment.types';

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

    const providerFactoryMock = {
        providerId: 'stripe' as const,
        getGateway: vi.fn(() => gatewayMock as unknown as PaymentGateway),
        createStrategy: vi.fn(),
    } satisfies ProviderFactory;

    const registryMock = {
        get: vi.fn((providerId: PaymentProviderId) => providerFactoryMock),
    } satisfies Pick<ProviderFactoryRegistry, 'get'>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                CancelPaymentUseCase,
                { provide: ProviderFactoryRegistry, useValue: registryMock },
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

        it('propagates observable errors from gateway.cancelIntent()', async () => {
            (gatewayMock.cancelIntent as any).mockReturnValueOnce(
                throwError(() => new Error('boom'))
            );

            await expect(firstValueFrom(useCase.execute(req, 'stripe')))
                .rejects.toThrowError('boom');
        });
    });
});
