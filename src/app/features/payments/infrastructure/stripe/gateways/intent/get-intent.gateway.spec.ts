import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { PaymentIntent } from '@payments/domain/models';

import { StripeGetIntentGateway } from './get-intent.gateway';

describe('StripeGetIntentGateway', () => {
  let gateway: StripeGetIntentGateway;
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
        StripeGetIntentGateway,
        { provide: I18nService, useValue: i18nMock },
        { provide: LoggerService, useValue: loggerMock },
      ],
    });

    gateway = TestBed.inject(StripeGetIntentGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /intents/:id and maps payment intent correctly', () => {
    gateway.execute({ intentId: 'pi_123' }).subscribe({
      next: (intent: PaymentIntent) => {
        expect(intent.id).toBe('pi_123');
        expect(intent.provider).toBe('stripe');
        expect(intent.amount).toBe(200);
        expect(intent.currency).toBe('MXN');
        expect(intent.status).toBeDefined();
      },
      error: () => {
        expect.fail('No debería emitir error');
      },
    });

    const req = httpMock.expectOne('/api/payments/stripe/intents/pi_123');
    expect(req.request.method).toBe('GET');

    req.flush({
      id: 'pi_123',
      status: 'succeeded',
      amount: 20000,
      currency: 'mxn',
      metadata: {
        order_id: 'order_123',
      },
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

    const req = httpMock.expectOne('/api/payments/stripe/intents/pi_error');
    expect(req.request.method).toBe('GET');

    req.flush({ message: 'Stripe error' }, { status: 500, statusText: 'Internal Server Error' });
  });
});
