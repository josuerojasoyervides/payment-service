import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { PaymentGateway } from "../../../domain/ports";
import { I18nService } from "@core/i18n";
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


/**
 * Gateway de Stripe.
 *
 * Características específicas de Stripe:
 * - Usa PaymentIntents como modelo principal
 * - Montos en centavos (100 = $1.00)
 * - Client secret para autenticación client-side
 * - 3D Secure nativo con next_action
 * - SPEI via Sources (México)
 * - Idempotency keys para operaciones seguras
 */
@Injectable()
export class StripePaymentGateway extends PaymentGateway<StripeCreateResponseDto, StripePaymentIntentDto> {
    readonly providerId = 'stripe' as const;

    private static readonly API_BASE = '/api/payments/stripe';

    // Mapeo de estados Stripe → estados internos
    private static readonly STATUS_MAP: Record<StripePaymentIntentStatus, PaymentIntentStatus> = {
        'requires_payment_method': 'requires_payment_method',
        'requires_confirmation': 'requires_confirmation',
        'requires_action': 'requires_action',
        'processing': 'processing',
        'requires_capture': 'processing', // Mapeamos a processing ya que está pendiente
        'canceled': 'canceled',
        'succeeded': 'succeeded',
    };

    // Mapeo de códigos de error Stripe → códigos internos
    private static readonly ERROR_CODE_MAP: Record<string, PaymentErrorCode> = {
        'card_declined': 'card_declined',
        'expired_card': 'card_declined',
        'incorrect_cvc': 'card_declined',
        'processing_error': 'provider_error',
        'incorrect_number': 'invalid_request',
        'invalid_expiry_month': 'invalid_request',
        'invalid_expiry_year': 'invalid_request',
        'authentication_required': 'requires_action',
    };

    /**
     * Crea un PaymentIntent en Stripe.
     */
    protected createIntentRaw(req: CreatePaymentRequest): Observable<StripePaymentIntentDto | StripeSpeiSourceDto> {
        const stripeRequest = this.buildStripeCreateRequest(req);

        // SPEI usa un endpoint diferente (Sources)
        if (req.method.type === 'spei') {
            return this.http.post<StripeSpeiSourceDto>(
                `${StripePaymentGateway.API_BASE}/sources`,
                stripeRequest,
                { headers: this.getIdempotencyHeaders(req.orderId, 'create') }
            );
        }

        return this.http.post<StripePaymentIntentDto>(
            `${StripePaymentGateway.API_BASE}/intents`,
            stripeRequest,
            { headers: this.getIdempotencyHeaders(req.orderId, 'create') }
        );
    }

    protected mapIntent(dto: StripePaymentIntentDto | StripeSpeiSourceDto): PaymentIntent {
        // Detectar si es Source (SPEI) o PaymentIntent
        if ('spei' in dto) {
            return this.mapSpeiSource(dto as StripeSpeiSourceDto);
        }
        return this.mapPaymentIntent(dto as StripePaymentIntentDto);
    }

    /**
     * Confirma un PaymentIntent existente.
     */
    protected confirmIntentRaw(req: ConfirmPaymentRequest): Observable<StripePaymentIntentDto> {
        const stripeRequest: StripeConfirmIntentRequest = {
            return_url: req.returnUrl,
        };

        return this.http.post<StripePaymentIntentDto>(
            `${StripePaymentGateway.API_BASE}/intents/${req.intentId}/confirm`,
            stripeRequest,
            { headers: this.getIdempotencyHeaders(req.intentId, 'confirm') }
        );
    }

    protected mapConfirmIntent(dto: StripePaymentIntentDto): PaymentIntent {
        return this.mapPaymentIntent(dto);
    }

    /**
     * Cancela un PaymentIntent.
     */
    protected cancelIntentRaw(req: CancelPaymentRequest): Observable<StripePaymentIntentDto> {
        return this.http.post<StripePaymentIntentDto>(
            `${StripePaymentGateway.API_BASE}/intents/${req.intentId}/cancel`,
            {},
            { headers: this.getIdempotencyHeaders(req.intentId, 'cancel') }
        );
    }

    protected mapCancelIntent(dto: StripePaymentIntentDto): PaymentIntent {
        return this.mapPaymentIntent(dto);
    }

