import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import { ConfirmPaymentRequest } from '@payments/domain/models/payment/payment-request.types';

import { StripeConfirmIntentGateway } from './confirm-intent.gateway';

describe('StripeConfirmIntentGateway', () => {
  let gateway: StripeConfirmIntentGateway;
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
        StripeConfirmIntentGateway,
        { provide: LoggerService, useValue: loggerMock },
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
      intentId: 'pi_123',
      returnUrl: 'https://example.com/return',
      idempotencyKey: 'idem_confirm_123',
    };

    gateway.execute(req).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.provider).toBe('stripe');
        expect(intent.id).toBe('pi_123');
      },
      error: (e) => {
        throw e;
      },
    });

    const httpReq = httpMock.expectOne('/api/payments/stripe/intents/pi_123/confirm');

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
});
