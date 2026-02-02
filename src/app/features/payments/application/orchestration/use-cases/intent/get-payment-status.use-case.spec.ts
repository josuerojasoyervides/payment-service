import { TestBed } from '@angular/core/testing';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type { ProviderFactory } from '@payments/application/api/ports/provider-factory.port';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import { GetPaymentStatusUseCase } from '@payments/application/orchestration/use-cases/intent/get-payment-status.use-case';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { GetPaymentStatusRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { firstValueFrom, of, throwError } from 'rxjs';

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
        money: { amount: 100, currency: 'MXN' },
      } satisfies PaymentIntent),
    ),
  } as Pick<PaymentGatewayPort, 'getIntent'>;

  const providerFactoryMock: ProviderFactory = {
    providerId: 'stripe' as const,
    getGateway: vi.fn(() => gatewayMock as unknown as PaymentGatewayPort),
    createStrategy: vi.fn(),
    supportsMethod: vi.fn(() => true),
    getSupportedMethods: vi.fn((): PaymentMethodType[] => ['card', 'spei']),
    createRequestBuilder: vi.fn(),
    getFieldRequirements: vi.fn(() => ({ fields: [] })),
  };

  const registryMock = {
    get: vi.fn((_providerId: PaymentProviderId) => providerFactoryMock),
  } satisfies Pick<ProviderFactoryRegistry, 'get'>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GetPaymentStatusUseCase,
        { provide: ProviderFactoryRegistry, useValue: registryMock },
        IdempotencyKeyFactory,
      ],
    });

    useCase = TestBed.inject(GetPaymentStatusUseCase);
    vi.clearAllMocks();
  });

  it('resolves provider and calls gateway.getIntent with idempotency key', async () => {
    const result = await firstValueFrom(useCase.execute(req, 'stripe'));

    expect(registryMock.get).toHaveBeenCalledWith('stripe');
    expect(providerFactoryMock.getGateway).toHaveBeenCalledTimes(1);
    expect(gatewayMock.getIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        ...req,
        idempotencyKey: 'stripe:get:pi_1',
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

    it('propagates observable errors from gateway.getIntent()', async () => {
      const error: PaymentError = {
        code: 'provider_error',
        messageKey: 'errors.provider_error',
        raw: {},
      };
      (gatewayMock.getIntent as any).mockReturnValueOnce(throwError(() => error));

      await expect(firstValueFrom(useCase.execute(req, 'stripe'))).rejects.toMatchObject({
        code: 'provider_error',
        messageKey: 'errors.provider_error',
      });
    });
  });
});
