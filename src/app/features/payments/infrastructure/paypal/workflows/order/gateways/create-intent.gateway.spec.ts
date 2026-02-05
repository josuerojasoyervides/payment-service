import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import { LoggerService } from '@core/logging';
import { createOrderId } from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import type { PaymentsInfraConfigInput } from '@payments/infrastructure/config/payments-infra-config.types';
import { providePaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import { PaypalCreateIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/create-intent.gateway';
import {
  TEST_CANCEL_URL_ALT,
  TEST_PAYPAL_APPROVE_URL,
  TEST_RETURN_URL_ALT,
} from '@payments/infrastructure/testing/fixtures/test-urls';
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
  const infraConfigInput: PaymentsInfraConfigInput = {
    paymentsBackendBaseUrl: '/test/payments',
    timeouts: { stripeMs: 10_000, paypalMs: 10_000 },
    paypal: {
      defaults: {
        brand_name: 'Test Brand',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
      },
    },
    spei: {
      displayConfig: {
        receivingBanks: { STP: 'STP (Transfers and Payments System)' },
        beneficiaryName: 'Payment Service',
      },
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PaypalCreateIntentGateway,
        IdempotencyKeyFactory,
        { provide: LoggerService, useValue: loggerMock },
        providePaymentsInfraConfig(infraConfigInput),
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
      returnUrl: TEST_RETURN_URL_ALT,
      cancelUrl: TEST_CANCEL_URL_ALT,
    };

    gateway.execute(req).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.provider).toBe('paypal');
        expect(intent.id.value).toBe('ORDER_1');
        expect(intent.status).toBe('requires_action');
        expect(intent.redirectUrl).toBe(TEST_PAYPAL_APPROVE_URL);
      },
      error: (error: PaymentError) => {
        throw error;
      },
    });

    const httpReq = httpMock.expectOne('/test/payments/paypal/orders');
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
        brand_name: 'Test Brand',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: TEST_RETURN_URL_ALT,
        cancel_url: TEST_CANCEL_URL_ALT,
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
          href: TEST_PAYPAL_APPROVE_URL,
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
      expect(error.messageKey).toBeUndefined();
    }
  });

  it('propagates provider error when backend fails', () => {
    const req: CreatePaymentRequest = {
      orderId: createOrderId('order_3'),
      money: { amount: 140, currency: 'MXN' },
      method: { type: 'card' },
      returnUrl: TEST_RETURN_URL_ALT,
    };

    gateway.execute(req).subscribe({
      next: () => {
        expect.fail('Expected error');
      },
      error: (err) => {
        expect(err.code).toBe('provider_unavailable');
        expect(err.raw).toBeDefined();
      },
    });

    const httpReq = httpMock.expectOne('/test/payments/paypal/orders');
    expect(httpReq.request.method).toBe('POST');

    httpReq.flush(
      { message: 'Paypal error' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });

  it('maps PayPal error names to payment error codes without messageKey', () => {
    const req: CreatePaymentRequest = {
      orderId: createOrderId('order_4'),
      money: { amount: 150, currency: 'MXN' },
      method: { type: 'card' },
      returnUrl: TEST_RETURN_URL_ALT,
    };

    gateway.execute(req).subscribe({
      next: () => {
        expect.fail('Expected error');
      },
      error: (err: PaymentError) => {
        expect(err.code).toBe('card_declined');
        expect(err.messageKey).toBeUndefined();
      },
    });

    const httpReq = httpMock.expectOne('/test/payments/paypal/orders');
    expect(httpReq.request.method).toBe('POST');

    httpReq.flush(
      { name: 'INSTRUMENT_DECLINED', message: 'Declined', debug_id: 'dbg_1' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
  });
});
