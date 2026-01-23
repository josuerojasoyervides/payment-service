import { TestBed } from '@angular/core/testing';
import { defaultIfEmpty, firstValueFrom, of, throwError } from 'rxjs';

import {
  CreatePaymentRequest,
  PaymentError,
  PaymentIntent,
  PaymentMethodType,
  PaymentProviderId,
} from '../../domain/models';
import { PaymentStrategy, StrategyContext } from '../../domain/ports';
import { IdempotencyKeyFactory } from '../../shared/idempotency/idempotency-key.factory';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';
import { StartPaymentUseCase } from './start-payment.use-case';

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

  const fallbackOrchestratorMock = {
    reportFailure: vi.fn(() => false), // Por defecto no hay fallback
    notifySuccess: vi.fn(),
    notifyFailure: vi.fn(),
    reset: vi.fn(),
    getSnapshot: vi.fn(() => ({
      status: 'idle',
      failedAttempts: [],
      pendingEvent: null,
      currentProvider: null,
      isAutoFallback: false,
    })),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StartPaymentUseCase,
        { provide: ProviderFactoryRegistry, useValue: registryMock },
        { provide: FallbackOrchestratorService, useValue: fallbackOrchestratorMock },
        IdempotencyKeyFactory,
      ],
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

    it('calls strategy.start with request (with idempotency key) and context', async () => {
      const context: StrategyContext = { returnUrl: 'https://return.com' };
      await firstValueFrom(useCase.execute(req, 'stripe', context));

      expect(strategyMock.start).toHaveBeenCalledTimes(1);
      // The request should have idempotencyKey added
      expect(strategyMock.start).toHaveBeenCalledWith(
        expect.objectContaining({
          ...req,
          idempotencyKey: expect.stringContaining('stripe:start:o1:100:MXN:card'),
        }),
        context,
      );
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

      await expect(firstValueFrom(useCase.execute(req, 'stripe'))).rejects.toThrowError(
        'Registry failed',
      );
    });

    it('propagates errors from providerFactory.createStrategy()', async () => {
      (providerFactoryMock.createStrategy as any).mockImplementationOnce(() => {
        throw new Error('Strategy creation failed');
      });

      await expect(firstValueFrom(useCase.execute(req, 'paypal'))).rejects.toThrowError(
        'Strategy creation failed',
      );
    });

    it('propagates observable errors from strategy.start() when no fallback available', async () => {
      const error: PaymentError = { code: 'provider_error', message: 'boom', raw: {} };

      (strategyMock.start as any).mockReturnValueOnce(throwError(() => error));
      fallbackOrchestratorMock.reportFailure.mockReturnValueOnce(false);

      await expect(firstValueFrom(useCase.execute(req, 'stripe'))).rejects.toThrow('boom');

      expect(fallbackOrchestratorMock.reportFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: 'stripe',
          error,
          request: expect.objectContaining({
            ...req,
            idempotencyKey: expect.stringContaining('stripe:start:o1:100:MXN:card'),
          }),
        }),
      );
    });

    it('calls reportFailure when strategy.start() fails and fallback handles it', async () => {
      const error: PaymentError = { code: 'provider_error', message: 'boom', raw: {} };

      (strategyMock.start as any).mockReturnValueOnce(throwError(() => error));
      fallbackOrchestratorMock.reportFailure.mockReturnValueOnce(true);

      const result = await firstValueFrom(
        useCase.execute(req, 'stripe').pipe(defaultIfEmpty(null)),
      );

      expect(result).toBeNull();
      expect(fallbackOrchestratorMock.reportFailure).toHaveBeenCalled();
    });

    it('throws when providerId is not registered', async () => {
      registryMock.get.mockImplementationOnce((providerId: any) => {
        throw new Error(`Provider factory for "${providerId}" not found.`);
      });

      await expect(firstValueFrom(useCase.execute(req, 'nonExistent' as any))).rejects.toThrowError(
        /Provider factory for "nonExistent" not found/,
      );
    });

    it('does not call createStrategy when registry.get fails', async () => {
      registryMock.get.mockImplementationOnce(() => {
        throw new Error('registry failed');
      });

      await expect(firstValueFrom(useCase.execute(req, 'paypal'))).rejects.toThrowError(
        'registry failed',
      );

      expect(providerFactoryMock.createStrategy).not.toHaveBeenCalled();
      expect(strategyMock.start).not.toHaveBeenCalled();
    });

    it('does not call strategy.start when createStrategy fails', async () => {
      (providerFactoryMock.createStrategy as any).mockImplementationOnce(() => {
        throw new Error('Unsupported method');
      });

      await expect(firstValueFrom(useCase.execute(req, 'stripe'))).rejects.toThrowError(
        'Unsupported method',
      );

      expect(strategyMock.start).not.toHaveBeenCalled();
    });

    it('cuando fallback maneja el fallo debe completar sin emitir valores', async () => {
      const error: PaymentError = { code: 'provider_error', message: 'boom', raw: {} };

      (strategyMock.start as any).mockReturnValueOnce(throwError(() => error));
      fallbackOrchestratorMock.reportFailure.mockReturnValueOnce(true);

      const result = await firstValueFrom(
        useCase.execute(req, 'stripe').pipe(defaultIfEmpty('NO_EMIT')),
      );

      expect(result).toBe('NO_EMIT');
    });

    it('NO debe tragar errores no-domino (unknown)', async () => {
      const error = new Error('weird');

      (strategyMock.start as any).mockReturnValueOnce(throwError(() => error));
      fallbackOrchestratorMock.reportFailure.mockReturnValueOnce(true); // aunque diga true, NO debería usarse

      await expect(firstValueFrom(useCase.execute(req, 'stripe'))).rejects.toThrow('weird');

      expect(fallbackOrchestratorMock.reportFailure).not.toHaveBeenCalled();
    });
  });
});
