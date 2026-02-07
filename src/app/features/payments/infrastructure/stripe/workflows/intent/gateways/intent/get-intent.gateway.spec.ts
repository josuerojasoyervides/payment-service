import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import { createPaymentIntentId } from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentsInfraConfigInput } from '@payments/infrastructure/config/payments-infra-config.types';
import { providePaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import type { StripePaymentIntentDto } from '@payments/infrastructure/stripe/core/dto/stripe.dto';
import { StripeGetIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/get-intent.gateway';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { TEST_PAYMENTS_BASE_URL } from '@payments/shared/testing/fixtures/test-urls';

describe('StripeGetIntentGateway', () => {
  let gateway: StripeGetIntentGateway;
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

  function buildStripeIntent(
    overrides: Partial<StripePaymentIntentDto> = {},
  ): StripePaymentIntentDto {
    return {
      id: 'pi_123',
      object: 'payment_intent',
      amount: 20000,
      amount_received: 20000,
      currency: 'mxn',
      status: 'succeeded',
      client_secret: 'secret_123',
      created: 1_700_000_000,
      livemode: false,
      payment_method_types: ['card'],
      capture_method: 'automatic',
      confirmation_method: 'automatic',
      ...overrides,
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        StripeGetIntentGateway,
        IdempotencyKeyFactory,
        { provide: LoggerService, useValue: loggerMock },
        providePaymentsInfraConfig(infraConfigInput),
      ],
    });

    gateway = TestBed.inject(StripeGetIntentGateway);
    transportMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    transportMock.verify();
  });

  it('GET /intents/:id and maps payment intent correctly', () => {
    gateway.execute({ intentId: createPaymentIntentId('pi_123') }).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.id?.value ?? intent.id).toBe('pi_123');
        expect(intent.provider).toBe(PAYMENT_PROVIDER_IDS.stripe);
        expect(intent.money.amount).toBe(200);
        expect(intent.money.currency).toBe('MXN');
        expect(intent.status).toBeDefined();
      },
      error: () => {
        expect.fail('should not emit error');
      },
    });

    const req = transportMock.expectOne(
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.stripe}/intents/pi_123`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Idempotency-Key')).toBe(
      `${PAYMENT_PROVIDER_IDS.stripe}:get:pi_123`,
    );

    req.flush(
      buildStripeIntent({
        metadata: {
          order_id: 'order_123',
        },
      }),
    );
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
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.stripe}/intents/pi_error`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Idempotency-Key')).toBe(
      `${PAYMENT_PROVIDER_IDS.stripe}:get:pi_error`,
    );

    req.flush({ message: 'Stripe error' }, { status: 500, statusText: 'Internal Server Error' });
  });

  it('maps timeout errors from gateway', () => {
    vi.useFakeTimers();
    let capturedCode: string | null = null;
    let capturedMessageKey: unknown = 'unset';

    gateway.execute({ intentId: createPaymentIntentId('pi_timeout') }).subscribe({
      next: () => {
        expect.fail('Expected timeout error');
      },
      error: (err) => {
        const parsed = err as { code?: string; messageKey?: string };
        capturedCode = parsed.code ?? null;
        capturedMessageKey = parsed.messageKey;
      },
    });

    const req = transportMock.expectOne(
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.stripe}/intents/pi_timeout`,
    );
    expect(req.request.method).toBe('GET');

    vi.advanceTimersByTime(infraConfigInput.timeouts.stripeMs + 1);

    expect(capturedCode).toBe('timeout');
    expect(capturedMessageKey).toBeUndefined();
    expect(req.cancelled).toBe(true);
    vi.useRealTimers();
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
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.stripe}/intents/pi_invalid`,
    );
    req.flush({ id: 'pi_invalid' });
  });
});
