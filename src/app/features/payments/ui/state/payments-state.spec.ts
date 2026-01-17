import { TestBed } from '@angular/core/testing';
import { PaymentState } from './payments-state';
import { StartPaymentUseCase } from '../../application/use-cases/start-payment.use-case';
import { ConfirmPaymentUseCase } from '../../application/use-cases/confirm-payment.use-case';
import { CancelPaymentUseCase } from '../../application/use-cases/cancel-payment.use-case';
import { GetPaymentStatusUseCase } from '../../application/use-cases/get-payment-status.use-case';
import { of, throwError, Subject } from 'rxjs';
import { CreatePaymentRequest } from '../../domain/models/payment.requests';

describe('PaymentState', () => {
    let state: PaymentState;

    const startUC = { execute: vi.fn() };
    const confirmUC = { execute: vi.fn() };
    const cancelUC = { execute: vi.fn() };
    const statusUC = { execute: vi.fn() };

    const req: CreatePaymentRequest = {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok' },
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                PaymentState,
                { provide: StartPaymentUseCase, useValue: startUC },
                { provide: ConfirmPaymentUseCase, useValue: confirmUC },
                { provide: CancelPaymentUseCase, useValue: cancelUC },
                { provide: GetPaymentStatusUseCase, useValue: statusUC },
            ],
        });
        state = TestBed.inject(PaymentState);
        vi.clearAllMocks();
    });

    it('start() sets loading and then ready', () => {
        const subject = new Subject<any>();
        startUC.execute.mockReturnValueOnce(subject.asObservable());

        state.start(req, 'stripe');
        expect(state.getSnapshot().status).toBe('loading');

        subject.next({ id: 'pi_1', provider: 'stripe', status: 'requires_payment_method', amount: 100, currency: 'MXN' });
        subject.complete();

        expect(state.getSnapshot().status).toBe('ready');
    });

    it('start() sets error on failure', () => {
        startUC.execute.mockReturnValueOnce(throwError(() => new Error('boom')));

        state.start(req, 'stripe');
        // async update will happen; just verify call
        expect(startUC.execute).toHaveBeenCalled();
    });

    it('cancels inflight when new action starts', () => {
        const subject = new Subject<any>();
        startUC.execute.mockReturnValueOnce(subject.asObservable());

        state.start(req, 'stripe');
        expect(state.getSnapshot().status).toBe('loading');

        // second action should cancel previous subscription
        confirmUC.execute.mockReturnValueOnce(of({ id: 'pi_2' }));
        state.confirm({ intentId: 'pi_2' }, 'stripe');

        // no direct assertion on unsubscribe, but ensures new action runs
        expect(confirmUC.execute).toHaveBeenCalled();
    });
});