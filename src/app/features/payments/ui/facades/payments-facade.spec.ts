import { TestBed } from '@angular/core/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { PaymentsFacade } from './payments-facade';
import { StartPaymentUseCase } from '../../application/use-cases/start-payment.use-case';
import { PaymentIntent } from '../../domain/models/payment.types';
import { CreatePaymentRequest } from '../../domain/models/payment.requests';

describe('PaymentsFacade', () => {
    let facade: PaymentsFacade;

    const req: CreatePaymentRequest = {
        orderId: 'order_1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
    };

    const intent: PaymentIntent = {
        id: 'pi_1',
        provider: 'stripe',
        status: 'requires_payment_method',
        amount: 100,
        currency: 'MXN',
    };

    const startPaymentUseCaseMock = {
        execute: vi.fn(),
    } satisfies Pick<StartPaymentUseCase, 'execute'>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                PaymentsFacade,
                { provide: StartPaymentUseCase, useValue: startPaymentUseCaseMock },
            ],
        });

        facade = TestBed.inject(PaymentsFacade);
        vi.clearAllMocks();
    });

    it('starts with idle state', () => {
        expect(facade.state()).toEqual({ status: 'idle' });
        expect(facade.isLoading()).toBe(false);
        expect(facade.intent()).toBeNull();
        expect(facade.error()).toBeNull();
    });

    it('sets loading immediately when start() is called', () => {
        // Observable que no emite inmediatamente (para ver loading sostenido)
        // Nota: of() emite sync; acá usamos un observable que nunca emite
        startPaymentUseCaseMock.execute.mockReturnValueOnce({
            subscribe: vi.fn(), // hack mínimo para simular "no emite"
        } as any);

        facade.start(req);

        expect(facade.state()).toEqual({ status: 'loading' });
        expect(facade.isLoading()).toBe(true);
        expect(facade.intent()).toBeNull();
        expect(facade.error()).toBeNull();

        expect(startPaymentUseCaseMock.execute).toHaveBeenCalledTimes(1);
        expect(startPaymentUseCaseMock.execute).toHaveBeenCalledWith(req, undefined);
    });

    it('transitions to success when StartPaymentUseCase emits PaymentIntent', () => {
        startPaymentUseCaseMock.execute.mockReturnValueOnce(of(intent));

        facade.start(req);

        expect(facade.state()).toEqual({ status: 'success', intent });
        expect(facade.isLoading()).toBe(false);
        expect(facade.intent()).toEqual(intent);
        expect(facade.error()).toBeNull();

        expect(startPaymentUseCaseMock.execute).toHaveBeenCalledWith(req, undefined);
    });

    it('passes providerId to StartPaymentUseCase when provided', () => {
        startPaymentUseCaseMock.execute.mockReturnValueOnce(of(intent));

        facade.start(req, 'paypal');

        expect(startPaymentUseCaseMock.execute).toHaveBeenCalledWith(req, 'paypal');
        expect(facade.state().status).toBe('success');
    });

    it('transitions to error when StartPaymentUseCase errors', () => {
        const boom = new Error('boom');
        startPaymentUseCaseMock.execute.mockReturnValueOnce(
            throwError(() => boom)
        );

        facade.start(req);

        expect(facade.state()).toEqual({ status: 'error', error: boom });
        expect(facade.isLoading()).toBe(false);
        expect(facade.intent()).toBeNull();
        expect(facade.error()).toBe(boom);
    });

    it('reset() returns to idle state', () => {
        startPaymentUseCaseMock.execute.mockReturnValueOnce(of(intent));

        facade.start(req);
        expect(facade.state().status).toBe('success');

        facade.reset();

        expect(facade.state()).toEqual({ status: 'idle' });
        expect(facade.isLoading()).toBe(false);
        expect(facade.intent()).toBeNull();
        expect(facade.error()).toBeNull();
    });

    it('start() overrides previous success state', () => {
        startPaymentUseCaseMock.execute.mockReturnValueOnce(of(intent));

        facade.start(req);
        expect(facade.state().status).toBe('success');

        const intent2: PaymentIntent = { ...intent, id: 'pi_2' };
        startPaymentUseCaseMock.execute.mockReturnValueOnce(of(intent2));

        facade.start(req);

        expect(facade.state()).toEqual({ status: 'success', intent: intent2 });
        expect(facade.intent()?.id).toBe('pi_2');
    });

    it('start() overrides previous error state', () => {
        startPaymentUseCaseMock.execute.mockReturnValueOnce(
            throwError(() => new Error('first'))
        );

        facade.start(req);
        expect(facade.state().status).toBe('error');

        startPaymentUseCaseMock.execute.mockReturnValueOnce(of(intent));

        facade.start(req);

        expect(facade.state().status).toBe('success');
        expect(facade.intent()?.id).toBe('pi_1');
    });
});
