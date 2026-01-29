import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { PaypalConfirmIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/confirm-intent.gateway';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';

describe('PaypalConfirmIntentGateway', () => {
  let gateway: PaypalConfirmIntentGateway;
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
        PaypalConfirmIntentGateway,
        IdempotencyKeyFactory,
        { provide: LoggerService, useValue: loggerMock },
      ],
    });

    gateway = TestBed.inject(PaypalConfirmIntentGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('POST /orders/:id/capture with idempotency header', () => {
    gateway.execute({ intentId: 'ORDER_1' }).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.id).toBe('ORDER_1');
        expect(intent.provider).toBe('paypal');
        expect(intent.status).toBe('succeeded');
      },
      error: () => {
        expect.fail('should not emit error');
      },
    });

    const httpReq = httpMock.expectOne('/api/payments/paypal/orders/ORDER_1/capture');
    expect(httpReq.request.method).toBe('POST');
    expect(httpReq.request.body).toEqual({});
    expect(httpReq.request.headers.get('PayPal-Request-Id')).toBe('paypal:confirm:ORDER_1');

    httpReq.flush({
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
    gateway.execute({ intentId: 'ORDER_ERROR' }).subscribe({
      next: () => {
        expect.fail('Expected error');
      },
      error: (err) => {
        expect(err.code).toBe('provider_error');
        expect(err.raw).toBeDefined();
      },
    });

    const httpReq = httpMock.expectOne('/api/payments/paypal/orders/ORDER_ERROR/capture');
    expect(httpReq.request.method).toBe('POST');

    httpReq.flush(
      { message: 'Paypal error' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });
});
