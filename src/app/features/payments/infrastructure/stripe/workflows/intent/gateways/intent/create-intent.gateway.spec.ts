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
import { SPEI_RAW_KEYS } from '@payments/infrastructure/stripe/shared/constants/spei-raw-keys.constants';
import { StripeCreateIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/create-intent.gateway';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { TEST_PAYMENTS_BASE_URL } from '@payments/shared/testing/fixtures/test-urls';

describe('StripeCreateIntentGateway', () => {
  let gateway: StripeCreateIntentGateway;
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
        StripeCreateIntentGateway,
        IdempotencyKeyFactory,
        { provide: LoggerService, useValue: loggerMock },
        providePaymentsInfraConfig(infraConfigInput),
      ],
    });

    gateway = TestBed.inject(StripeCreateIntentGateway);
    transportMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    transportMock.verify();
  });

  it('POST /intents for card payments with correct payload and headers', () => {
    const req: CreatePaymentRequest = {
      orderId: createOrderId('order_1'),
      money: { amount: 100, currency: 'MXN' },
      method: { type: 'card', token: 'tok_123' },
      idempotencyKey: 'idem_123',
    };

    gateway.execute(req).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.provider).toBe(PAYMENT_PROVIDER_IDS.stripe);
        expect(intent.id.value).toBe('pi_1');
      },
      error: (error: PaymentError) => {
        throw error;
      },
    });

    const transportReq = transportMock.expectOne(
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.stripe}/intents`,
    );
    expect(transportReq.request.method).toBe('POST');

    expect(transportReq.request.body).toEqual({
      amount: 100 * 100,
      currency: 'mxn',
      payment_method_types: ['card'],
      payment_method: 'tok_123',
      metadata: {
        order_id: 'order_1',
        created_at: expect.any(String),
      },
      description: 'Order order_1',
    });

    expect(transportReq.request.headers.get('Idempotency-Key')).toBe('idem_123');

    transportReq.flush({
      id: 'pi_1',
      status: 'requires_confirmation',
      amount: 10000,
      currency: 'mxn',
    });
  });

  it('POST /sources for SPEI payments', () => {
    const req: CreatePaymentRequest = {
      orderId: createOrderId('order_2'),
      money: { amount: 200, currency: 'MXN' },
      method: { type: 'spei' },
      idempotencyKey: 'idem_spei',
    };

    gateway.execute(req).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.nextAction?.kind).toBe('manual_step');
      },
      error: (error: PaymentError) => {
        throw error;
      },
    });

    const transportReq = transportMock.expectOne(
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.stripe}/sources`,
    );
    expect(transportReq.request.method).toBe('POST');

    const spei = {
      [SPEI_RAW_KEYS.REFERENCE]: '123456',
      [SPEI_RAW_KEYS.CLABE]: '646180157000000000',
      [SPEI_RAW_KEYS.BANK]: 'STP',
    };

    transportReq.flush({
      id: 'src_1',
      status: 'pending',
      amount: 20000,
      currency: 'mxn',
      expires_at: 1234567890,
      spei,
    });
  });

  it('propagates provider error when backend fails', () => {
    const req: CreatePaymentRequest = {
      orderId: createOrderId('order_error'),
      money: { amount: 100, currency: 'MXN' },
      method: { type: 'card', token: 'tok_123' },
      idempotencyKey: 'idem_error',
    };

    gateway.execute(req).subscribe({
      next: () => {
        expect.fail('Expected error');
      },
      error: (err: PaymentError) => {
        expect(err.code).toBe('provider_unavailable');
        expect(err.raw).toBeDefined();
      },
    });

    const transportReq = transportMock.expectOne(
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.stripe}/intents`,
    );
    expect(transportReq.request.method).toBe('POST');

    transportReq.flush(
      { message: 'Stripe error' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });

  it('maps Stripe error codes to payment error codes without messageKey', () => {
    const req: CreatePaymentRequest = {
      orderId: createOrderId('order_error_code'),
      money: { amount: 100, currency: 'MXN' },
      method: { type: 'card', token: 'tok_123' },
      idempotencyKey: 'idem_error_code',
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

    const transportReq = transportMock.expectOne(
      `${TEST_PAYMENTS_BASE_URL}/${PAYMENT_PROVIDER_IDS.stripe}/intents`,
    );
    expect(transportReq.request.method).toBe('POST');

    transportReq.flush(
      { error: { code: 'card_declined', type: 'card_error', message: 'Card declined' } },
      { status: 402, statusText: 'Payment Required' },
    );
  });
});
