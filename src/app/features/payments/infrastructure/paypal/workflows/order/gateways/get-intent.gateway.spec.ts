import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import { createPaymentIntentId } from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentsInfraConfigInput } from '@payments/infrastructure/config/payments-infra-config.types';
import { providePaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import type { PaypalOrderDto } from '@payments/infrastructure/paypal/core/dto/paypal.dto';
import { PaypalGetIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/get-intent.gateway';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { TEST_PAYMENTS_BASE_URL } from '@payments/shared/testing/fixtures/test-urls';

describe('PaypalGetIntentGateway', () => {
  let gateway: PaypalGetIntentGateway;
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

  function buildPaypalOrder(overrides: Partial<PaypalOrderDto> = {}): PaypalOrderDto {
    return {
      id: 'pi_123',
      status: 'COMPLETED',
      intent: 'CAPTURE',
      create_time: '2026-01-29T00:00:00Z',
      update_time: '2026-01-29T00:00:01Z',
      links: [],
      purchase_units: [
        {
          reference_id: 'order_demo',
          amount: {
            value: '200.00',
            currency_code: 'MXN',
          },
        },
      ],
      ...overrides,
    };
  }

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
    transportMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    transportMock.verify();
  });

  it('GET /orders/:id and maps payment intent correctly', () => {
    gateway.execute({ intentId: createPaymentIntentId('pi_123') }).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.id.value).toBe('pi_123');
        expect(intent.provider).toBe(PAYMENT_PROVIDER_IDS.paypal);
        expect(intent.money.amount).toBe(200);
        expect(intent.money.currency).toBe('MXN');
        expect(intent.status).toBeDefined();
      },
      error: () => {
        expect.fail('should not emit error');
      },
    });

    const req = transportMock.expectOne(
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.paypal}/orders/pi_123`,
    );
    expect(req.request.method).toBe('GET');

    req.flush(buildPaypalOrder());
  });

  it('propagates provider error when backend fails', () => {
    gateway.execute({ intentId: createPaymentIntentId('pi_error') }).subscribe({
      next: () => {
        expect.fail('Expected error');
      },
      error: (err) => {
        expect(err.code).toBe('provider_unavailable');
        expect(err.raw).toBeDefined();
      },
    });

    const req = transportMock.expectOne(
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.paypal}/orders/pi_error`,
    );
    expect(req.request.method).toBe('GET');

    req.flush({ message: 'Paypal error' }, { status: 500, statusText: 'Internal Server Error' });
  });

  it('emits provider_error when payload is invalid', () => {
    gateway.execute({ intentId: createPaymentIntentId('pi_invalid') }).subscribe({
      next: () => {
        expect.fail('Expected error');
      },
      error: (err: { code?: string; messageKey?: string }) => {
        expect(err.code).toBe('provider_error');
        expect(err.messageKey).toBe('errors.provider_error');
      },
    });

    const req = transportMock.expectOne(
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.paypal}/orders/pi_invalid`,
    );
    req.flush({ id: 'pi_invalid' });
  });
});
