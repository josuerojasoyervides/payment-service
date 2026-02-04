import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import { createPaymentIntentId } from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentsInfraConfigInput } from '@payments/infrastructure/config/payments-infra-config.types';
import { providePaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import { StripeGetIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/get-intent.gateway';

describe('StripeGetIntentGateway', () => {
  let gateway: StripeGetIntentGateway;
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
        StripeGetIntentGateway,
        { provide: LoggerService, useValue: loggerMock },
        providePaymentsInfraConfig(infraConfigInput),
      ],
    });

    gateway = TestBed.inject(StripeGetIntentGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /intents/:id and maps payment intent correctly', () => {
    gateway.execute({ intentId: createPaymentIntentId('pi_123') }).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.id?.value ?? intent.id).toBe('pi_123');
        expect(intent.provider).toBe('stripe');
        expect(intent.money.amount).toBe(200);
        expect(intent.money.currency).toBe('MXN');
        expect(intent.status).toBeDefined();
      },
      error: () => {
        expect.fail('should not emit error');
      },
    });

    const req = httpMock.expectOne('/test/payments/stripe/intents/pi_123');
    expect(req.request.method).toBe('GET');

    req.flush({
      id: 'pi_123',
      status: 'succeeded',
      amount: 20000,
      currency: 'mxn',
      metadata: {
        order_id: 'order_123',
      },
    });
  });

  it('propagates provider error when backend fails', () => {
    gateway.execute({ intentId: createPaymentIntentId('pi_error') }).subscribe({
      next: () => {
        expect.fail('Expected error');
      },
      error: (err) => {
        expect(err.code).toBe('provider_error');
        expect(err.raw).toBeDefined();
      },
    });

    const req = httpMock.expectOne('/test/payments/stripe/intents/pi_error');
    expect(req.request.method).toBe('GET');

    req.flush({ message: 'Stripe error' }, { status: 500, statusText: 'Internal Server Error' });
  });
});
