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

describe('StripeConfirmIntentGateway', () => {
  let gateway: StripeConfirmIntentGateway;
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
        { provide: LoggerService, useValue: loggerMock },
        providePaymentsInfraConfig(infraConfigInput),
      ],
    });

    gateway = TestBed.inject(StripeConfirmIntentGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('POST /intents/:id/confirm with correct payload and headers', () => {
    const req: ConfirmPaymentRequest = {
      intentId: createPaymentIntentId('pi_123'),
      returnUrl: 'https://example.com/return',
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

    const httpReq = httpMock.expectOne('/test/payments/stripe/intents/pi_123/confirm');

    expect(httpReq.request.method).toBe('POST');

    expect(httpReq.request.body).toEqual({
      return_url: 'https://example.com/return',
    });

    expect(httpReq.request.headers.has('Idempotency-Key')).toBe(true);

    httpReq.flush({
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
        expect(err.code).toBe('provider_error');
        expect(err.raw).toBeDefined();
      },
    });

    const httpReq = httpMock.expectOne('/test/payments/stripe/intents/pi_error/confirm');
    expect(httpReq.request.method).toBe('POST');

    httpReq.flush(
      { message: 'Stripe error' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });
});
