import { TestBed } from '@angular/core/testing';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';
import { StripeIntentFacade } from '@payments/infrastructure/stripe/facades/intent.facade';
import { StripeCancelIntentGateway } from '@payments/infrastructure/stripe/gateways/intent/cancel-intent.gateway';
import { StripeConfirmIntentGateway } from '@payments/infrastructure/stripe/gateways/intent/confirm-intent.gateway';
import { StripeCreateIntentGateway } from '@payments/infrastructure/stripe/gateways/intent/create-intent.gateway';
import { StripeGetIntentGateway } from '@payments/infrastructure/stripe/gateways/intent/get-intent.gateway';
import { of } from 'rxjs';

describe('IntentFacade (adapter)', () => {
  let gateway: StripeIntentFacade;

  // Mocks de operaciones (NO HTTP)
  const createIntentOp = { execute: vi.fn() };
  const confirmIntentOp = { execute: vi.fn() };
  const cancelIntentOp = { execute: vi.fn() };
  const getIntentOp = { execute: vi.fn() };

  const createReq: CreatePaymentRequest = {
    orderId: 'order_1',
    amount: 100,
    currency: 'MXN',
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
        StripeIntentFacade,

        { provide: StripeCreateIntentGateway, useValue: createIntentOp },
        { provide: StripeConfirmIntentGateway, useValue: confirmIntentOp },
        { provide: StripeCancelIntentGateway, useValue: cancelIntentOp },
        { provide: StripeGetIntentGateway, useValue: getIntentOp },
      ],
    });

    gateway = TestBed.inject(StripeIntentFacade);
  });

  it('delegates createIntent to StripeCreateIntentGateway.execute', async () => {
    createIntentOp.execute.mockReturnValue(of({ id: 'pi_1' } as any));

    gateway.createIntent(createReq).subscribe();

    expect(createIntentOp.execute).toHaveBeenCalledTimes(1);
    expect(createIntentOp.execute).toHaveBeenCalledWith(createReq);
  });
  it('delegates confirmIntent to StripeConfirmIntentGateway.execute', async () => {
    confirmIntentOp.execute.mockReturnValue(of({ id: 'pi_1' } as any));

    gateway.confirmIntent(confirmReq).subscribe();

    expect(confirmIntentOp.execute).toHaveBeenCalledTimes(1);
    expect(confirmIntentOp.execute).toHaveBeenCalledWith(confirmReq);
  });
  it('delegates cancelIntent to StripeCancelIntentGateway.execute', async () => {
    cancelIntentOp.execute.mockReturnValue(of({ id: 'pi_1' } as any));

    gateway.cancelIntent(cancelReq).subscribe();

    expect(cancelIntentOp.execute).toHaveBeenCalledTimes(1);
    expect(cancelIntentOp.execute).toHaveBeenCalledWith(cancelReq);
  });
  it('delegates getIntentStatus to StripeGetIntentGateway.execute', async () => {
    getIntentOp.execute.mockReturnValue(of({ id: 'pi_1' } as any));

    gateway.getIntent(getIntentReq).subscribe();

    expect(getIntentOp.execute).toHaveBeenCalledTimes(1);
    expect(getIntentOp.execute).toHaveBeenCalledWith(getIntentReq);
  });
});
