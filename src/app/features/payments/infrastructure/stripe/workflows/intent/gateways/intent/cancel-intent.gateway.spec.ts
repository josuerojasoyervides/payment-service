import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CancelPaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import { StripeCancelIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/cancel-intent.gateway';

describe('StripeCancelIntentGateway', () => {
  let gateway: StripeCancelIntentGateway;
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
        StripeCancelIntentGateway,
        { provide: LoggerService, useValue: loggerMock },
      ],
    });

    gateway = TestBed.inject(StripeCancelIntentGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('POST /intents/:id/cancel with idempotency headers', () => {
    const req: CancelPaymentRequest = {
      intentId: 'pi_123',
      idempotencyKey: 'idem_cancel_123',
    };

    gateway.execute(req).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.provider).toBe('stripe');
        expect(intent.id).toBe('pi_123');
        expect(intent.status).toBeDefined();
      },
      error: (e) => {
        throw e;
      },
    });

    const httpReq = httpMock.expectOne('/api/payments/stripe/intents/pi_123/cancel');

    expect(httpReq.request.method).toBe('POST');
    expect(httpReq.request.body).toEqual({});

    expect(httpReq.request.headers.has('Idempotency-Key')).toBe(true);

    httpReq.flush({
      id: 'pi_123',
      status: 'canceled',
      amount: 10000,
      currency: 'mxn',
    });
  });

  it('propagates provider error when backend fails', () => {
    const req: CancelPaymentRequest = {
      intentId: 'pi_error',
      idempotencyKey: 'idem_cancel_error',
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

    const httpReq = httpMock.expectOne('/api/payments/stripe/intents/pi_error/cancel');
    expect(httpReq.request.method).toBe('POST');

    httpReq.flush(
      { message: 'Stripe error' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });
});
