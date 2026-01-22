import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError, delay } from 'rxjs';

@Injectable()
export class FakePaymentsBackendInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // ✅ Interceptamos solo lo que nos interesa
    if (req.method === 'POST' && req.url === '/api/payments/stripe/intents') {
      return this.fakeStripeIntent(req.body);
    }

    if (req.method === 'POST' && req.url === '/api/payments/stripe/intents/confirm') {
      return this.fakeStripeConfirm(req.body);
    }

    if (req.method === 'POST' && req.url === '/api/payments/stripe/intents/cancel') {
      return this.fakeStripeCancel(req.body);
    }

    if (req.method === 'GET' && req.url.startsWith('/api/payments/stripe/intents/')) {
      return this.fakeStripeStatus(req.url);
    }

    if (req.method === 'POST' && req.url === '/api/payments/paypal/intents') {
      return this.fakePaypalIntent(req.body);
    }

    if (req.method === 'POST' && req.url === '/api/payments/paypal/intents/confirm') {
      return this.fakePaypalConfirm(req.body);
    }

    if (req.method === 'POST' && req.url === '/api/payments/paypal/intents/cancel') {
      return this.fakePaypalCancel(req.body);
    }

    if (req.method === 'GET' && req.url.startsWith('/api/payments/paypal/intents/')) {
      return this.fakePaypalStatus(req.url);
    }

    return next.handle(req);
  }

  private fakeStripeIntent(body: any): Observable<HttpEvent<any>> {
    const method = body?.method?.type;

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

  private fakeStripeConfirm(body: any): Observable<HttpEvent<any>> {
    const response = {
      id: body.intentId ?? 'pi_fake_stripe_1',
      status: 'processing',
      amount: 100,
      currency: 'MXN',
      clientSecret: 'sec_fake_stripe',
      redirectUrl: null,
    };

    return of(new HttpResponse({ status: 200, body: response })).pipe(delay(200));
  }

  private fakeStripeCancel(body: any): Observable<HttpEvent<any>> {
    const response = {
      id: body.intentId ?? 'pi_fake_stripe_1',
      status: 'canceled',
      amount: 100,
      currency: 'MXN',
      clientSecret: null,
      redirectUrl: null,
    };

    return of(new HttpResponse({ status: 200, body: response })).pipe(delay(200));
  }

  private fakeStripeStatus(url: string): Observable<HttpEvent<any>> {
    const intentId = url.split('/').pop() || 'pi_fake_stripe_1';
    const response = {
      id: intentId,
      status: 'requires_action',
      amount: 100,
      currency: 'MXN',
      clientSecret: 'sec_fake_stripe',
      redirectUrl: 'https://fake-bank/redirect',
    };

    return of(new HttpResponse({ status: 200, body: response })).pipe(delay(200));
  }

  private fakePaypalIntent(body: any): Observable<HttpEvent<any>> {
    const method = body?.method?.type;

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

  private fakePaypalConfirm(body: any): Observable<HttpEvent<any>> {
    const response = {
      id: body.intentId ?? 'pi_fake_paypal_1',
      status: 'processing',
      amount: 100,
      currency: 'MXN',
      clientSecret: null,
      redirectUrl: null,
    };

    return of(new HttpResponse({ status: 200, body: response })).pipe(delay(200));
  }

  private fakePaypalCancel(body: any): Observable<HttpEvent<any>> {
    const response = {
      id: body.intentId ?? 'pi_fake_paypal_1',
      status: 'canceled',
      amount: 100,
      currency: 'MXN',
      clientSecret: null,
      redirectUrl: null,
    };

    return of(new HttpResponse({ status: 200, body: response })).pipe(delay(200));
  }

  private fakePaypalStatus(url: string): Observable<HttpEvent<any>> {
    const intentId = url.split('/').pop() || 'pi_fake_paypal_1';
    const response = {
      id: intentId,
      status: 'requires_action',
      amount: 100,
      currency: 'MXN',
      clientSecret: null,
      redirectUrl: 'https://paypal.fake/approve',
    };

    return of(new HttpResponse({ status: 200, body: response })).pipe(delay(200));
  }
}
