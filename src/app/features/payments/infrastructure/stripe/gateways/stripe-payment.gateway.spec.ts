import { TestBed } from '@angular/core/testing';
import { StripePaymentGateway } from './stripe-payment.gateway';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CreatePaymentRequest, PaymentError } from '../../../domain/models';
import { I18nService } from '@core/i18n';

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
        const i18nMock = {
            t: vi.fn((key: string) => {
                const translations: Record<string, string> = {
                    'errors.card_declined': 'Tu tarjeta fue rechazada. Contacta a tu banco o usa otra tarjeta.',
                    'errors.stripe_error': 'Error procesando el pago con Stripe.',
                    'errors.stripe_unavailable': 'Stripe no está disponible en este momento. Intenta más tarde.',
                    'errors.order_id_required': 'orderId is required',
                    'errors.provider_error': 'Payment provider error',
                };
                return translations[key] || key;
            }),
            setLanguage: vi.fn(),
            getLanguage: vi.fn(() => 'es'),
            has: vi.fn(() => true),
            currentLang: { asReadonly: vi.fn() } as any,
        } as any;

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                StripePaymentGateway,
                { provide: I18nService, useValue: i18nMock },
            ],
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
                expect(paymentError.message).toContain('rechazada');
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
