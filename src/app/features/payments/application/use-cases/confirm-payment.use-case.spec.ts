import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import {
  ConfirmPaymentRequest,
  PaymentError,
  PaymentIntent,
  PaymentMethodType,
  PaymentProviderId,
} from '../../domain/models';
import { PaymentGateway, ProviderFactory } from '../../domain/ports';
import { IdempotencyKeyFactory } from '../../shared/idempotency/idempotency-key.factory';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';
import { ConfirmPaymentUseCase } from './confirm-payment.use-case';

describe('ConfirmPaymentUseCase', () => {
  let useCase: ConfirmPaymentUseCase;

  const req: ConfirmPaymentRequest = {
    intentId: 'pi_1',
    returnUrl: 'https://example.com/return',
  };

  const gatewayMock = {
    confirmIntent: vi.fn(() =>
      of({
        id: 'pi_1',
        provider: 'stripe',
        status: 'processing',
        amount: 100,
        currency: 'MXN',
      } satisfies PaymentIntent),
    ),
  } as Pick<PaymentGateway, 'confirmIntent'>;

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
    getSnapshot: vi.fn(() => ({
      status: 'idle' as const,
      pendingEvent: null,
      failedAttempts: [],
      currentProvider: null,
      isAutoFallback: false,
    })),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConfirmPaymentUseCase,
        { provide: ProviderFactoryRegistry, useValue: registryMock },
        { provide: FallbackOrchestratorService, useValue: fallbackOrchestratorMock },
        IdempotencyKeyFactory,
      ],
    });

    useCase = TestBed.inject(ConfirmPaymentUseCase);
    vi.clearAllMocks();
  });

  it('resolves provider and calls gateway.confirmIntent with idempotency key', async () => {
    const result = await firstValueFrom(useCase.execute(req, 'stripe'));

    expect(registryMock.get).toHaveBeenCalledWith('stripe');
    expect(providerFactoryMock.getGateway).toHaveBeenCalledTimes(1);
    expect(gatewayMock.confirmIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        ...req,
        idempotencyKey: 'stripe:confirm:pi_1',
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

    it('propagates observable errors from gateway.confirmIntent() and reports to orchestrator', async () => {
      const error: PaymentError = { code: 'provider_error', message: 'boom', raw: {} };
      (gatewayMock.confirmIntent as any).mockReturnValueOnce(throwError(() => error));

      await expect(firstValueFrom(useCase.execute(req, 'stripe'))).rejects.toThrow('boom');

      expect(fallbackOrchestratorMock.reportFailure).toHaveBeenCalledWith(
        'stripe',
        error,
        expect.objectContaining({
          orderId: 'pi_1',
          amount: 0,
          currency: 'MXN',
          method: { type: 'card' },
        }),
        false,
      );
    });
  });
});
