import { TestBed } from '@angular/core/testing';
import { I18nKeys } from '@core/i18n';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  PaymentIntent,
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { GetPaymentStatusRequest } from '@payments/domain/models/payment/payment-request.types';
import { firstValueFrom, of, throwError } from 'rxjs';

import { IdempotencyKeyFactory } from '../../shared/idempotency/idempotency-key.factory';
import { PaymentGatewayPort } from '../ports/payment-gateway.port';
import { ProviderFactory } from '../ports/provider-factory.port';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { GetPaymentStatusUseCase } from './get-payment-status.use-case';

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
        messageKey: I18nKeys.errors.provider_error,
        raw: {},
      };
      (gatewayMock.getIntent as any).mockReturnValueOnce(throwError(() => error));

      await expect(firstValueFrom(useCase.execute(req, 'stripe'))).rejects.toMatchObject({
        code: 'provider_error',
        messageKey: I18nKeys.errors.provider_error,
      });
    });
  });
});
