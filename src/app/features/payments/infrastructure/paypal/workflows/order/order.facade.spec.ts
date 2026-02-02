import { TestBed } from '@angular/core/testing';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/subdomains/payment/messages/payment-request.command';
import { PaypalCancelIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/cancel-intent.gateway';
import { PaypalConfirmIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/confirm-intent.gateway';
import { PaypalCreateIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/create-intent.gateway';
import { PaypalGetIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/get-intent.gateway';
import { PaypalIntentFacade } from '@payments/infrastructure/paypal/workflows/order/order.facade';
import { of } from 'rxjs';

describe('IntentFacade (adapter)', () => {
  let gateway: PaypalIntentFacade;

  // Operation mocks (NO HTTP)
  const createIntentOp = { execute: vi.fn() };
  const confirmIntentOp = { execute: vi.fn() };
  const cancelIntentOp = { execute: vi.fn() };
  const getIntentOp = { execute: vi.fn() };

  const createReq: CreatePaymentRequest = {
    orderId: 'order_1',
    money: { amount: 100, currency: 'MXN' },
    method: { type: 'card', token: 'tok_123' },
  };

  const confirmReq: ConfirmPaymentRequest = {
    intentId: 'pi_1',
    returnUrl: 'https://example.com/return',
  };

  const cancelReq: CancelPaymentRequest = {
    intentId: 'pi_1',
  };

  const getIntentReq: GetPaymentStatusRequest = {
    intentId: 'pi_1',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PaypalIntentFacade,

        { provide: PaypalCreateIntentGateway, useValue: createIntentOp },
        { provide: PaypalConfirmIntentGateway, useValue: confirmIntentOp },
        { provide: PaypalCancelIntentGateway, useValue: cancelIntentOp },
        { provide: PaypalGetIntentGateway, useValue: getIntentOp },
      ],
    });

    gateway = TestBed.inject(PaypalIntentFacade);
  });

  it('delegates createIntent to PaypalCreateIntentGateway.execute', async () => {
    createIntentOp.execute.mockReturnValue(of({ id: 'pi_1' } as any));

    gateway.createIntent(createReq).subscribe();

    expect(createIntentOp.execute).toHaveBeenCalledTimes(1);
    expect(createIntentOp.execute).toHaveBeenCalledWith(createReq);
  });
  it('delegates confirmIntent to PaypalConfirmIntentGateway.execute', async () => {
    confirmIntentOp.execute.mockReturnValue(of({ id: 'pi_1' } as any));

    gateway.confirmIntent(confirmReq).subscribe();

    expect(confirmIntentOp.execute).toHaveBeenCalledTimes(1);
    expect(confirmIntentOp.execute).toHaveBeenCalledWith(confirmReq);
  });
  it('delegates cancelIntent to PaypalCancelIntentGateway.execute', async () => {
    cancelIntentOp.execute.mockReturnValue(of({ id: 'pi_1' } as any));

    gateway.cancelIntent(cancelReq).subscribe();

    expect(cancelIntentOp.execute).toHaveBeenCalledTimes(1);
    expect(cancelIntentOp.execute).toHaveBeenCalledWith(cancelReq);
  });
  it('delegates getIntentStatus to PaypalGetIntentGateway.execute', async () => {
    getIntentOp.execute.mockReturnValue(of({ id: 'pi_1' } as any));

    gateway.getIntent(getIntentReq).subscribe();

    expect(getIntentOp.execute).toHaveBeenCalledTimes(1);
    expect(getIntentOp.execute).toHaveBeenCalledWith(getIntentReq);
  });
});
