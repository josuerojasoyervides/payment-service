import { TestBed } from '@angular/core/testing';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  PaymentIntent,
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CancelPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { firstValueFrom, of, throwError } from 'rxjs';

import { IdempotencyKeyFactory } from '../../shared/idempotency/idempotency-key.factory';
import { PaymentGateway } from '../ports/payment-gateway.port';
import { ProviderFactory } from '../ports/provider-factory.port';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { CancelPaymentUseCase } from './cancel-payment.use-case';

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
      } satisfies PaymentIntent),
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CancelPaymentUseCase,
        { provide: ProviderFactoryRegistry, useValue: registryMock },
        IdempotencyKeyFactory,
      ],
    });

    useCase = TestBed.inject(CancelPaymentUseCase);
    vi.clearAllMocks();
  });

  it('resolves provider and calls gateway.cancelIntent with idempotency key', async () => {
    const result = await firstValueFrom(useCase.execute(req, 'stripe'));

    expect(registryMock.get).toHaveBeenCalledWith('stripe');
    expect(providerFactoryMock.getGateway).toHaveBeenCalledTimes(1);
    expect(gatewayMock.cancelIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        ...req,
        idempotencyKey: 'stripe:cancel:pi_1',
      }),
    );
    expect(result.id).toBe('pi_1');
  });

  describe('error handling', () => {
    it('propagates errors from registry.get()', async () => {
      registryMock.get.mockImplementationOnce(() => {
        throw new Error('Registry failed');
      });

      await expect(firstValueFrom(useCase.execute(req, 'stripe'))).rejects.toThrowError(
        'Registry failed',
      );
    });

    it('propagates observable errors from gateway.cancelIntent()', async () => {
      const error: PaymentError = { code: 'provider_error', message: 'boom', raw: {} };
      (gatewayMock.cancelIntent as any).mockReturnValueOnce(throwError(() => error));

      await expect(firstValueFrom(useCase.execute(req, 'stripe'))).rejects.toThrow('boom');
    });
  });
});
