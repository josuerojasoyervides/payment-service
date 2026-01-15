import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { PaymentProviderId, CreatePaymentRequest, PaymentIntent, PaymentStatus } from '../models/payment.types';
import { PaymentGateway } from './payment-gateway.port'
import { PaymentError } from '../models/payment.errors';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

class PaymentGatewayTest extends PaymentGateway {
    providerId: PaymentProviderId = 'paypal'

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
        })
    }
    protected mapIntent(dto: any): PaymentIntent {
        return {
            id: dto.id,
            provider: this.providerId, // 'paypal'
            status: dto.status as PaymentStatus,
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
            message: 'Test normalized error',
            raw: err
        }
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

describe('PaymentGateway (abstract class) - createIntent', () => {

    let gateway: PaymentGatewayTest;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });

        gateway = TestBed.runInInjectionContext(() => new PaymentGatewayTest())
    });

    describe('validations', () => {
        it('throws if orderId is missing (validateCreate)', () => {
            expect(() => gateway.createIntent(validReq({ orderId: '' })))
                .toThrowError('orderId is required')
        })

        it('throws if currency is missing (validCreate)', () => {
            expect(() => gateway.createIntent(validReq({ currency: '' })))
                .toThrowError('currency is required')
        })

        it('throws if amount is not valid (validCreate)', () => {
            expect(() => gateway.createIntent(validReq({ amount: 0 })))
                .toThrowError('amount is invalid')
        })

        it('throws if method type is missing', () => {
            expect(() => gateway.createIntent(validReq({ method: {} as any })))
                .toThrowError('payment method type is required')
        })

        it('throws if method type is card but token is missing', () => {
            expect(() => gateway.createIntent(validReq({ method: { type: 'card' } } as any)))
                .toThrowError('card token is required')
        })

        it('does not require token when method type is spei', async () => {
            const req = validReq({ method: { type: 'spei' } as any });
            const res = await firstValueFrom(gateway.createIntent(req));
            expect(res.provider).toBe('paypal');
        });
    })

    describe('createIntent flow', () => {
        it('should execute createIntentRaw', async () => {
            const spy = vi.spyOn(gateway as any, 'createIntentRaw');
            await firstValueFrom(gateway.createIntent(validReq()));
            expect(spy).toHaveBeenCalledTimes(1);
        })

        it('should execute mapIntent', async () => {
            const spy = vi.spyOn(gateway as any, 'mapIntent');
            await firstValueFrom(gateway.createIntent(validReq()));
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('maps dto -> PaymentIntent when raw call succeeds', async () => {
            const res = await firstValueFrom(gateway.createIntent(validReq({ amount: 250 })))

            expect(res).toEqual(
                expect.objectContaining({
                    id: 'pi_123',
                    provider: 'paypal',
                    status: 'requires_payment_method',
                    amount: 250,
                    currency: 'MXN',
                    clientSecret: 'sec_test'
                })
            )

            expect(res.raw).toBeTruthy()
        })
    })

    describe('error handling', () => {
        it('normalizes error when raw call fails', async () => {
            gateway.mode = 'raw-error';

            await expect(firstValueFrom(gateway.createIntent(validReq())))
                .rejects.toMatchObject({
                    code: 'provider_error',
                    message: 'Test normalized error',
                    raw: { kind: 'RAW_ERROR', detail: 'boom' }
                })
        })
    })
});