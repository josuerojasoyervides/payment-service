import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import type { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import type { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { StripeCreateIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/create-intent.gateway';

describe('StripeCreateIntentGateway', () => {
  let gateway: StripeCreateIntentGateway;
  let httpMock: HttpTestingController;

  const loggerMock = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        StripeCreateIntentGateway,
        { provide: LoggerService, useValue: loggerMock },
      ],
    });

    gateway = TestBed.inject(StripeCreateIntentGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('POST /intents for card payments with correct payload and headers', () => {
    const req: CreatePaymentRequest = {
      orderId: 'order_1',
      amount: 100,
      currency: 'MXN',
      method: { type: 'card', token: 'tok_123' },
      idempotencyKey: 'idem_123',
    };

    gateway.execute(req).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.provider).toBe('stripe');
        expect(intent.id).toBe('pi_1');
      },
      error: (error: PaymentError) => {
        throw error;
      },
    });

    const httpReq = httpMock.expectOne('/api/payments/stripe/intents');
    expect(httpReq.request.method).toBe('POST');

    expect(httpReq.request.body).toEqual({
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

    expect(httpReq.request.headers.get('Idempotency-Key')).toContain('idem_123');

    httpReq.flush({
      id: 'pi_1',
      status: 'requires_confirmation',
      amount: 10000,
      currency: 'mxn',
    });
  });

  it('POST /sources for SPEI payments', () => {
    const req: CreatePaymentRequest = {
      orderId: 'order_2',
      amount: 200,
      currency: 'MXN',
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

    const httpReq = httpMock.expectOne('/api/payments/stripe/sources');
    expect(httpReq.request.method).toBe('POST');

    httpReq.flush({
      id: 'src_1',
      status: 'pending',
      amount: 20000,
      currency: 'mxn',
      expires_at: 1234567890,
      spei: {
        reference: '123456',
        clabe: '646180157000000000',
        bank: 'STP',
      },
    });
  });

  it('propagates provider error when backend fails', () => {
    const req: CreatePaymentRequest = {
      orderId: 'order_error',
      amount: 100,
      currency: 'MXN',
      method: { type: 'card', token: 'tok_123' },
      idempotencyKey: 'idem_error',
    };

    gateway.execute(req).subscribe({
      next: () => {
        expect.fail('Expected error');
      },
      error: (err: PaymentError) => {
        expect(err.code).toBe('provider_error');
        expect(err.raw).toBeDefined();
      },
    });

    const httpReq = httpMock.expectOne('/api/payments/stripe/intents');
    expect(httpReq.request.method).toBe('POST');

    httpReq.flush(
      { message: 'Stripe error' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });
});
