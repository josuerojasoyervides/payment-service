import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { StripePaymentGateway } from './stripe-payment.gateway';
import { StripeCreateIntentGateway } from './intent/create-intent.gateway';
import { StripeConfirmIntentGateway } from './intent/confirm-intent.gateway';
import { StripeCancelIntentGateway } from './intent/cancel-intent.gateway';
import { StripeGetIntentGateway } from './intent/get-intent.gateway';

import { CreatePaymentRequest } from '@payments/domain/models';

describe('StripePaymentGateway (adapter)', () => {
    let gateway: StripePaymentGateway;

    // Mocks de operaciones (NO HTTP)
    const createIntentOp = { execute: vi.fn() };
    const confirmIntentOp = { execute: vi.fn() };
    const cancelIntentOp = { execute: vi.fn() };
    const getIntentOp = { execute: vi.fn() };

    const req: CreatePaymentRequest = {
        orderId: 'order_1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                StripePaymentGateway,

                { provide: StripeCreateIntentGateway, useValue: createIntentOp },
                { provide: StripeConfirmIntentGateway, useValue: confirmIntentOp },
                { provide: StripeCancelIntentGateway, useValue: cancelIntentOp },
                { provide: StripeGetIntentGateway, useValue: getIntentOp },
            ],
        });

        gateway = TestBed.inject(StripePaymentGateway);
    });

    it('delegates createIntent to StripeCreateIntentGateway.execute', async () => {
        createIntentOp.execute.mockReturnValue(of({ id: 'pi_1' } as any));

        gateway.createIntent(req).subscribe();

        expect(createIntentOp.execute).toHaveBeenCalledTimes(1);
        expect(createIntentOp.execute).toHaveBeenCalledWith(req);
    });
});
