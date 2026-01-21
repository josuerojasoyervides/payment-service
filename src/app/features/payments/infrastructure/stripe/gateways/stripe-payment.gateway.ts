import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { I18nKeys } from "@core/i18n";
import {
    PaymentIntent,
    CancelPaymentRequest,
    ConfirmPaymentRequest,
    CreatePaymentRequest,
    GetPaymentStatusRequest,
    PaymentError,
} from "../../../domain/models";
import {
    StripePaymentIntentDto,
    StripeCreateIntentRequest,
    StripeConfirmIntentRequest,
    StripeSpeiSourceDto,
    StripeCreateResponseDto
} from "../dto/stripe.dto";
import { BasePaymentGateway } from "@payments/shared/base-payment.gateway";
import { ERROR_CODE_MAP } from "../mappers/error-code.mapper";
import { SpeiSourceMapper } from "../mappers/spei-source.mapper";
import { mapPaymentIntent } from "../mappers/payment-intent.mapper";
import { getIdempotencyHeaders } from "../validators/get-idempotency-headers";
import { isStripeErrorResponse } from "../mappers/error-response.mapper";
import { ErrorKeyMapper } from "../mappers/error-key.mapper";


/**
 * Stripe gateway.
 *
 * Stripe-specific features:
 * - Uses PaymentIntents as main model
 * - Amounts in cents (100 = $1.00)
 * - Client secret for client-side authentication
 * - Native 3D Secure with next_action
 * - SPEI via Sources (Mexico)
 * - Idempotency keys for safe operations
 */
@Injectable()
export class StripePaymentGateway extends BasePaymentGateway<StripeCreateResponseDto, StripePaymentIntentDto> {
    readonly providerId = 'stripe' as const;

    private static readonly API_BASE = '/api/payments/stripe';

    /**
     * Creates a PaymentIntent in Stripe.
     */
    protected createIntentRaw(req: CreatePaymentRequest): Observable<StripePaymentIntentDto | StripeSpeiSourceDto> {
        const stripeRequest = this.buildStripeCreateRequest(req);

        if (req.method.type === 'spei') {
            return this.http.post<StripeSpeiSourceDto>(
                `${StripePaymentGateway.API_BASE}/sources`,
                stripeRequest,
                { headers: getIdempotencyHeaders(req.orderId, 'create', req.idempotencyKey) }
            );
        }

        return this.http.post<StripePaymentIntentDto>(
            `${StripePaymentGateway.API_BASE}/intents`,
            stripeRequest,
            { headers: getIdempotencyHeaders(req.orderId, 'create', req.idempotencyKey) }
        );
    }

    protected mapIntent(dto: StripePaymentIntentDto | StripeSpeiSourceDto): PaymentIntent {
        if ('spei' in dto) {
            const mapper = new SpeiSourceMapper(this.providerId);
            return mapper.mapSpeiSource(dto as StripeSpeiSourceDto);
        }
        return mapPaymentIntent(dto as StripePaymentIntentDto, this.providerId);
    }

    /**
     * Confirms an existing PaymentIntent.
     */
    protected confirmIntentRaw(req: ConfirmPaymentRequest): Observable<StripePaymentIntentDto> {
        const stripeRequest: StripeConfirmIntentRequest = {
            return_url: req.returnUrl,
        };

        return this.http.post<StripePaymentIntentDto>(
            `${StripePaymentGateway.API_BASE}/intents/${req.intentId}/confirm`,
            stripeRequest,
            { headers: getIdempotencyHeaders(req.intentId, 'confirm', req.idempotencyKey) }
        );
    }

    protected mapConfirmIntent(dto: StripePaymentIntentDto): PaymentIntent {
        return mapPaymentIntent(dto, this.providerId);
    }

    /**
     * Cancels a PaymentIntent.
     */
    protected cancelIntentRaw(req: CancelPaymentRequest): Observable<StripePaymentIntentDto> {
        return this.http.post<StripePaymentIntentDto>(
            `${StripePaymentGateway.API_BASE}/intents/${req.intentId}/cancel`,
            {},
            { headers: getIdempotencyHeaders(req.intentId, 'cancel', req.idempotencyKey) }
        );
    }

    protected mapCancelIntent(dto: StripePaymentIntentDto): PaymentIntent {
        return mapPaymentIntent(dto, this.providerId);
    }

    /**
     * Gets the current status of a PaymentIntent.
     */
    protected getIntentRaw(req: GetPaymentStatusRequest): Observable<StripePaymentIntentDto> {
        return this.http.get<StripePaymentIntentDto>(
            `${StripePaymentGateway.API_BASE}/intents/${req.intentId}`
        );
    }

    protected mapGetIntent(dto: StripePaymentIntentDto): PaymentIntent {
        return mapPaymentIntent(dto, this.providerId);
    }

    /**
     * Normalizes Stripe errors to our format.
     */
    protected override normalizeError(err: unknown): PaymentError {
        let stripeError: any = null;

        if (err && typeof err === 'object') {
            if (isStripeErrorResponse(err)) {
                stripeError = (err as any).error;
            }
            else if ('error' in err && (err as any).error) {
                const errorBody = (err as any).error;
                if (errorBody && typeof errorBody === 'object' && 'error' in errorBody) {
                    const innerError = errorBody.error;
                    if (innerError && typeof innerError === 'object' && 'type' in innerError && 'code' in innerError) {
                        stripeError = innerError;
                    }
                }
            }
        }

        if (stripeError && typeof stripeError === 'object' && 'code' in stripeError) {

            const mapper = new ErrorKeyMapper();
            return {
                code: ERROR_CODE_MAP[stripeError.code] ?? 'provider_error',
                message: mapper.mapErrorKey(stripeError),
                raw: err,
            };
        }

        if (err && typeof err === 'object' && 'status' in err) {
            const httpError = err as { status: number; message?: string };

            if (httpError.status === 402) {
                return {
                    code: 'card_declined',
                    message: this.i18n.t(I18nKeys.errors.card_declined),
                    raw: err,
                };
            }

            if (httpError.status >= 500) {
                return {
                    code: 'provider_unavailable',
                    message: this.i18n.t(I18nKeys.errors.stripe_unavailable),
                    raw: err,
                };
            }
        }

        return {
            code: 'provider_error',
            message: this.i18n.t(I18nKeys.errors.stripe_error),
            raw: err,
        };
    }

    /**
     * Builds the request in Stripe format.
     */
    private buildStripeCreateRequest(req: CreatePaymentRequest): StripeCreateIntentRequest {
        return {
            amount: Math.round(req.amount * 100),
            currency: req.currency.toLowerCase(),
            payment_method_types: [req.method.type === 'spei' ? 'spei' : 'card'],
            payment_method: req.method.token,
            metadata: {
                order_id: req.orderId,
                created_at: new Date().toISOString(),
            },
            description: `Orden ${req.orderId}`,
        };
    }
}
