import { TestBed } from '@angular/core/testing';
import {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';
import { of } from 'rxjs';

import { StripeCancelIntentGateway } from './cancel-intent.gateway';
import { StripeConfirmIntentGateway } from './confirm-intent.gateway';
import { StripeCreateIntentGateway } from './create-intent.gateway';
import { StripeGetIntentGateway } from './get-intent.gateway';
import { IntentFacade } from './intent.facade';

describe('IntentFacade (adapter)', () => {
  let gateway: IntentFacade;

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
        IntentFacade,

        { provide: StripeCreateIntentGateway, useValue: createIntentOp },
        { provide: StripeConfirmIntentGateway, useValue: confirmIntentOp },
        { provide: StripeCancelIntentGateway, useValue: cancelIntentOp },
        { provide: StripeGetIntentGateway, useValue: getIntentOp },
      ],
    });

    gateway = TestBed.inject(IntentFacade);
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
