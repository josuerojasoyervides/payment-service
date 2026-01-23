import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  PaymentIntent,
  PaymentIntentStatus,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';

import { BasePaymentGateway } from './base-payment-gateway.port';

class PaymentGatewayTest extends BasePaymentGateway<any, any> {
  readonly providerId = 'paypal' as const;

  public mode: 'ok' | 'raw-error' = 'ok';

  protected createIntentRaw(req: CreatePaymentRequest): Observable<unknown> {
    if (this.mode === 'raw-error') return throwError(() => ({ kind: 'RAW_ERROR', detail: 'boom' }));
    return of({
      id: 'pi_123',
      status: 'requires_payment_method',
      amount: req.amount,
      currency: req.currency,
      clientSecret: 'sec_test',
      redirectUrl: undefined,
    });
  }
  protected mapIntent(dto: any): PaymentIntent {
    return this.mapBase(dto);
  }

  protected confirmIntentRaw(req: ConfirmPaymentRequest): Observable<unknown> {
    if (this.mode === 'raw-error') return throwError(() => ({ kind: 'RAW_ERROR', detail: 'boom' }));
    return of({
      id: req.intentId,
      status: 'processing',
      amount: 100,
      currency: 'MXN',
      clientSecret: 'sec_test',
      redirectUrl: undefined,
    });
  }
  protected mapConfirmIntent(dto: any): PaymentIntent {
    return this.mapBase(dto);
  }

  protected cancelIntentRaw(req: CancelPaymentRequest): Observable<unknown> {
    if (this.mode === 'raw-error') return throwError(() => ({ kind: 'RAW_ERROR', detail: 'boom' }));
    return of({
      id: req.intentId,
      status: 'canceled',
      amount: 100,
      currency: 'MXN',
      clientSecret: undefined,
      redirectUrl: undefined,
    });
  }
  protected mapCancelIntent(dto: any): PaymentIntent {
    return this.mapBase(dto);
  }

  protected getIntentRaw(req: GetPaymentStatusRequest): Observable<unknown> {
    if (this.mode === 'raw-error') return throwError(() => ({ kind: 'RAW_ERROR', detail: 'boom' }));
    return of({
      id: req.intentId,
      status: 'requires_action',
      amount: 100,
      currency: 'MXN',
      clientSecret: 'sec_test',
      redirectUrl: 'https://example.com/redirect',
    });
  }
  protected mapGetIntent(dto: any): PaymentIntent {
    return this.mapBase(dto);
  }

  private mapBase(dto: any): PaymentIntent {
    return {
      id: dto.id,
      provider: this.providerId,
      status: dto.status as PaymentIntentStatus,
      amount: dto.amount,
      currency: dto.currency,
      clientSecret: dto.clientSecret,
      redirectUrl: dto.redirectUrl,
      raw: dto,
    };
  }

  protected override normalizeError(err: unknown): PaymentError {
    return {
      code: 'provider_error',
      messageKey: 'errors.provider_error',
      raw: err,
    };
  }
}

class PaymentGatewayBaseErrorTest extends BasePaymentGateway<any, any> {
  providerId: PaymentProviderId = 'paypal';

  protected createIntentRaw(): Observable<unknown> {
    return throwError(() => ({ kind: 'RAW_ERROR', detail: 'boom' }));
  }
  protected mapIntent(dto: any): PaymentIntent {
    return dto as any;
  }

  protected confirmIntentRaw(): Observable<unknown> {
    return throwError(() => ({ kind: 'RAW_ERROR', detail: 'boom' }));
  }
  protected mapConfirmIntent(dto: any): PaymentIntent {
    return dto as any;
  }

  protected cancelIntentRaw(): Observable<unknown> {
    return throwError(() => ({ kind: 'RAW_ERROR', detail: 'boom' }));
  }
  protected mapCancelIntent(dto: any): PaymentIntent {
    return dto as any;
  }

  protected getIntentRaw(): Observable<unknown> {
    return throwError(() => ({ kind: 'RAW_ERROR', detail: 'boom' }));
  }
  protected mapGetIntent(dto: any): PaymentIntent {
    return dto as any;
  }
}

function expectSyncPaymentError(fn: () => unknown, expected: Partial<PaymentError>) {
  try {
    fn();
    throw new Error('Expected to throw PaymentError');
  } catch (e) {
    expect(e).toMatchObject(expected);
  }
}

function validReq(overrides: Partial<CreatePaymentRequest> = {}): CreatePaymentRequest {
  return {
    orderId: 'order_1',
    amount: 100,
    currency: 'MXN',
    method: { type: 'card', token: 'tok_123' },
    ...overrides,
  };
}

