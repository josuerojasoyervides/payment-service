import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import { createPaymentIntentId } from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { ConfirmPaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import type { PaymentsInfraConfigInput } from '@payments/infrastructure/config/payments-infra-config.types';
import { providePaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import { StripeConfirmIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/confirm-intent.gateway';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { TEST_RETURN_URL } from '@payments/shared/testing/fixtures/test-urls';

describe('StripeConfirmIntentGateway', () => {
  let gateway: StripeConfirmIntentGateway;
  let transportMock: HttpTestingController;

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
        StripeConfirmIntentGateway,
        IdempotencyKeyFactory,
        { provide: LoggerService, useValue: loggerMock },
        providePaymentsInfraConfig(infraConfigInput),
      ],
    });

    gateway = TestBed.inject(StripeConfirmIntentGateway);
    transportMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    transportMock.verify();
  });

  it('POST /intents/:id/confirm with correct payload and headers', () => {
    const req: ConfirmPaymentRequest = {
      intentId: createPaymentIntentId('pi_123'),
      returnUrl: TEST_RETURN_URL,
      idempotencyKey: 'idem_confirm_123',
    };

    gateway.execute(req).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.provider).toBe('stripe');
        expect(intent.id.value).toBe('pi_123');
      },
      error: (e) => {
        throw e;
      },
    });

    const transportReq = transportMock.expectOne('/test/payments/stripe/intents/pi_123/confirm');

    expect(transportReq.request.method).toBe('POST');

    expect(transportReq.request.body).toEqual({
      return_url: TEST_RETURN_URL,
    });

    expect(transportReq.request.headers.get('Idempotency-Key')).toBe('idem_confirm_123');

    transportReq.flush({
      id: 'pi_123',
      status: 'succeeded',
      amount: 10000,
      currency: 'mxn',
    });
  });

  it('propagates provider error when backend fails', () => {
    const req: ConfirmPaymentRequest = {
      intentId: createPaymentIntentId('pi_error'),
      idempotencyKey: 'idem_confirm_error',
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

    const transportReq = transportMock.expectOne('/test/payments/stripe/intents/pi_error/confirm');
    expect(transportReq.request.method).toBe('POST');

    transportReq.flush(
      { message: 'Stripe error' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });
});
