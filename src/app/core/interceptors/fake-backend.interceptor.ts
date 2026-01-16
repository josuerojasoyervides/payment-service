import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError, delay } from 'rxjs';

@Injectable()
export class FakePaymentsBackendInterceptor implements HttpInterceptor {
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        // ✅ Interceptamos solo lo que nos interesa
        if (req.method === 'POST' && req.url === '/api/payments/stripe/intents') {
            return this.fakeStripeIntent(req.body);
        }

        if (req.method === 'POST' && req.url === '/api/payments/paypal/intents') {
            return this.fakePaypalIntent(req.body);
        }

        // lo demás pasa normal
        return next.handle(req);
    }

    private fakeStripeIntent(body: any): Observable<HttpEvent<any>> {
        // Simula respuestas distintas según el método
        const method = body?.method?.type;

        // 🔥 ejemplo: forzar un error si token = "declined"
        if (method === 'card' && body?.method?.token === 'declined') {
            return throwError(() => ({
                error: { code: 'card_declined', message: 'Card was declined (fake)' },
                status: 402,
            }));
        }

        const response = {
            id: 'pi_fake_stripe_1',
            status: method === 'card' ? 'requires_confirmation' : 'requires_action',
            amount: body.amount,
            currency: body.currency,
            clientSecret: 'sec_fake_stripe',
            redirectUrl: method === 'spei' ? 'https://fake-bank/redirect' : null,
        };

        return of(new HttpResponse({ status: 200, body: response })).pipe(delay(250));
    }

    private fakePaypalIntent(body: any): Observable<HttpEvent<any>> {
        const method = body?.method?.type;

        // PayPal típico: redirect flow
        const response = {
            id: 'pi_fake_paypal_1',
            status: 'requires_action',
            amount: body.amount,
            currency: body.currency,
            clientSecret: null,
            redirectUrl: 'https://paypal.fake/approve',
        };

        // ejemplo: PayPal no soporta spei
        if (method === 'spei') {
            return throwError(() => ({
                error: { code: 'invalid_request', message: 'PayPal SPEI not supported (fake)' },
                status: 400,
            }));
        }

        return of(new HttpResponse({ status: 200, body: response })).pipe(delay(250));
    }
}
