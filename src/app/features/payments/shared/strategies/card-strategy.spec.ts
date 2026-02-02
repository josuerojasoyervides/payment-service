import { TestBed } from '@angular/core/testing';
import type { TokenValidator } from '@app/features/payments/domain/subdomains/payment/ports/token-validator/token-validator.port';
import { LoggerService } from '@core/logging';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';
import { CardStrategy } from '@payments/shared/strategies/card-strategy';
import { firstValueFrom, of } from 'rxjs';

describe('CardStrategy', () => {
  let strategy: CardStrategy;
  let gatewayMock: Pick<PaymentGatewayPort, 'createIntent' | 'providerId'>;
  let tokenValidatorMock: TokenValidator;

  const validToken = 'tok_test1234567890abc';

  const validReq: CreatePaymentRequest = {
    orderId: 'order_1',
    amount: 100,
    currency: 'MXN',
    method: { type: 'card', token: validToken },
  };

  const intentResponse: PaymentIntent = {
    id: 'pi_1',
    provider: 'stripe',
    status: 'requires_payment_method',
    amount: 100,
    currency: 'MXN',
  };

  const loggerMock = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  beforeEach(() => {
    gatewayMock = {
      providerId: 'stripe',
      createIntent: vi.fn(() => of(intentResponse)),
    } as any;

    // Mock de TokenValidator que valida formato
    tokenValidatorMock = {
      requiresToken: vi.fn(() => true),
      validate: vi.fn((token: string) => {
        if (!token) throw new Error('Card token is required for card payments');
        if (!/^(tok_|pm_|card_)[a-zA-Z0-9]+$/.test(token)) {
          throw new Error('Invalid card token format');
        }
      }),
      isValid: vi.fn((token: string) => /^(tok_|pm_|card_)[a-zA-Z0-9]+$/.test(token)),
      getAcceptedPatterns: vi.fn(() => ['tok_*', 'pm_*', 'card_*']),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: LoggerService, useValue: loggerMock }],
    });

    strategy = new CardStrategy(gatewayMock as any, tokenValidatorMock, loggerMock as any);
  });

  describe('validate()', () => {
    it('throws if token is missing', () => {
      const req = { ...validReq, method: { type: 'card' as const } };
      expect(() => strategy.validate(req)).toThrowError(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: PAYMENT_ERROR_KEYS.CARD_TOKEN_REQUIRED,
        }),
      );
    });

    it('throws if token has invalid format', () => {
      const req = { ...validReq, method: { type: 'card' as const, token: 'invalid_token' } };
      expect(() => strategy.validate(req)).toThrowError(/Invalid card token format/);
    });

    it('accepts valid token formats (tok_, pm_, card_)', () => {
      expect(() =>
        strategy.validate({ ...validReq, method: { type: 'card', token: 'tok_test1234567890' } }),
      ).not.toThrow();
      expect(() =>
        strategy.validate({ ...validReq, method: { type: 'card', token: 'pm_test1234567890x' } }),
      ).not.toThrow();
      expect(() =>
        strategy.validate({ ...validReq, method: { type: 'card', token: 'card_test123456789' } }),
      ).not.toThrow();
    });

    it('throws if amount is below minimum for MXN', () => {
      const req = { ...validReq, amount: 5, currency: 'MXN' as const };
      expect(() => strategy.validate(req)).toThrowError(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: PAYMENT_ERROR_KEYS.MIN_AMOUNT,
        }),
      );
    });

    it('throws if amount is below minimum for USD', () => {
      const req = { ...validReq, amount: 0.5, currency: 'USD' as const };
      expect(() => strategy.validate(req)).toThrowError(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: PAYMENT_ERROR_KEYS.MIN_AMOUNT,
        }),
      );
    });
  });

  describe('prepare()', () => {
    it('returns prepared request and metadata', () => {
      const result = strategy.prepare(validReq);

      expect(result.preparedRequest).toEqual(validReq);
      expect(result.metadata['payment_method_type']).toBe('card');
      expect(result.metadata['is_saved_card']).toBe(false);
      expect(result.metadata['timestamp']).toBeDefined();
    });

    it('detects saved cards (pm_ prefix)', () => {
      const req = { ...validReq, method: { type: 'card' as const, token: 'pm_saved12345678901' } };
      const result = strategy.prepare(req);

      expect(result.metadata['is_saved_card']).toBe(true);
      expect(result.metadata['requires_sca']).toBe(true);
    });

    it('includes return_url from context', () => {
      const result = strategy.prepare(validReq, { returnUrl: 'https://example.com/return' });
      expect(result.metadata['return_url']).toBe('https://example.com/return');
    });

    it('includes device data when provided', () => {
      const result = strategy.prepare(validReq, {
        deviceData: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          screenWidth: 1920,
          screenHeight: 1080,
        },
      });

      expect(result.metadata['device_ip']).toBe('192.168.1.1');
      expect(result.metadata['device_user_agent']).toBe('Mozilla/5.0');
      expect(result.metadata['device_screen']).toBe('1920x1080');
    });
  });

  describe('start()', () => {
    it('validates, prepares and calls gateway.createIntent', async () => {
      const result = await firstValueFrom(strategy.start(validReq));

      expect(gatewayMock.createIntent).toHaveBeenCalledTimes(1);
      expect(gatewayMock.createIntent).toHaveBeenCalledWith(validReq);
      expect(result.id).toBe('pi_1');
    });

    it('throws validation error before calling gateway', () => {
      const invalidReq = { ...validReq, method: { type: 'card' as const } };

      // Error is thrown synchronously in start() before returning Observable
      expect(() => strategy.start(invalidReq)).toThrowError(
        expect.objectContaining({
          code: 'invalid_request',
          messageKey: PAYMENT_ERROR_KEYS.CARD_TOKEN_REQUIRED,
        }),
      );

      expect(gatewayMock.createIntent).not.toHaveBeenCalled();
    });

    it('enriches intent with 3DS info when requires_action', async () => {
      const intentWith3ds: PaymentIntent = {
        ...intentResponse,
        status: 'requires_action',
        clientSecret: 'pi_secret_123',
      };
      (gatewayMock.createIntent as any).mockReturnValueOnce(of(intentWith3ds));

      const result = await firstValueFrom(
        strategy.start(validReq, { returnUrl: 'https://return.com' }),
      );

      expect(result.nextAction?.kind).toBe('client_confirm');
      expect((result.nextAction as any)?.token).toBe('pi_secret_123');
      expect((result.nextAction as any)?.returnUrl).toBe('https://return.com');
    });
  });

  describe('requiresUserAction()', () => {
    it('returns true when status is requires_action with 3ds', () => {
      const intent: PaymentIntent = {
        ...intentResponse,
        status: 'requires_action',
        nextAction: { kind: 'client_confirm', token: 'secret', returnUrl: '' },
      };
      expect(strategy.requiresUserAction(intent)).toBe(true);
    });

    it('returns false for other statuses', () => {
      expect(strategy.requiresUserAction({ ...intentResponse, status: 'succeeded' })).toBe(false);
      expect(strategy.requiresUserAction({ ...intentResponse, status: 'processing' })).toBe(false);
    });
  });

  describe('getUserInstructions()', () => {
    it('returns instructions when 3DS is required', () => {
      const intent: PaymentIntent = {
        ...intentResponse,
        status: 'requires_action',
        nextAction: { kind: 'client_confirm', token: 'secret', returnUrl: '' },
      };
      const instructions = strategy.getUserInstructions(intent);
      expect(instructions).toEqual(['messages.bank_verification_required']);
    });

    it('returns null when no action required', () => {
      expect(strategy.getUserInstructions(intentResponse)).toBeNull();
    });
  });
});
