import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import { createPaymentIntentId } from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentsInfraConfigInput } from '@payments/infrastructure/config/payments-infra-config.types';
import { providePaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import { PaypalConfirmIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/confirm-intent.gateway';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { TEST_PAYMENTS_BASE_URL } from '@payments/shared/testing/fixtures/test-urls';

describe('PaypalConfirmIntentGateway', () => {
  let gateway: PaypalConfirmIntentGateway;
  let transportMock: HttpTestingController;

  const loggerMock = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
  const infraConfigInput: PaymentsInfraConfigInput = {
    paymentsBackendBaseUrl: TEST_PAYMENTS_BASE_URL,
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
    transportMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    transportMock.verify();
  });

  it('POST /orders/:id/capture with idempotency header', () => {
    gateway.execute({ intentId: createPaymentIntentId('ORDER_1') }).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.id.value).toBe('ORDER_1');
        expect(intent.provider).toBe(PAYMENT_PROVIDER_IDS.paypal);
        expect(intent.status).toBe('succeeded');
      },
      error: () => {
        expect.fail('should not emit error');
      },
    });

    const transportReq = transportMock.expectOne(
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.paypal}/orders/ORDER_1/capture`,
    );
    expect(transportReq.request.method).toBe('POST');
    expect(transportReq.request.body).toEqual({});
    expect(transportReq.request.headers.get('PayPal-Request-Id')).toBe(
      `${PAYMENT_PROVIDER_IDS.paypal}:confirm:ORDER_1`,
    );

    transportReq.flush({
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
        expect(err.code).toBe('provider_unavailable');
        expect(err.raw).toBeDefined();
      },
    });

    const transportReq = transportMock.expectOne(
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.paypal}/orders/ORDER_ERROR/capture`,
    );
    expect(transportReq.request.method).toBe('POST');

    transportReq.flush(
      { message: 'Paypal error' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });
});
