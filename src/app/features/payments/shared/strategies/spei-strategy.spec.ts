import { TestBed } from '@angular/core/testing';
import { I18nKeys } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { NextActionSpei } from '@payments/domain/models/payment/payment-action.types';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { firstValueFrom, of } from 'rxjs';

import { PaymentGatewayPort } from '../../application/ports/payment-gateway.port';
import { SpeiStrategy } from './spei-strategy';

describe('SpeiStrategy', () => {
  let strategy: SpeiStrategy;
  let gatewayMock: Pick<PaymentGatewayPort, 'createIntent' | 'providerId'>;

  const validReq: CreatePaymentRequest = {
    orderId: 'order_1',
    amount: 100,
    currency: 'MXN',
    method: { type: 'spei' },
  };

  const intentResponse: PaymentIntent = {
    id: 'src_1',
    provider: 'stripe',
    status: 'requires_action',
    amount: 100,
    currency: 'MXN',
    raw: {
      spei: {
        clabe: '646180111812345678',
        reference: '1234567',
        bank: 'STP',
      },
    },
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

    strategy = new SpeiStrategy(gatewayMock as any, loggerMock as any);
  });

  describe('validate()', () => {
    it('throws if currency is not MXN', () => {
      const req = { ...validReq, currency: 'USD' as const };
      expect(() => strategy.validate(req)).toThrowError(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.invalid_request,
        }),
      );
    });

    it('throws if amount is below minimum', () => {
      const req = { ...validReq, amount: 0.5 };
      expect(() => strategy.validate(req)).toThrowError(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.min_amount,
        }),
      );
    });

    it('throws if amount exceeds maximum', () => {
      const req = { ...validReq, amount: 10_000_000 };
      expect(() => strategy.validate(req)).toThrowError(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.max_amount,
        }),
      );
    });

    it('accepts valid MXN amounts', () => {
      expect(() => strategy.validate(validReq)).not.toThrow();
      expect(() => strategy.validate({ ...validReq, amount: 5_000_000 })).not.toThrow();
    });

    it('warns but does not throw if token is provided', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const req = { ...validReq, method: { type: 'spei' as const, token: 'tok_ignored' } };

      expect(() => strategy.validate(req)).not.toThrow();
      expect(loggerMock.warn).toHaveBeenCalledWith(
        'Token provided but will be ignored for SPEI payments',
        'SpeiStrategy',
        { token: 'tok_ignored' },
      );

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
      expect(result.id).toBe('src_1');
    });

    it('throws validation error before calling gateway', () => {
      const invalidReq = { ...validReq, currency: 'USD' as const };

      // Error is thrown synchronously in start() before returning Observable
      expect(() => strategy.start(invalidReq)).toThrowError(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: I18nKeys.errors.invalid_request,
        }),
      );

      expect(gatewayMock.createIntent).not.toHaveBeenCalled();
    });

    it('enriches intent with SPEI instructions', async () => {
      const result = await firstValueFrom(strategy.start(validReq));

      expect(result.status).toBe('requires_action');
      expect(result.nextAction?.type).toBe('spei');

      const speiAction = result.nextAction as NextActionSpei;
      expect(speiAction.clabe).toBeDefined();
      expect(speiAction.reference).toBeDefined();
      expect(speiAction.bank).toBeDefined();
      expect(speiAction.expiresAt).toBeDefined();
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
          type: 'spei',
          instructions: 'Transfer',
          clabe: '123',
          reference: '456',
          bank: 'STP',
          beneficiary: 'Test',
          amount: 100,
          currency: 'MXN',
          expiresAt: new Date().toISOString(),
        },
      };
      expect(strategy.requiresUserAction(intent)).toBe(true);
    });

    it('returns false for completed payments', () => {
      expect(strategy.requiresUserAction({ ...intentResponse, status: 'succeeded' })).toBe(false);
    });
  });

  describe('getUserInstructions()', () => {
    it('returns detailed SPEI instructions', () => {
      const intent: PaymentIntent = {
        ...intentResponse,
        nextAction: {
          type: 'spei',
          instructions: 'Transfer',
          clabe: '646180111812345678',
          reference: '1234567',
          bank: 'STP',
          beneficiary: 'Test Company',
          amount: 100,
          currency: 'MXN',
          expiresAt: new Date().toISOString(),
        },
      };

      const instructions = strategy.getUserInstructions(intent);

      expect(instructions).toContain('ui.spei_instructions_title');
      expect(instructions).toContain('ui.spei_step_1');
      expect(instructions).toContain('ui.spei_deadline');

      expect(instructions).toContain('100');
      expect(instructions).toContain('646180111812345678');
      expect(instructions).toContain('1234567');
    });

    it('returns null when not a SPEI intent', () => {
      const intent: PaymentIntent = { ...intentResponse, nextAction: undefined };
      expect(strategy.getUserInstructions(intent)).toBeNull();
    });
  });
});
