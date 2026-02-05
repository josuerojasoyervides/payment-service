import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import {
  createOrderId,
  createPaymentIntentId,
} from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';
import { SpeiStrategy } from '@payments/shared/strategies/spei-strategy';
import { firstValueFrom, of } from 'rxjs';

describe('SpeiStrategy', () => {
  let strategy: SpeiStrategy;
  let gatewayMock: Pick<PaymentGatewayPort, 'createIntent' | 'providerId'>;

  const validReq: CreatePaymentRequest = {
    orderId: createOrderId('order_1'),
    money: { amount: 100, currency: 'MXN' },
    method: { type: 'spei' },
  };

  const intentResponse: PaymentIntent = {
    id: createPaymentIntentId('src_1'),
    provider: 'stripe',
    status: 'requires_action',
    money: { amount: 100, currency: 'MXN' },
    raw: {
      spei: {
        clabe: '646180111812345678',
        reference: '1234567',
        bank: 'STP',
      },
    },
  };

  const displayConfig = {
    receivingBanks: { STP: 'STP (Transfers and Payments System)' },
    beneficiaryName: 'Payment Service',
  };

  const loggerMock = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    gatewayMock = {
      providerId: 'stripe',
      createIntent: vi.fn(() => of(intentResponse)),
    } as any;

    TestBed.configureTestingModule({
      providers: [{ provide: LoggerService, useValue: loggerMock }],
    });

    strategy = new SpeiStrategy(gatewayMock as any, loggerMock as any, displayConfig);
  });

  describe('validate()', () => {
    it('throws if currency is not MXN', () => {
      const req = { ...validReq, money: { amount: 100, currency: 'USD' as const } };
      expect(() => strategy.validate(req)).toThrowError(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: PAYMENT_ERROR_KEYS.INVALID_REQUEST,
        }),
      );
    });

    it('throws if amount is below minimum', () => {
      const req = { ...validReq, money: { amount: 0.5, currency: 'MXN' as const } };
      expect(() => strategy.validate(req)).toThrowError(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: PAYMENT_ERROR_KEYS.MIN_AMOUNT,
        }),
      );
    });

    it('throws if amount exceeds maximum', () => {
      const req = { ...validReq, money: { amount: 10_000_000, currency: 'MXN' as const } };
      expect(() => strategy.validate(req)).toThrowError(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: PAYMENT_ERROR_KEYS.MAX_AMOUNT,
        }),
      );
    });

    it('accepts valid MXN amounts', () => {
      expect(() => strategy.validate(validReq)).not.toThrow();
      expect(() =>
        strategy.validate({ ...validReq, money: { amount: 5_000_000, currency: 'MXN' } }),
      ).not.toThrow();
    });

    it('warns but does not throw if token is provided', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const req = { ...validReq, method: { type: 'spei' as const, token: 'tok_ignored' } };

      expect(() => strategy.validate(req)).not.toThrow();
      expect(loggerMock.warn).toHaveBeenCalledWith(
        'Token provided but will be ignored for SPEI payments',
        'SpeiStrategy',
        expect.objectContaining({ hasToken: true }),
      );
      const meta = loggerMock.warn.mock.calls[0][2] as Record<string, unknown>;
      expect(meta).not.toHaveProperty('token');

      consoleSpy.mockRestore();
    });
  });

  describe('prepare()', () => {
    it('returns prepared request without token', () => {
      const reqWithToken = { ...validReq, method: { type: 'spei' as const, token: 'tok_ignore' } };
      const result = strategy.prepare(reqWithToken);

      expect(result.preparedRequest.method.token).toBeUndefined();
      expect(result.preparedRequest.method.type).toBe('spei');
    });

    it('calculates expiration date (72 hours)', () => {
      const result = strategy.prepare(validReq);
      const expiresAt = new Date(result.metadata['expires_at'] as string);
      const now = new Date();

      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeGreaterThan(71);
      expect(hoursDiff).toBeLessThan(73);
    });

    it('includes metadata for SPEI tracking', () => {
      const result = strategy.prepare(validReq);

      expect(result.metadata['payment_method_type']).toBe('spei');
      expect(result.metadata['requires_polling']).toBe(true);
      expect(result.metadata['payment_concept']).toBeDefined();
    });
  });

  describe('start()', () => {
    it('validates, prepares and calls gateway.createIntent', async () => {
      const result = await firstValueFrom(strategy.start(validReq));

      expect(gatewayMock.createIntent).toHaveBeenCalledTimes(1);
      expect(result.id?.value ?? result.id).toBe('src_1');
    });

    it('throws validation error before calling gateway', () => {
      const invalidReq = { ...validReq, money: { amount: 100, currency: 'USD' as const } };

      // Error is thrown synchronously in start() before returning Observable
      expect(() => strategy.start(invalidReq)).toThrowError(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: PAYMENT_ERROR_KEYS.INVALID_REQUEST,
        }),
      );

      expect(gatewayMock.createIntent).not.toHaveBeenCalled();
    });

    it('enriches intent with SPEI details', async () => {
      const result = await firstValueFrom(strategy.start(validReq));

      expect(result.status).toBe('requires_action');
      const nextAction = result.nextAction;
      expect(nextAction?.kind).toBe('manual_step');
      if (nextAction?.kind !== 'manual_step') {
        throw new Error('Expected manual_step next action');
      }
      expect(nextAction.details).toEqual(
        expect.objectContaining({
          bankCode: 'STP',
          clabe: '646180111812345678',
          beneficiaryName: displayConfig.beneficiaryName,
          amount: 100,
          currency: 'MXN',
        }),
      );
    });

    it('removes token from prepared request', async () => {
      const reqWithToken = { ...validReq, method: { type: 'spei' as const, token: 'tok_ignore' } };

      await firstValueFrom(strategy.start(reqWithToken));

      const calledWith = (gatewayMock.createIntent as any).mock.calls[0][0];
      expect(calledWith.method.token).toBeUndefined();
    });
  });

  describe('requiresUserAction()', () => {
    it('returns true when status is requires_action with spei nextAction', () => {
      const intent: PaymentIntent = {
        ...intentResponse,
        nextAction: {
          kind: 'manual_step',
          details: {
            bankCode: 'STP',
            clabe: '646180111812345678',
            beneficiaryName: displayConfig.beneficiaryName,
          },
        },
      };
      expect(strategy.requiresUserAction(intent)).toBe(true);
    });

    it('returns false for completed payments', () => {
      expect(strategy.requiresUserAction({ ...intentResponse, status: 'succeeded' })).toBe(false);
    });
  });

  describe('SPEI data validation', () => {
    it('throws when gateway response is missing clabe', async () => {
      gatewayMock.createIntent = vi.fn(() =>
        of({
          ...intentResponse,
          raw: { spei: { bank: 'STP', reference: '1234567' } },
        }),
      );

      await expect(firstValueFrom(strategy.start(validReq))).rejects.toMatchObject({
        code: 'provider_error',
        messageKey: PAYMENT_ERROR_KEYS.UNKNOWN_ERROR,
        params: { reason: 'missing_spei_clabe' },
      });
    });

    it('throws when gateway response is missing bank code', async () => {
      gatewayMock.createIntent = vi.fn(() =>
        of({
          ...intentResponse,
          raw: { spei: { clabe: '646180111812345678', reference: '1234567' } },
        }),
      );

      await expect(firstValueFrom(strategy.start(validReq))).rejects.toMatchObject({
        code: 'provider_error',
        messageKey: PAYMENT_ERROR_KEYS.UNKNOWN_ERROR,
        params: { reason: 'missing_spei_bank_code' },
      });
    });

    it('throws when bank code is not in receivingBanks map', async () => {
      gatewayMock.createIntent = vi.fn(() =>
        of({
          ...intentResponse,
          raw: { spei: { clabe: '646180111812345678', reference: '1234567', bank: 'ZZZ' } },
        }),
      );

      await expect(firstValueFrom(strategy.start(validReq))).rejects.toMatchObject({
        code: 'provider_error',
        messageKey: PAYMENT_ERROR_KEYS.UNKNOWN_ERROR,
        params: { reason: 'unknown_spei_bank_code', bankCode: 'ZZZ' },
      });
    });
  });
});
