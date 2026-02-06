import { TestBed } from '@angular/core/testing';
import { ProviderMethodPolicyRegistry } from '@app/features/payments/application/orchestration/registry/provider-method-policy/provider-method-policy.registry';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type {
  PaymentStrategy,
  StrategyContext,
} from '@payments/application/api/ports/payment-strategy.port';
import {
  createOrderId,
  createPaymentIntentId,
} from '@payments/application/api/testing/vo-test-helpers';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import { StartPaymentUseCase } from '@payments/application/orchestration/use-cases/intent/start-payment.use-case';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { firstValueFrom, of, throwError } from 'rxjs';

describe('StartPaymentUseCase', () => {
  let useCase: StartPaymentUseCase;

  const req: CreatePaymentRequest = {
    orderId: createOrderId('o1'),
    money: { amount: 100, currency: 'MXN' },
    method: { type: 'card', token: 'tok_123' },
  };

  const intentResponse: PaymentIntent = {
    id: createPaymentIntentId('pi_1'),
    provider: 'stripe',
    status: 'requires_payment_method',
    money: { amount: 100, currency: 'MXN' },
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
  const policyRegistryMock = {
    getPolicy: vi.fn(() => ({
      providerId: 'stripe',
      method: 'card',
      requires: { token: true },
      flow: { usesRedirect: false, requiresUserAction: true, supportsPolling: true },
      stages: { authorize: true, capture: true, settle: true },
    })),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StartPaymentUseCase,
        { provide: ProviderFactoryRegistry, useValue: registryMock },
        { provide: ProviderMethodPolicyRegistry, useValue: policyRegistryMock },
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
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-06T00:00:00Z'));
      const context: StrategyContext = { returnUrl: 'https://return.com', flowId: 'flow_test' };
      await firstValueFrom(useCase.execute(req, 'stripe', context));

      expect(strategyMock.start).toHaveBeenCalledTimes(1);
      // The request should have idempotencyKey added
      expect(strategyMock.start).toHaveBeenCalledWith(
        expect.objectContaining({
          ...req,
          idempotencyKey: 'flow_test:o1:stripe:1770336000000',
        }),
        context,
      );
      vi.useRealTimers();
    });

    it('returns the PaymentIntent from strategy.start', async () => {
      const result = await firstValueFrom(useCase.execute(req, 'stripe'));

      expect(result.id?.value ?? result.id).toBe('pi_1');
      expect(result.provider).toBe('stripe');
    });

    it('works with different providers', async () => {
      await firstValueFrom(useCase.execute(req, 'paypal'));

      expect(registryMock.get).toHaveBeenCalledWith('paypal');
    });
  });

  describe('error handling', () => {
    it('throws when token is required by policy but missing', async () => {
      policyRegistryMock.getPolicy.mockReturnValueOnce({
        providerId: 'stripe',
        method: 'card',
        requires: { token: true },
        flow: { usesRedirect: false, requiresUserAction: true, supportsPolling: true },
        stages: { authorize: true, capture: true, settle: true },
      });

      const reqMissingToken: CreatePaymentRequest = {
        ...req,
        method: { type: 'card' },
      };

      await expect(
        firstValueFrom(useCase.execute(reqMissingToken, 'stripe')),
      ).rejects.toMatchObject({
        code: 'invalid_request',
        messageKey: 'errors.card_token_required',
      });
    });

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

    it('propagates the error when strategy.start() fails (fallback is handled by the Store)', async () => {
      const error: PaymentError = {
        code: 'provider_error',
        messageKey: 'errors.provider_error',
        raw: {},
      };

      (strategyMock.start as any).mockReturnValueOnce(throwError(() => error));

      await expect(firstValueFrom(useCase.execute(req, 'stripe'))).rejects.toEqual(error);
    });

    it('propagates non-domain errors from strategy.start()', async () => {
      const error = new Error('weird');

      (strategyMock.start as any).mockReturnValueOnce(throwError(() => error));

      await expect(firstValueFrom(useCase.execute(req, 'stripe'))).rejects.toThrow('weird');
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
  });
});
