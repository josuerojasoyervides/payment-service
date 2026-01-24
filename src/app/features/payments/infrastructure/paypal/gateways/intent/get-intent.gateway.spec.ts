import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '@core/logging';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';

import { PaypalGetIntentGateway } from './get-intent.gateway';

describe('PaypalGetIntentGateway', () => {
  let gateway: PaypalGetIntentGateway;
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
        PaypalGetIntentGateway,
        { provide: LoggerService, useValue: loggerMock },
      ],
    });

    gateway = TestBed.inject(PaypalGetIntentGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /orders/:id and maps payment intent correctly', () => {
    gateway.execute({ intentId: 'pi_123' }).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.id).toBe('pi_123');
        expect(intent.provider).toBe('paypal');
        expect(intent.amount).toBe(200);
        expect(intent.currency).toBe('MXN');
        expect(intent.status).toBeDefined();
      },
      error: (error) => {
        console.error(error);
        expect.fail('No debería emitir error');
      },
    });

    const req = httpMock.expectOne('/api/payments/paypal/orders/pi_123');
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
    gateway.execute({ intentId: 'pi_error' }).subscribe({
      next: () => {
        expect.fail('Se esperaba error');
      },
      error: (err) => {
        expect(err.code).toBe('provider_error');
        expect(err.raw).toBeDefined();
      },
    });

    const req = httpMock.expectOne('/api/payments/paypal/orders/pi_error');
    expect(req.request.method).toBe('GET');

    req.flush({ message: 'Paypal error' }, { status: 500, statusText: 'Internal Server Error' });
  });
});
