import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { PaypalRedirectStrategy } from '@payments/infrastructure/paypal/methods/redirect/strategies/paypal-redirect.strategy';
import { firstValueFrom, of } from 'rxjs';

describe('PaypalRedirectStrategy', () => {
  let strategy: PaypalRedirectStrategy;

  let gatewayMock: Pick<PaymentGatewayPort, 'createIntent' | 'providerId'>;

  const req: CreatePaymentRequest = {
    orderId: 'order_1',
    amount: 100,
    currency: 'MXN',
    method: { type: 'card', token: 'tok_123' },
  };

  const context = {
    returnUrl: 'https://example.com/payments/return',
    cancelUrl: 'https://example.com/payments/cancel',
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
      providerId: 'paypal',
      createIntent: vi.fn(() =>
        of({
          id: 'pi_1',
          provider: 'paypal',
          status: 'requires_payment_method',
          amount: 100,
          currency: 'MXN',
        }),
      ),
    } as any;

    TestBed.configureTestingModule({
      providers: [{ provide: LoggerService, useValue: loggerMock }],
    });

    strategy = new PaypalRedirectStrategy(gatewayMock as any, loggerMock as any);
  });

  it('delegates to gateway.createIntent(req)', async () => {
    const result = await firstValueFrom(strategy.start(req, context));

    expect(gatewayMock.createIntent).toHaveBeenCalledTimes(1);

    // PayPal strategy removes token from request and adds returnUrl/cancelUrl from context
    expect(gatewayMock.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: req.orderId,
        amount: req.amount,
        currency: req.currency,
        method: { type: 'card' }, // Token removed
        returnUrl: context.returnUrl,
        cancelUrl: context.cancelUrl,
      }),
    );

    expect(result.id).toBe('pi_1');
  });
});
