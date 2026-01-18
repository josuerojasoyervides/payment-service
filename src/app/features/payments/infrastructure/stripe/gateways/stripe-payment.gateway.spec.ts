import { TestBed } from '@angular/core/testing';
import { StripePaymentGateway } from './stripe-payment.gateway';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CreatePaymentRequest } from '../../../domain/models/payment.requests';
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
        it('POSTs to /api/payments/stripe/intents with transformed body', async () => {
            const promise = firstValueFrom(gateway.createIntent(req));

            const httpReq = httpMock.expectOne('/api/payments/stripe/intents');
            expect(httpReq.request.method).toBe('POST');
            // Body is transformed to Stripe format (centavos, lowercase currency, etc.)
            expect(httpReq.request.body.amount).toBe(10000); // 100 * 100 centavos
            expect(httpReq.request.body.currency).toBe('mxn');
            expect(httpReq.request.body.payment_method).toBe('tok_123');

            // Respond with Stripe-like DTO
            httpReq.flush({
                id: 'pi_123',
                object: 'payment_intent',
                status: 'requires_payment_method',
                amount: 10000,
                currency: 'mxn',
                client_secret: 'pi_123_secret_test',
            });

            const result = await promise;

            expect(result).toEqual(
                expect.objectContaining({
                    id: 'pi_123',
                    provider: 'stripe',
                    status: 'requires_payment_method',
                    amount: 100, // Converted back from centavos
                    currency: 'MXN',
                    clientSecret: 'pi_123_secret_test',
                })
            );

            expect(result.raw).toBeTruthy();
        });

        it('normalizes Stripe-like errors with human-readable messages', async () => {
            const promise = firstValueFrom(gateway.createIntent(req));
            const httpReq = httpMock.expectOne('/api/payments/stripe/intents');

            httpReq.flush(
                { error: { type: 'card_error', code: 'card_declined', message: 'Card declined' } },
                { status: 402, statusText: 'Payment Required' }
            );

            try {
                await promise;
                throw new Error('Expected promise to reject');
            } catch (error) {
                const paymentError = error as PaymentError;

                expect(paymentError.code).toBe('card_declined');
                // Message is humanized in Spanish
                expect(paymentError.message).toContain('rechazado');
            }
        });

        it('falls back to generic error message when error shape is not Stripe-like', async () => {
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
                // Generic Spanish message
                expect(paymentErr.message).toContain('Stripe');
                expect(paymentErr.raw).toBeTruthy();
            }
        });
    });
});
