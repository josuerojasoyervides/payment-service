import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import { CancelPaymentRequest } from '@payments/domain/models/payment/payment-request.types';

import { StripeCancelIntentGateway } from './cancel-intent.gateway';

describe('StripeCancelIntentGateway', () => {
  let gateway: StripeCancelIntentGateway;
  let httpMock: HttpTestingController;

  const i18nMock = {
    t: vi.fn().mockReturnValue('Error del proveedor de pago'),
  };

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
        { provide: I18nService, useValue: i18nMock },
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
});