function validConfirmReq(overrides: Partial<ConfirmPaymentRequest> = {}): ConfirmPaymentRequest {
  return {
    intentId: 'pi_123',
    ...overrides,
  };
}

function validCancelReq(overrides: Partial<CancelPaymentRequest> = {}): CancelPaymentRequest {
  return {
    intentId: 'pi_123',
    ...overrides,
  };
}

function validGetStatusReq(
  overrides: Partial<GetPaymentStatusRequest> = {},
): GetPaymentStatusRequest {
  return {
    intentId: 'pi_123',
    ...overrides,
  };
}

describe('PaymentGateway (abstract class)', () => {
  let gateway: PaymentGatewayTest;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    gateway = TestBed.runInInjectionContext(() => new PaymentGatewayTest());
  });

  describe('createIntent', () => {
    describe('validations', () => {
      it('throws if orderId is missing (validateCreate)', () => {
        expectSyncPaymentError(() => gateway.createIntent(validReq({ orderId: '' })), {
          code: 'invalid_request',
          messageKey: 'errors.order_id_required',
          params: { field: 'orderId' },
        });
      });

      it('throws if currency is missing (validateCreate)', () => {
        expectSyncPaymentError(() => gateway.createIntent(validReq({ currency: '' as any })), {
          code: 'invalid_request',
          messageKey: 'errors.currency_required',
          params: { field: 'currency' },
        });
      });

      it('throws if amount is not valid (validateCreate)', () => {
        expectSyncPaymentError(() => gateway.createIntent(validReq({ amount: 0 })), {
          code: 'invalid_request',
          messageKey: 'errors.amount_invalid',
          params: { field: 'amount', min: 1 },
          raw: { amount: 0 },
        });
      });

      it('throws if method type is missing', () => {
        expectSyncPaymentError(() => gateway.createIntent(validReq({ method: undefined as any })), {
          code: 'invalid_request',
          messageKey: 'errors.payment_method_type_required',
          params: { field: 'method.type' },
        });
      });

      it('throws if method type is card but token is missing', () => {
        expectSyncPaymentError(
          () => gateway.createIntent(validReq({ method: { type: 'card' } } as any)),
          {
            code: 'invalid_request',
            messageKey: 'errors.card_token_required',
            params: { field: 'method.token' },
          },
        );
      });

      it('does not require token when method type is spei', async () => {
        const req = validReq({ method: { type: 'spei' } as any });
        const res = await firstValueFrom(gateway.createIntent(req));
        expect(res.provider).toBe('paypal');
      });
    });

    describe('happy path', () => {
      it('should execute createIntentRaw', async () => {
        const spy = vi.spyOn(gateway as any, 'createIntentRaw');
        await firstValueFrom(gateway.createIntent(validReq()));
        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('should execute mapIntent', async () => {
        const spy = vi.spyOn(gateway as any, 'mapIntent');
        await firstValueFrom(gateway.createIntent(validReq()));
        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('maps dto -> PaymentIntent when raw call succeeds', async () => {
        const res = await firstValueFrom(gateway.createIntent(validReq({ amount: 250 })));

        expect(res).toEqual(
          expect.objectContaining({
            id: 'pi_123',
            provider: 'paypal',
            status: 'requires_payment_method',
            amount: 250,
            currency: 'MXN',
            clientSecret: 'sec_test',
          }),
        );

        expect(res.raw).toBeTruthy();
      });
    });

    describe('error handling', () => {
      it('normalizes error when raw call fails', async () => {
        gateway.mode = 'raw-error';

        await expect(firstValueFrom(gateway.createIntent(validReq()))).rejects.toMatchObject({
          code: 'provider_error',
          messageKey: 'errors.provider_error',
          raw: { kind: 'RAW_ERROR', detail: 'boom' },
        });
      });

      it('uses base normalizeError when subclass does not override it', async () => {
        const gateway = TestBed.runInInjectionContext(() => new PaymentGatewayBaseErrorTest());

        await expect(firstValueFrom(gateway.createIntent(validReq()))).rejects.toMatchObject({
          code: 'provider_error',
          messageKey: 'errors.provider_error',
          raw: { kind: 'RAW_ERROR', detail: 'boom' },
        });
      });
    });
  });

  describe('confirm', () => {
    describe('validations', () => {
      it('throws if intentId is missing (validateConfirm)', () => {
        expectSyncPaymentError(() => gateway.confirmIntent(validConfirmReq({ intentId: '' })), {
          code: 'invalid_request',
          messageKey: 'errors.intent_id_required',
          params: { field: 'intentId' },
        });
      });
    });

    describe('happy path', () => {
      it('executes confirmIntentRaw and mapConfirmIntent', async () => {
        const rawSpy = vi.spyOn(gateway as any, 'confirmIntentRaw');
        const mapSpy = vi.spyOn(gateway as any, 'mapConfirmIntent');

        await firstValueFrom(gateway.confirmIntent(validConfirmReq()));

        expect(rawSpy).toHaveBeenCalledTimes(1);
        expect(mapSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('error handling', () => {
      it('normalizes error when raw call fails', async () => {
        gateway.mode = 'raw-error';

        await expect(
          firstValueFrom(gateway.confirmIntent(validConfirmReq())),
        ).rejects.toMatchObject({
          code: 'provider_error',
          messageKey: 'errors.provider_error',
          raw: { kind: 'RAW_ERROR', detail: 'boom' },
        });
      });

      it('uses base normalizeError when subclass does not override it', async () => {
        const gateway = TestBed.runInInjectionContext(() => new PaymentGatewayBaseErrorTest());

        await expect(
          firstValueFrom(gateway.confirmIntent(validConfirmReq())),
        ).rejects.toMatchObject({
          code: 'provider_error',
          messageKey: 'errors.provider_error',
          raw: { kind: 'RAW_ERROR', detail: 'boom' },
        });
      });
    });
  });

  describe('cancel', () => {
    describe('validations', () => {
      it('throws if intentId is missing (validateCancel)', () => {
        expectSyncPaymentError(() => gateway.cancelIntent(validCancelReq({ intentId: '' })), {
          code: 'invalid_request',
          messageKey: 'errors.intent_id_required',
          params: { field: 'intentId' },
        });
      });
    });

    describe('happy path', () => {
      it('executes cancelIntentRaw and mapCancelIntent', async () => {
        const rawSpy = vi.spyOn(gateway as any, 'cancelIntentRaw');
        const mapSpy = vi.spyOn(gateway as any, 'mapCancelIntent');

        await firstValueFrom(gateway.cancelIntent(validCancelReq()));

        expect(rawSpy).toHaveBeenCalledTimes(1);
        expect(mapSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('error handling', () => {
      it('normalizes error when raw call fails', async () => {
        gateway.mode = 'raw-error';

        await expect(firstValueFrom(gateway.cancelIntent(validCancelReq()))).rejects.toMatchObject({
          code: 'provider_error',
          messageKey: 'errors.provider_error',
          raw: { kind: 'RAW_ERROR', detail: 'boom' },
        });
      });

      it('uses base normalizeError when subclass does not override it', async () => {
        const gateway = TestBed.runInInjectionContext(() => new PaymentGatewayBaseErrorTest());

        await expect(firstValueFrom(gateway.cancelIntent(validCancelReq()))).rejects.toMatchObject({
          code: 'provider_error',
          messageKey: 'errors.provider_error',
          raw: { kind: 'RAW_ERROR', detail: 'boom' },
        });
      });
    });
  });

  describe('get', () => {
    describe('validations', () => {
      it('throws if intentId is missing (validateGetStatus)', () => {
        expectSyncPaymentError(() => gateway.getIntent(validGetStatusReq({ intentId: '' })), {
          code: 'invalid_request',
          messageKey: 'errors.intent_id_required',
          params: { field: 'intentId' },
        });
      });
    });

    describe('happy path', () => {
      it('executes getIntentRaw and mapGetIntent', async () => {
        const rawSpy = vi.spyOn(gateway as any, 'getIntentRaw');
        const mapSpy = vi.spyOn(gateway as any, 'mapGetIntent');

        await firstValueFrom(gateway.getIntent(validGetStatusReq()));

        expect(rawSpy).toHaveBeenCalledTimes(1);
        expect(mapSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('error handling', () => {
      it('normalizes error when raw call fails', async () => {
        gateway.mode = 'raw-error';

        await expect(firstValueFrom(gateway.getIntent(validGetStatusReq()))).rejects.toMatchObject({
          code: 'provider_error',
          messageKey: 'errors.provider_error',
          raw: { kind: 'RAW_ERROR', detail: 'boom' },
        });
      });

      it('uses base normalizeError when subclass does not override it', async () => {
        const gateway = TestBed.runInInjectionContext(() => new PaymentGatewayBaseErrorTest());

        await expect(firstValueFrom(gateway.getIntent(validGetStatusReq()))).rejects.toMatchObject({
          code: 'provider_error',
          messageKey: 'errors.provider_error',
          raw: { kind: 'RAW_ERROR', detail: 'boom' },
        });
      });
    });
  });
});
