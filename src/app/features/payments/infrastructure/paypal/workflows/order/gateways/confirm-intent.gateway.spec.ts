import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import { createPaymentIntentId } from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentsInfraConfigInput } from '@payments/infrastructure/config/payments-infra-config.types';
import { providePaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import { PaypalConfirmIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/confirm-intent.gateway';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';

describe('PaypalConfirmIntentGateway', () => {
  let gateway: PaypalConfirmIntentGateway;
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
        PaypalConfirmIntentGateway,
        IdempotencyKeyFactory,
        { provide: LoggerService, useValue: loggerMock },
        providePaymentsInfraConfig(infraConfigInput),
      ],
    });

    gateway = TestBed.inject(PaypalConfirmIntentGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('POST /orders/:id/capture with idempotency header', () => {
    gateway.execute({ intentId: createPaymentIntentId('ORDER_1') }).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.id.value).toBe('ORDER_1');
        expect(intent.provider).toBe('paypal');
        expect(intent.status).toBe('succeeded');
      },
      error: () => {
        expect.fail('should not emit error');
      },
    });

    const httpReq = httpMock.expectOne('/test/payments/paypal/orders/ORDER_1/capture');
    expect(httpReq.request.method).toBe('POST');
    expect(httpReq.request.body).toEqual({});
    expect(httpReq.request.headers.get('PayPal-Request-Id')).toBe('paypal:confirm:ORDER_1');

    httpReq.flush({
      id: 'ORDER_1',
      status: 'COMPLETED',
      purchase_units: [
        {
          amount: {
            value: '100.00',
            currency_code: 'MXN',
          },
        },
      ],
      links: [],
    });
  });

  it('propagates provider error when backend fails', () => {
    gateway.execute({ intentId: createPaymentIntentId('ORDER_ERROR') }).subscribe({
      next: () => {
        expect.fail('Expected error');
      },
      error: (err) => {
        expect(err.code).toBe('provider_error');
        expect(err.raw).toBeDefined();
      },
    });

    const httpReq = httpMock.expectOne('/test/payments/paypal/orders/ORDER_ERROR/capture');
    expect(httpReq.request.method).toBe('POST');

    httpReq.flush(
      { message: 'Paypal error' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });
});
