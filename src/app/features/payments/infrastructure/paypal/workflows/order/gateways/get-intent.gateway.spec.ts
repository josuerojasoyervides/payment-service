import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import { createPaymentIntentId } from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentsInfraConfigInput } from '@payments/infrastructure/config/payments-infra-config.types';
import { providePaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import { PaypalGetIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/get-intent.gateway';

describe('PaypalGetIntentGateway', () => {
  let gateway: PaypalGetIntentGateway;
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
        PaypalGetIntentGateway,
        { provide: LoggerService, useValue: loggerMock },
        providePaymentsInfraConfig(infraConfigInput),
      ],
    });

    gateway = TestBed.inject(PaypalGetIntentGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /orders/:id and maps payment intent correctly', () => {
    gateway.execute({ intentId: createPaymentIntentId('pi_123') }).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.id.value).toBe('pi_123');
        expect(intent.provider).toBe('paypal');
        expect(intent.money.amount).toBe(200);
        expect(intent.money.currency).toBe('MXN');
        expect(intent.status).toBeDefined();
      },
      error: () => {
        expect.fail('should not emit error');
      },
    });

    const req = httpMock.expectOne('/test/payments/paypal/orders/pi_123');
    expect(req.request.method).toBe('GET');

    req.flush({
      id: 'pi_123',
      status: 'COMPLETED',
      purchase_units: [
        {
          amount: {
            value: '200.00',
            currency_code: 'MXN',
          },
        },
      ],
      links: [],
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

    const req = httpMock.expectOne('/test/payments/paypal/orders/pi_error');
    expect(req.request.method).toBe('GET');

    req.flush({ message: 'Paypal error' }, { status: 500, statusText: 'Internal Server Error' });
  });
});
