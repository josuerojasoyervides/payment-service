import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';

import { PaypalCancelIntentGateway } from './cancel-intent.gateway';

describe('PaypalCancelIntentGateway', () => {
  let gateway: PaypalCancelIntentGateway;
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
        PaypalCancelIntentGateway,
        { provide: LoggerService, useValue: loggerMock },
      ],
    });

    gateway = TestBed.inject(PaypalCancelIntentGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('POST /orders/:id/void and maps payment intent correctly', () => {
    gateway.execute({ intentId: 'ORDER_1' }).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.id).toBe('ORDER_1');
        expect(intent.provider).toBe('paypal');
        expect(intent.status).toBe('canceled');
      },
      error: () => {
        expect.fail('No debería emitir error');
      },
    });

    const httpReq = httpMock.expectOne('/api/payments/paypal/orders/ORDER_1/void');
    expect(httpReq.request.method).toBe('POST');
    expect(httpReq.request.body).toEqual({});

    httpReq.flush({
      id: 'ORDER_1',
      status: 'VOIDED',
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
        expect.fail('Se esperaba error');
      },
      error: (err) => {
        expect(err.code).toBe('provider_error');
        expect(err.raw).toBeDefined();
      },
    });

    const httpReq = httpMock.expectOne('/api/payments/paypal/orders/ORDER_ERROR/void');
    expect(httpReq.request.method).toBe('POST');

    httpReq.flush(
      { message: 'Paypal error' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });
});
