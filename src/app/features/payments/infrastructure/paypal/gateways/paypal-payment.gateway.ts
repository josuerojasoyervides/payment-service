import { Injectable, inject } from '@angular/core';
import { 
    PaymentIntent, 
    PaymentIntentStatus,
    CancelPaymentRequest, 
    ConfirmPaymentRequest, 
    CreatePaymentRequest, 
    GetPaymentStatusRequest,
    PaymentError, 
    PaymentErrorCode,
    NextActionPaypalApprove,
} from '../../../domain/models';
import { PaymentGateway } from '../../../domain/ports';
import { Observable } from 'rxjs';
import { I18nService } from '@core/i18n';
import {
    PaypalOrderDto,
    PaypalOrderStatus,
    PaypalCreateOrderRequest,
    PaypalErrorResponse,
    findPaypalLink
} from '../dto/paypal.dto';

/**
 * Gateway de PayPal (Orders API v2).
 *
 * Diferencias clave vs Stripe:
 * - PayPal usa "Orders" en lugar de "PaymentIntents"
 * - Montos como strings con 2 decimales ("100.00")
 * - Flujo: Create Order → Approve (redirect) → Capture
 * - Links HATEOAS para navegación
 * - Sin client_secret, usa cookies de sesión
 */
@Injectable()
export class PaypalPaymentGateway extends PaymentGateway<PaypalOrderDto, PaypalOrderDto> {
    readonly providerId = 'paypal' as const;

    private static readonly API_BASE = '/api/payments/paypal';

    // Mapeo de estados PayPal → estados internos
    private static readonly STATUS_MAP: Record<PaypalOrderStatus, PaymentIntentStatus> = {
        'CREATED': 'requires_action',          // Necesita aprobación del usuario
        'SAVED': 'requires_confirmation',       // Guardada, pendiente de captura
        'APPROVED': 'requires_confirmation',    // Aprobada, lista para capturar
        'VOIDED': 'canceled',
        'COMPLETED': 'succeeded',
        'PAYER_ACTION_REQUIRED': 'requires_action',
    };

    // Mapeo de errores PayPal → errores internos
    private static readonly ERROR_MAP: Record<string, PaymentErrorCode> = {
        'INVALID_REQUEST': 'invalid_request',
        'PERMISSION_DENIED': 'provider_error',
        'RESOURCE_NOT_FOUND': 'invalid_request',
        'UNPROCESSABLE_ENTITY': 'invalid_request',
        'INSTRUMENT_DECLINED': 'card_declined',
        'ORDER_NOT_APPROVED': 'requires_action',
        'INTERNAL_SERVICE_ERROR': 'provider_unavailable',
    };

    /**
     * Crea una Order en PayPal.
     *
     * PayPal no crea un "intent" directamente - crea una Order
     * que el usuario debe aprobar antes de poder capturar.
     */
    protected createIntentRaw(req: CreatePaymentRequest): Observable<PaypalOrderDto> {
        const paypalRequest = this.buildPaypalCreateRequest(req);

        return this.http.post<PaypalOrderDto>(
            `${PaypalPaymentGateway.API_BASE}/orders`,
            paypalRequest,
            {
                headers: {
                    'PayPal-Request-Id': this.generateRequestId(req.orderId),
                    'Prefer': 'return=representation', // Retornar orden completa
                },
            }
        );
    }

    protected mapIntent(dto: PaypalOrderDto): PaymentIntent {
        return this.mapOrder(dto);
    }

    /**
     * Confirma (captura) una Order aprobada.
     *
     * En PayPal, "confirm" = "capture" - el paso final después de que
     * el usuario aprobó en PayPal.
     */
    protected confirmIntentRaw(req: ConfirmPaymentRequest): Observable<PaypalOrderDto> {
        return this.http.post<PaypalOrderDto>(
            `${PaypalPaymentGateway.API_BASE}/orders/${req.intentId}/capture`,
            {},
            {
                headers: {
                    'PayPal-Request-Id': this.generateRequestId(req.intentId, 'capture'),
                },
            }
        );
    }

    protected mapConfirmIntent(dto: PaypalOrderDto): PaymentIntent {
        return this.mapOrder(dto);
    }

    /**
     * Cancela (void) una Order.
     *
     * PayPal no tiene un endpoint directo de "cancel" para orders.
     * Solo se pueden cancelar autorizaciones. Para orders no aprobadas,
     * simplemente expiran.
     */
    protected cancelIntentRaw(req: CancelPaymentRequest): Observable<PaypalOrderDto> {
        // PayPal usa PATCH para actualizar el estado
        // En realidad, las orders no se "cancelan" - se voidan las autorizaciones
        return this.http.post<PaypalOrderDto>(
            `${PaypalPaymentGateway.API_BASE}/orders/${req.intentId}/void`,
            {}
        );
    }

    protected mapCancelIntent(dto: PaypalOrderDto): PaymentIntent {
        return this.mapOrder(dto);
    }

    /**
     * Obtiene el estado actual de una Order.
     */
    protected getIntentRaw(req: GetPaymentStatusRequest): Observable<PaypalOrderDto> {
        return this.http.get<PaypalOrderDto>(
            `${PaypalPaymentGateway.API_BASE}/orders/${req.intentId}`
        );
    }

    protected mapGetIntent(dto: PaypalOrderDto): PaymentIntent {
        return this.mapOrder(dto);
    }

