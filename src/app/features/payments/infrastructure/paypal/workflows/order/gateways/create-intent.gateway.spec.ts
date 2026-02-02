import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import { I18nKeys } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { createOrderId } from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import { PaypalCreateIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/create-intent.gateway';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';

describe('PaypalCreateIntentGateway', () => {
  let gateway: PaypalCreateIntentGateway;
  let httpMock: HttpTestingController;

  const loggerMock = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PaypalCreateIntentGateway,
        IdempotencyKeyFactory,
        { provide: LoggerService, useValue: loggerMock },
      ],
    });

    gateway = TestBed.inject(PaypalCreateIntentGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('POST /orders with correct payload and headers', () => {
    const req: CreatePaymentRequest = {
      orderId: createOrderId('order_1'),
      money: { amount: 100, currency: 'MXN' },
      method: { type: 'card' },
      returnUrl: 'https://return.test',
      cancelUrl: 'https://cancel.test',
    };

    gateway.execute(req).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.provider).toBe('paypal');
        expect(intent.id.value).toBe('ORDER_1');
        expect(intent.status).toBe('requires_action');
        expect(intent.redirectUrl).toBe('https://paypal.test/approve');
      },
      error: (error: PaymentError) => {
        throw error;
      },
    });

    const httpReq = httpMock.expectOne('/api/payments/paypal/orders');
    expect(httpReq.request.method).toBe('POST');
    expect(httpReq.request.headers.get('PayPal-Request-Id')).toBe(
      'paypal:start:order_1:100:MXN:card',
    );
    expect(httpReq.request.headers.get('Prefer')).toBe('return=representation');

    expect(httpReq.request.body).toEqual({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: 'order_1',
          custom_id: 'order_1',
          description: 'Order order_1',
          amount: {
            currency_code: 'MXN',
            value: '100.00',
          },
        },
      ],
      application_context: {
        brand_name: 'Payment Service',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        return_url: 'https://return.test',
        cancel_url: 'https://cancel.test',
      },
    });

    httpReq.flush({
      id: 'ORDER_1',
      status: 'CREATED',
      purchase_units: [
        {
          amount: {
            value: '100.00',
            currency_code: 'MXN',
          },
        },
      ],
      links: [
        {
          rel: 'approve',
          href: 'https://paypal.test/approve',
        },
      ],
    });
  });

  it('throws invalid_request when returnUrl is missing', () => {
    const req: CreatePaymentRequest = {
      orderId: createOrderId('order_2'),
      money: { amount: 120, currency: 'MXN' },
      method: { type: 'card' },
    };

    try {
      gateway.execute(req);
      expect.fail('Expected invalid_request error');
    } catch (err) {
      const error = err as PaymentError;
      expect(error.code).toBe('invalid_request');
      expect(error.messageKey).toBe(I18nKeys.errors.invalid_request);
    }
  });

  it('propagates provider error when backend fails', () => {
    const req: CreatePaymentRequest = {
      orderId: createOrderId('order_3'),
      money: { amount: 140, currency: 'MXN' },
      method: { type: 'card' },
      returnUrl: 'https://return.test',
    };

    gateway.execute(req).subscribe({
      next: () => {
        expect.fail('Expected error');
      },
      error: (err) => {
        expect(err.code).toBe('provider_error');
        expect(err.raw).toBeDefined();
      },
    });

    const httpReq = httpMock.expectOne('/api/payments/paypal/orders');
    expect(httpReq.request.method).toBe('POST');

    httpReq.flush(
      { message: 'Paypal error' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });
});
