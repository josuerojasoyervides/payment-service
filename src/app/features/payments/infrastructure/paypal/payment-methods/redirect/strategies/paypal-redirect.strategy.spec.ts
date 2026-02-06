import { TestBed } from '@angular/core/testing';
import { PaypalRedirectStrategy } from '@app/features/payments/infrastructure/paypal/payment-methods/redirect/strategies/paypal-redirect.strategy';
import { LoggerService } from '@core/logging';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import {
  createOrderId,
  createPaymentIntentId,
} from '@payments/application/api/testing/vo-test-helpers';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import {
  TEST_PAYMENTS_CANCEL_URL,
  TEST_PAYMENTS_RETURN_URL,
} from '@payments/shared/testing/fixtures/test-urls';
import { firstValueFrom, of } from 'rxjs';

describe('PaypalRedirectStrategy', () => {
  let strategy: PaypalRedirectStrategy;

  let gatewayMock: Pick<PaymentGatewayPort, 'createIntent' | 'providerId'>;

  const req: CreatePaymentRequest = {
    orderId: createOrderId('order_1'),
    money: { amount: 100, currency: 'MXN' },
    method: { type: 'card', token: 'tok_123' },
    idempotencyKey: 'idem_paypal_redirect',
  };

  const context = {
    returnUrl: TEST_PAYMENTS_RETURN_URL,
    cancelUrl: TEST_PAYMENTS_CANCEL_URL,
    isTest: true,
  };

  const loggerMock = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  beforeEach(() => {
    gatewayMock = {
      providerId: PAYMENT_PROVIDER_IDS.paypal,
      createIntent: vi.fn(() =>
        of({
          id: createPaymentIntentId('pi_1'),
          provider: PAYMENT_PROVIDER_IDS.paypal,
          status: 'requires_payment_method',
          money: { amount: 100, currency: 'MXN' },
        }),
      ),
    } as any;

    TestBed.configureTestingModule({
      providers: [{ provide: LoggerService, useValue: loggerMock }],
    });

    strategy = new PaypalRedirectStrategy(gatewayMock as any, loggerMock as any, {
      brand_name: 'Payment Service',
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW',
    });
  });

  it('delegates to gateway.createIntent(req)', async () => {
    const result = await firstValueFrom(strategy.start(req, context));

    expect(gatewayMock.createIntent).toHaveBeenCalledTimes(1);

    // PayPal strategy removes token from request and adds returnUrl/cancelUrl from context
    expect(gatewayMock.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: req.orderId,
        money: req.money,
        method: { type: 'card' }, // Token removed
        returnUrl: context.returnUrl,
        cancelUrl: context.cancelUrl,
      }),
    );

    expect(result.id?.value ?? result.id).toBe('pi_1');
  });

  it('warns without logging token when token is provided', () => {
    expect(() => strategy.validate(req)).not.toThrow();
    expect(loggerMock.warn).toHaveBeenCalled();
    const meta = loggerMock.warn.mock.calls.at(-1)?.[2] as Record<string, unknown>;
    expect(meta).toEqual(expect.objectContaining({ hasToken: true }));
    expect(meta).not.toHaveProperty('token');
  });
});