    /**
     * Override de validación: PayPal no requiere token para métodos card.
     * PayPal usa su propio flujo de redirección.
     */
    protected override validateCreate(req: CreatePaymentRequest) {
        if (!req.orderId) throw new Error("orderId is required");
        if (!req.currency) throw new Error("currency is required");
        if (!Number.isFinite(req.amount) || req.amount <= 0) throw new Error("amount is invalid");
        if (!req.method?.type) throw new Error("payment method type is required");
        // PayPal no requiere token - usa flujo de redirección
    }

    /**
     * Normaliza errores de PayPal a nuestro formato.
     */
    protected override normalizeError(err: unknown): PaymentError {
        if (this.isPaypalErrorResponse(err)) {
            return {
                code: PaypalPaymentGateway.ERROR_MAP[err.name] ?? 'provider_error',
                message: this.humanizePaypalError(err),
                raw: err,
            };
        }

        // Error HTTP genérico
        if (err && typeof err === 'object' && 'status' in err) {
            const httpError = err as { status: number };

            if (httpError.status === 401) {
                return {
                    code: 'provider_error',
                    message: this.i18n.t('errors.paypal_auth_error'),
                    raw: err,
                };
            }

            if (httpError.status >= 500) {
                return {
                    code: 'provider_unavailable',
                    message: this.i18n.t('errors.paypal_unavailable'),
                    raw: err,
                };
            }
        }

        return super.normalizeError(err);
    }

    // ============ MAPEO PRIVADO ============

    /**
     * Mapea una Order de PayPal a nuestro modelo de PaymentIntent.
     */
    private mapOrder(dto: PaypalOrderDto): PaymentIntent {
        const status = PaypalPaymentGateway.STATUS_MAP[dto.status] ?? 'processing';
        const purchaseUnit = dto.purchase_units[0];

        // Extraer monto (PayPal usa strings)
        const amount = parseFloat(purchaseUnit?.amount?.value ?? '0');
        const currency = purchaseUnit?.amount?.currency_code as 'MXN' | 'USD';

        const intent: PaymentIntent = {
            id: dto.id,
            provider: this.providerId,
            status,
            amount,
            currency,
            raw: dto,
        };

        // Agregar URL de aprobación si está pendiente
        if (dto.status === 'CREATED' || dto.status === 'PAYER_ACTION_REQUIRED') {
            const approveUrl = findPaypalLink(dto.links, 'approve');
            if (approveUrl) {
                intent.redirectUrl = approveUrl;
                intent.nextAction = this.buildPaypalApproveAction(dto, approveUrl);
            }
        }

        // Si está completada, extraer info del capture
        if (dto.status === 'COMPLETED' && purchaseUnit?.payments?.captures?.[0]) {
            const capture = purchaseUnit.payments.captures[0];
            // Podríamos agregar metadata del capture aquí
            console.log(`[PaypalGateway] Capture ID: ${capture.id}, Status: ${capture.status}`);
        }

        return intent;
    }

    /**
     * Construye la acción de aprobación de PayPal.
     */
    private buildPaypalApproveAction(dto: PaypalOrderDto, approveUrl: string): NextActionPaypalApprove {
        return {
            type: 'paypal_approve',
            approveUrl,
            returnUrl: window.location.origin + '/payments/return',
            cancelUrl: window.location.origin + '/payments/cancel',
            paypalOrderId: dto.id,
        };
    }

    // ============ HELPERS ============

    /**
     * Construye el request en formato PayPal Orders API.
     */
    private buildPaypalCreateRequest(req: CreatePaymentRequest): PaypalCreateOrderRequest {
        return {
            intent: 'CAPTURE', // Captura inmediata (vs AUTHORIZE)
            purchase_units: [{
                reference_id: req.orderId,
                custom_id: req.orderId,
                description: `Orden ${req.orderId}`,
                amount: {
                    currency_code: req.currency,
                    // PayPal requiere strings con 2 decimales
                    value: req.amount.toFixed(2),
                },
            }],
            application_context: {
                brand_name: 'Payment Service',
                landing_page: 'LOGIN',
                user_action: 'PAY_NOW',
                return_url: `${window.location.origin}/payments/paypal/return`,
                cancel_url: `${window.location.origin}/payments/paypal/cancel`,
            },
        };
    }

    /**
     * Genera un ID único para idempotencia.
     */
    private generateRequestId(orderId: string, operation: string = 'create'): string {
        return `${orderId}-${operation}-${Date.now()}`;
    }

    /**
     * Type guard para errores de PayPal.
     */
    private isPaypalErrorResponse(err: unknown): err is PaypalErrorResponse {
        return err !== null &&
            typeof err === 'object' &&
            'name' in err &&
            'message' in err;
    }

    /**
     * Convierte errores de PayPal a mensajes legibles.
     */
    private humanizePaypalError(error: PaypalErrorResponse): string {
        const errorKeyMap: Record<string, string> = {
            'INVALID_REQUEST': 'errors.paypal_invalid_request',
            'PERMISSION_DENIED': 'errors.paypal_permission_denied',
            'RESOURCE_NOT_FOUND': 'errors.paypal_resource_not_found',
            'INSTRUMENT_DECLINED': 'errors.paypal_instrument_declined',
            'ORDER_NOT_APPROVED': 'errors.paypal_order_not_approved',
            'INTERNAL_SERVICE_ERROR': 'errors.paypal_internal_error',
        };

        // Buscar mensaje específico en details
        if (error.details?.length) {
            const detail = error.details[0];
            return detail.description || detail.issue || error.message;
        }

        const translationKey = errorKeyMap[error.name];
        if (translationKey) {
            return this.i18n.t(translationKey);
        }

        return error.message ?? this.i18n.t('errors.paypal_error');
    }
}