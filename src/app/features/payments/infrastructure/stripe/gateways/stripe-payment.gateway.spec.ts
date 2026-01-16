import { TestBed } from '@angular/core/testing';
import { StripePaymentGateway } from './stripe-payment.gateway';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CreatePaymentRequest } from '../../../domain/models/payment.types';
import { PaymentError } from '../../../domain/models/payment.errors';

describe('StripePaymentGateway', () => {
    let gateway: StripePaymentGateway;
    let httpMock: HttpTestingController;

    const req: CreatePaymentRequest = {
        orderId: 'order_1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting(), StripePaymentGateway],
        });

        gateway = TestBed.inject(StripePaymentGateway);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('throws synchronously when request is invalid (base validation)', () => {
        expect(() =>
            gateway.createIntent({
                ...req,
                orderId: '',
            })
        ).toThrowError('orderId is required');
    });

    describe('createIntent', () => {
        it('POSTs to /api/payments/stripe/intents and maps the response to PaymentIntent', async () => {
            const promise = firstValueFrom(gateway.createIntent(req));

            const httpReq = httpMock.expectOne('/api/payments/stripe/intents');
            expect(httpReq.request.method).toBe('POST');
            expect(httpReq.request.body).toEqual(req);

            httpReq.flush({
                id: 'pi_123',
                status: 'requires_payment_method',
                amount: 100,
                currency: 'MXN',
                clientSecret: 'sec_test',
                redirectUrl: null,
            });

            const result = await promise;

            expect(result).toEqual(
                expect.objectContaining({
                    id: 'pi_123',
                    provider: 'stripe',
                    status: 'requires_payment_method',
                    amount: 100,
                    currency: 'MXN',
                    clientSecret: 'sec_test',
                })
            );

            expect(result.raw).toBeTruthy();
        });

        it('normalizes Stripe-like errors when HttpClient errors (err.error has code/message)', async () => {
            const promise = firstValueFrom(gateway.createIntent(req));
            const httpReq = httpMock.expectOne('/api/payments/stripe/intents');

            httpReq.flush(
                { code: 'card_declined', message: 'Card declined' },
                { status: 402, statusText: 'Payment Required' }
            );

            try {
                await promise;
                throw new Error('Expected promise to reject');
            } catch (error) {
                const paymentError = error as PaymentError;

                expect(paymentError.code).toBe('card_declined');
                expect(paymentError.message).toBe('Card declined');
                expect((paymentError.raw as any).error.code).toBe('card_declined');
            }
        });

        it('falls back to base normalizeError when error shape is not Stripe-like', async () => {
            const promise = firstValueFrom(gateway.createIntent(req));
            const httpReq = httpMock.expectOne('/api/payments/stripe/intents');

            httpReq.error(new ProgressEvent('error'), {
                status: 0,
                statusText: 'Unknown Error'
            });

            try {
                await promise;
                throw new Error('Expected promise to reject');
            } catch (error) {
                const paymentErr = error as PaymentError;

                expect(paymentErr.code).toBe('provider_error');
                expect(paymentErr.message).toBe('Stripe provider error');
                expect(paymentErr.raw).toBeTruthy();
            }
        });
    });
});
