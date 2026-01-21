import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { PaymentGateway } from "../../../domain/ports";
import { I18nService, I18nKeys } from "@core/i18n";
import {
    PaymentIntent,
    PaymentIntentStatus,
    CancelPaymentRequest,
    ConfirmPaymentRequest,
    CreatePaymentRequest,
    GetPaymentStatusRequest,
    PaymentError,
    PaymentErrorCode,
    NextActionSpei,
    NextActionThreeDs,
} from "../../../domain/models";
import {
    StripePaymentIntentDto,
    StripePaymentIntentStatus,
    StripeCreateIntentRequest,
    StripeConfirmIntentRequest,
    StripeErrorResponse,
    StripeSpeiSourceDto,
    StripeCreateResponseDto
} from "../dto/stripe.dto";
import { BasePaymentGateway } from "@payments/shared/base-payment.gateway";
import { ERROR_CODE_MAP } from "../mappers/error-code.mapper";
import { STATUS_MAP } from "../mappers/internal-status.mapper";


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
                { headers: this.getIdempotencyHeaders(req.orderId, 'create', req.idempotencyKey) }
            );
        }

        return this.http.post<StripePaymentIntentDto>(
            `${StripePaymentGateway.API_BASE}/intents`,
            stripeRequest,
            { headers: this.getIdempotencyHeaders(req.orderId, 'create', req.idempotencyKey) }
        );
    }

    protected mapIntent(dto: StripePaymentIntentDto | StripeSpeiSourceDto): PaymentIntent {
        if ('spei' in dto) {
            return this.mapSpeiSource(dto as StripeSpeiSourceDto);
        }
        return this.mapPaymentIntent(dto as StripePaymentIntentDto);
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
            { headers: this.getIdempotencyHeaders(req.intentId, 'confirm', req.idempotencyKey) }
        );
    }

    protected mapConfirmIntent(dto: StripePaymentIntentDto): PaymentIntent {
        return this.mapPaymentIntent(dto);
    }

    /**
     * Cancels a PaymentIntent.
     */
    protected cancelIntentRaw(req: CancelPaymentRequest): Observable<StripePaymentIntentDto> {
        return this.http.post<StripePaymentIntentDto>(
            `${StripePaymentGateway.API_BASE}/intents/${req.intentId}/cancel`,
            {},
            { headers: this.getIdempotencyHeaders(req.intentId, 'cancel', req.idempotencyKey) }
        );
    }

    protected mapCancelIntent(dto: StripePaymentIntentDto): PaymentIntent {
        return this.mapPaymentIntent(dto);
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
        return this.mapPaymentIntent(dto);
    }

    /**
     * Normalizes Stripe errors to our format.
     */
    protected override normalizeError(err: unknown): PaymentError {
        let stripeError: any = null;

        if (err && typeof err === 'object') {
            if (this.isStripeErrorResponse(err)) {
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
            return {
                code: ERROR_CODE_MAP[stripeError.code] ?? 'provider_error',
                message: this.humanizeStripeError(stripeError),
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

    // ============ PRIVATE MAPPING ============

    /**
     * Maps a Stripe PaymentIntent to our model.
     */
    private mapPaymentIntent(dto: StripePaymentIntentDto): PaymentIntent {
        const status = STATUS_MAP[dto.status] ?? 'processing';

        const intent: PaymentIntent = {
            id: dto.id,
            provider: this.providerId,
            status,
            amount: dto.amount / 100,
            currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
            clientSecret: dto.client_secret,
            raw: dto,
        };

        if (dto.next_action) {
            intent.nextAction = this.mapStripeNextAction(dto);
        }

        return intent;
    }

    /**
     * Maps a Stripe SPEI Source to our model.
     */
    private mapSpeiSource(dto: StripeSpeiSourceDto): PaymentIntent {
        const speiAction: NextActionSpei = {
            type: 'spei',
            instructions: this.i18n.t(I18nKeys.messages.spei_instructions),
            clabe: dto.spei.clabe,
            reference: dto.spei.reference,
            bank: dto.spei.bank,
            beneficiary: this.i18n.t(I18nKeys.ui.stripe_beneficiary),
            amount: dto.amount / 100,
            currency: dto.currency.toUpperCase(),
            expiresAt: new Date(dto.expires_at * 1000).toISOString(),
        };

        return {
            id: dto.id,
            provider: this.providerId,
            status: this.mapSpeiStatus(dto.status),
            amount: dto.amount / 100,
            currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
            nextAction: speiAction,
            raw: dto,
        };
    }

    /**
     * Maps Stripe next_action to our model.
     */
    private mapStripeNextAction(dto: StripePaymentIntentDto): NextActionThreeDs | undefined {
        if (!dto.next_action) return undefined;

        if (dto.next_action.type === 'redirect_to_url' && dto.next_action.redirect_to_url) {
            return {
                type: '3ds',
                clientSecret: dto.client_secret,
                returnUrl: dto.next_action.redirect_to_url.return_url,
                threeDsVersion: '2.0',
            };
        }

        if (dto.next_action.type === 'use_stripe_sdk') {
            return {
                type: '3ds',
                clientSecret: dto.client_secret,
                returnUrl: '',
                threeDsVersion: '2.0',
            };
        }

        return undefined;
    }

    /**
     * Maps SPEI Source statuses to our statuses.
     */
    private mapSpeiStatus(status: StripeSpeiSourceDto['status']): PaymentIntentStatus {
        const map: Record<StripeSpeiSourceDto['status'], PaymentIntentStatus> = {
            'pending': 'requires_action',
            'chargeable': 'requires_confirmation',
            'consumed': 'succeeded',
            'canceled': 'canceled',
            'failed': 'failed',
        };
        return map[status] ?? 'processing';
    }

    // ============ HELPERS ============

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

    /**
     * Generates idempotency headers for safe operations.
     * 
     * Uses the idempotency key from the request if available (stable for retries),
     * otherwise falls back to generating a key based on operation and identifier.
     */
    private getIdempotencyHeaders(
        key: string,
        operation: string,
        idempotencyKey?: string
    ): Record<string, string> {
        const finalKey = idempotencyKey ?? `${key}-${operation}-${Date.now()}`;
        return {
            'Idempotency-Key': finalKey,
        };
    }

    /**
     * Type guard for Stripe errors.
     */
    private isStripeErrorResponse(err: unknown): err is { error: StripeErrorResponse['error'] } {
        return err !== null &&
            typeof err === 'object' &&
            'error' in err &&
            typeof (err as any).error === 'object' &&
            'type' in (err as any).error;
    }

    /**
     * Converts technical Stripe errors to readable messages.
     */
    private humanizeStripeError(error: StripeErrorResponse['error']): string {
        const errorKeyMap: Partial<Record<string, string>> = {
            'card_declined': I18nKeys.errors.card_declined,
            'expired_card': I18nKeys.errors.expired_card,
            'incorrect_cvc': I18nKeys.errors.incorrect_cvc,
            'processing_error': I18nKeys.errors.processing_error,
            'incorrect_number': I18nKeys.errors.incorrect_number,
            'authentication_required': I18nKeys.errors.authentication_required,
        };

        const translationKey = errorKeyMap[error.code];
        if (translationKey) {
            return this.i18n.t(translationKey);
        }

        return error.message ?? this.i18n.t(I18nKeys.errors.stripe_error);
    }
}
