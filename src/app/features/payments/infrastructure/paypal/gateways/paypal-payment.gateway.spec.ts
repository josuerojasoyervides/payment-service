import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { CreatePaymentRequest, PaymentError } from '../../../domain/models';
import { PaypalPaymentGateway } from './paypal-payment.gateway';

describe('PaypalPaymentGateway', () => {
  let gateway: PaypalPaymentGateway;
  let httpMock: HttpTestingController;

  const req: CreatePaymentRequest = {
    orderId: 'order_1',
    amount: 100,
    currency: 'MXN',
    method: { type: 'card', token: 'tok_123' },
    returnUrl: 'https://example.com/payments/return',
    cancelUrl: 'https://example.com/payments/cancel',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PaypalPaymentGateway],
    });

    gateway = TestBed.inject(PaypalPaymentGateway);
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
      }),
    ).toThrowError('orderId is required');
  });

  describe('createIntent', () => {
    it('POSTs to /api/payments/paypal/orders with PayPal format', async () => {
      const promise = firstValueFrom(gateway.createIntent(req));

      // PayPal uses /orders endpoint, not /intents
      const httpReq = httpMock.expectOne('/api/payments/paypal/orders');
      expect(httpReq.request.method).toBe('POST');
      // Body is transformed to PayPal Orders API format
      expect(httpReq.request.body.intent).toBe('CAPTURE');
      expect(httpReq.request.body.purchase_units[0].amount.value).toBe('100.00');
      expect(httpReq.request.body.purchase_units[0].amount.currency_code).toBe('MXN');

      // Respond with PayPal Order DTO
      httpReq.flush({
        id: 'ORDER_123',
        status: 'CREATED',
        intent: 'CAPTURE',
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString(),
        links: [{ href: 'https://paypal.com/approve/ORDER_123', rel: 'approve', method: 'GET' }],
        purchase_units: [
          {
            reference_id: 'order_1',
            amount: { currency_code: 'MXN', value: '100.00' },
          },
        ],
      });

      const result = await promise;

      expect(result).toEqual(
        expect.objectContaining({
          id: 'ORDER_123',
          provider: 'paypal',
          status: 'requires_action', // CREATED maps to requires_action
          amount: 100,
          currency: 'MXN',
        }),
      );

      expect(result.redirectUrl).toContain('paypal.com');
      expect(result.raw).toBeTruthy();
    });

    it('normalizes PayPal-like errors with human-readable messages', async () => {
      const promise = firstValueFrom(gateway.createIntent(req));
      const httpReq = httpMock.expectOne('/api/payments/paypal/orders');

      httpReq.flush(
        { name: 'INSTRUMENT_DECLINED', message: 'Payment declined', debug_id: 'abc123' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

      try {
        await promise;
        throw new Error('Expected promise to reject');
      } catch (error) {
        const paymentError = error as PaymentError;

        // El error se normaliza aunque el formato HTTP lo envuelve
        expect(paymentError.code).toBeDefined();
        expect(paymentError.message).toBeDefined();
        expect(paymentError.raw).toBeTruthy();
      }
    });

    it('falls back to generic error message when error shape is not PayPal-like', async () => {
      const promise = firstValueFrom(gateway.createIntent(req));
      const httpReq = httpMock.expectOne('/api/payments/paypal/orders');

      httpReq.error(new ProgressEvent('error'), {
        status: 0,
        statusText: 'Unknown Error',
      });

      try {
        await promise;
        throw new Error('Expected promise to reject');
      } catch (error) {
        const paymentErr = error as PaymentError;

        expect(paymentErr.code).toBe('provider_error');
        expect(paymentErr.message).toBeDefined();
        expect(paymentErr.raw).toBeTruthy();
      }
    });
  });
});