    /**
     * Obtiene el estado actual de un PaymentIntent.
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
     * Normaliza errores de Stripe a nuestro formato.
     */
    protected override normalizeError(err: unknown): PaymentError {
        // Stripe retorna errores en formato { error: { type, code, message } }
        // Cuando viene de HttpErrorResponse, el body está en err.error
        let stripeError: any = null;

        if (err && typeof err === 'object') {
            // Caso 1: Error viene directamente como { error: { type, code, ... } }
            if (this.isStripeErrorResponse(err)) {
                stripeError = (err as any).error;
            }
            // Caso 2: Error viene envuelto en HttpErrorResponse (err.error contiene el body)
            else if ('error' in err && (err as any).error) {
                const errorBody = (err as any).error;
                // El body puede ser { error: { ... } } (estructura de Stripe)
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
                code: StripePaymentGateway.ERROR_CODE_MAP[stripeError.code] ?? 'provider_error',
                message: this.humanizeStripeError(stripeError),
                raw: err,
            };
        }

        // Error HTTP genérico
        if (err && typeof err === 'object' && 'status' in err) {
            const httpError = err as { status: number; message?: string };

            if (httpError.status === 402) {
                return {
                    code: 'card_declined',
                    message: this.i18n.t('errors.card_declined'),
                    raw: err,
                };
            }

            if (httpError.status >= 500) {
                return {
                    code: 'provider_unavailable',
                    message: this.i18n.t('errors.stripe_unavailable'),
                    raw: err,
                };
            }
        }

        // Fallback: usar mensaje genérico de Stripe
        return {
            code: 'provider_error',
            message: this.i18n.t('errors.stripe_error'),
            raw: err,
        };
    }

    // ============ MAPEO PRIVADO ============

    /**
     * Mapea un PaymentIntent de Stripe a nuestro modelo.
     */
    private mapPaymentIntent(dto: StripePaymentIntentDto): PaymentIntent {
        const status = StripePaymentGateway.STATUS_MAP[dto.status] ?? 'processing';

        const intent: PaymentIntent = {
            id: dto.id,
            provider: this.providerId,
            status,
            // Stripe usa centavos, convertimos a unidades
            amount: dto.amount / 100,
            currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
            clientSecret: dto.client_secret,
            raw: dto,
        };

        // Mapear next_action si existe
        if (dto.next_action) {
            intent.nextAction = this.mapStripeNextAction(dto);
        }

        return intent;
    }

    /**
     * Mapea un Source SPEI de Stripe a nuestro modelo.
     */
    private mapSpeiSource(dto: StripeSpeiSourceDto): PaymentIntent {
        const speiAction: NextActionSpei = {
            type: 'spei',
            instructions: 'Realiza una transferencia SPEI con los siguientes datos:',
            clabe: dto.spei.clabe,
            reference: dto.spei.reference,
            bank: dto.spei.bank,
            beneficiary: 'Stripe Payments Mexico',
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
     * Mapea next_action de Stripe a nuestro modelo.
     */
    private mapStripeNextAction(dto: StripePaymentIntentDto): NextActionThreeDs | undefined {
        if (!dto.next_action) return undefined;

        if (dto.next_action.type === 'redirect_to_url' && dto.next_action.redirect_to_url) {
            // 3DS vía redirección
            return {
                type: '3ds',
                clientSecret: dto.client_secret,
                returnUrl: dto.next_action.redirect_to_url.return_url,
                threeDsVersion: '2.0',
            };
        }

        if (dto.next_action.type === 'use_stripe_sdk') {
            // 3DS vía Stripe.js
            return {
                type: '3ds',
                clientSecret: dto.client_secret,
                returnUrl: '', // Se maneja en el SDK
                threeDsVersion: '2.0',
            };
        }

        return undefined;
    }

    /**
     * Mapea estados de SPEI Source a nuestros estados.
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
     * Construye el request en formato Stripe.
     */
    private buildStripeCreateRequest(req: CreatePaymentRequest): StripeCreateIntentRequest {
        return {
            // Stripe usa centavos
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
     * Genera headers de idempotencia para operaciones seguras.
     */
    private getIdempotencyHeaders(key: string, operation: string): Record<string, string> {
        return {
            'Idempotency-Key': `${key}-${operation}-${Date.now()}`,
        };
    }

    /**
     * Type guard para errores de Stripe.
     */
    private isStripeErrorResponse(err: unknown): err is { error: StripeErrorResponse['error'] } {
        return err !== null &&
            typeof err === 'object' &&
            'error' in err &&
            typeof (err as any).error === 'object' &&
            'type' in (err as any).error;
    }

    /**
     * Convierte errores técnicos de Stripe a mensajes legibles.
     */
    private humanizeStripeError(error: StripeErrorResponse['error']): string {
        const errorKeyMap: Record<string, string> = {
            'card_declined': 'errors.card_declined',
            'expired_card': 'errors.expired_card',
            'incorrect_cvc': 'errors.incorrect_cvc',
            'processing_error': 'errors.processing_error',
            'incorrect_number': 'errors.incorrect_number',
            'authentication_required': 'errors.authentication_required',
        };

        const translationKey = errorKeyMap[error.code];
        if (translationKey) {
            return this.i18n.t(translationKey);
        }

        return error.message ?? this.i18n.t('errors.stripe_error');
    }
}
