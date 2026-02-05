import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import { createPaymentIntentId } from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { CancelPaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import type { PaymentsInfraConfigInput } from '@payments/infrastructure/config/payments-infra-config.types';
import { providePaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import { StripeCancelIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/cancel-intent.gateway';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { TEST_PAYMENTS_BASE_URL } from '@payments/shared/testing/fixtures/test-urls';

describe('StripeCancelIntentGateway', () => {
  let gateway: StripeCancelIntentGateway;
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
        brand_name: 'Payment Service',
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
        StripeCancelIntentGateway,
        IdempotencyKeyFactory,
        { provide: LoggerService, useValue: loggerMock },
        providePaymentsInfraConfig(infraConfigInput),
      ],
    });

    gateway = TestBed.inject(StripeCancelIntentGateway);
    transportMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    transportMock.verify();
  });

  it('POST /intents/:id/cancel with idempotency headers', () => {
    const req: CancelPaymentRequest = {
      intentId: createPaymentIntentId('pi_123'),
      idempotencyKey: 'idem_cancel_123',
    };

    gateway.execute(req).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.provider).toBe(PAYMENT_PROVIDER_IDS.stripe);
        expect(intent.id.value).toBe('pi_123');
        expect(intent.status).toBeDefined();
      },
      error: (e) => {
        throw e;
      },
    });

    const transportReq = transportMock.expectOne(
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.stripe}/intents/pi_123/cancel`,
    );

    expect(transportReq.request.method).toBe('POST');
    expect(transportReq.request.body).toEqual({});

    expect(transportReq.request.headers.get('Idempotency-Key')).toBe('idem_cancel_123');

    transportReq.flush({
      id: 'pi_123',
      status: 'canceled',
      amount: 10000,
      currency: 'mxn',
    });
  });

  it('propagates provider error when backend fails', () => {
    const req: CancelPaymentRequest = {
      intentId: createPaymentIntentId('pi_error'),
      idempotencyKey: 'idem_cancel_error',
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

    const transportReq = transportMock.expectOne(
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.stripe}/intents/pi_error/cancel`,
    );
    expect(transportReq.request.method).toBe('POST');

    transportReq.flush(
      { message: 'Stripe error' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });
});
