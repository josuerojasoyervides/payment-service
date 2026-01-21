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
import { I18nService, I18nKeys } from '@core/i18n';
import {
    PaypalOrderDto,
    PaypalOrderStatus,
    PaypalCreateOrderRequest,
    PaypalErrorResponse,
    findPaypalLink
} from '../dto/paypal.dto';
import { BasePaymentGateway } from '@payments/shared/base-payment.gateway';

/**
 * PayPal gateway (Orders API v2).
 *
 * Key differences vs Stripe:
 * - PayPal uses "Orders" instead of "PaymentIntents"
 * - Amounts as strings with 2 decimals ("100.00")
 * - Flow: Create Order → Approve (redirect) → Capture
 * - HATEOAS links for navigation
 * - No client_secret, uses session cookies
 */
@Injectable()
export class PaypalPaymentGateway extends BasePaymentGateway<PaypalOrderDto, PaypalOrderDto> {
    readonly providerId = 'paypal' as const;

    private static readonly API_BASE = '/api/payments/paypal';

    // PayPal status → internal status mapping
    private static readonly STATUS_MAP: Record<PaypalOrderStatus, PaymentIntentStatus> = {
        'CREATED': 'requires_action',
        'SAVED': 'requires_confirmation',
        'APPROVED': 'requires_confirmation',
        'VOIDED': 'canceled',
        'COMPLETED': 'succeeded',
        'PAYER_ACTION_REQUIRED': 'requires_action',
    };

    // PayPal errors → internal errors mapping
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
     * Creates an Order in PayPal.
     *
     * PayPal doesn't create an "intent" directly - it creates an Order
     * that the user must approve before it can be captured.
     */
    protected createIntentRaw(req: CreatePaymentRequest): Observable<PaypalOrderDto> {
        const paypalRequest = this.buildPaypalCreateRequest(req);

        return this.http.post<PaypalOrderDto>(
            `${PaypalPaymentGateway.API_BASE}/orders`,
            paypalRequest,
            {
                headers: {
                    'PayPal-Request-Id': this.generateRequestId(req.orderId),
                    'Prefer': 'return=representation',
                },
            }
        );
    }

    protected mapIntent(dto: PaypalOrderDto): PaymentIntent {
        return this.mapOrder(dto);
    }

    /**
     * Confirms (captures) an approved Order.
     *
     * In PayPal, "confirm" = "capture" - the final step after
     * the user approved in PayPal.
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
     * Cancels (voids) an Order.
     *
     * PayPal doesn't have a direct "cancel" endpoint for orders.
     * Only authorizations can be canceled. For unapproved orders,
     * they simply expire.
     */
    protected cancelIntentRaw(req: CancelPaymentRequest): Observable<PaypalOrderDto> {
        return this.http.post<PaypalOrderDto>(
            `${PaypalPaymentGateway.API_BASE}/orders/${req.intentId}/void`,
            {}
        );
    }

    protected mapCancelIntent(dto: PaypalOrderDto): PaymentIntent {
        return this.mapOrder(dto);
    }

    /**
     * Gets the current status of an Order.
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
     * Validation override: PayPal doesn't require token for card methods.
     * PayPal uses its own redirect flow.
     */
    protected override validateCreate(req: CreatePaymentRequest) {
        if (!req.orderId) throw new Error("orderId is required");
        if (!req.currency) throw new Error("currency is required");
        if (!Number.isFinite(req.amount) || req.amount <= 0) throw new Error("amount is invalid");
        if (!req.method?.type) throw new Error("payment method type is required");
    }

    /**
     * Normalizes PayPal errors to our format.
     */
    protected override normalizeError(err: unknown): PaymentError {
        if (this.isPaypalErrorResponse(err)) {
            return {
                code: PaypalPaymentGateway.ERROR_MAP[err.name] ?? 'provider_error',
                message: this.humanizePaypalError(err),
                raw: err,
            };
        }

        if (err && typeof err === 'object' && 'status' in err) {
            const httpError = err as { status: number };

            if (httpError.status === 401) {
                return {
                    code: 'provider_error',
                    message: this.i18n.t(I18nKeys.errors.paypal_auth_error),
                    raw: err,
                };
            }

            if (httpError.status >= 500) {
                return {
                    code: 'provider_unavailable',
                    message: this.i18n.t(I18nKeys.errors.paypal_unavailable),
                    raw: err,
                };
            }
        }

        return super.normalizeError(err);
    }

    // ============ PRIVATE MAPPING ============

    /**
     * Maps a PayPal Order to our PaymentIntent model.
     */
    private mapOrder(dto: PaypalOrderDto): PaymentIntent {
        const status = PaypalPaymentGateway.STATUS_MAP[dto.status] ?? 'processing';
        const purchaseUnit = dto.purchase_units[0];

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

        if (dto.status === 'CREATED' || dto.status === 'PAYER_ACTION_REQUIRED') {
            const approveUrl = findPaypalLink(dto.links, 'approve');
            if (approveUrl) {
                intent.redirectUrl = approveUrl;
                // No construir nextAction aquí - PaypalRedirectStrategy.enrichIntentWithPaypalApproval
                // lo construirá con las URLs correctas desde StrategyContext (metadata)
                // Si necesitamos construir aquí, requeriríamos acceso al request original con returnUrl/cancelUrl
            }
        }

        if (dto.status === 'COMPLETED' && purchaseUnit?.payments?.captures?.[0]) {
            const capture = purchaseUnit.payments.captures[0];
            console.log(`[PaypalGateway] Capture ID: ${capture.id}, Status: ${capture.status}`);
        }

        return intent;
    }

    /**
     * Builds PayPal approval action.
     * 
     * Note: This method is called from mapOrder which doesn't have access to the original request.
     * However, PaypalRedirectStrategy.enrichIntentWithPaypalApproval already sets the correct URLs
     * from StrategyContext. This method should ideally not be used, as the strategy enriches the intent.
     * 
     * If called, returnUrl/cancelUrl MUST be provided - no fallbacks allowed.
     * The system must guarantee these URLs come from StrategyContext.
     */
    private buildPaypalApproveAction(dto: PaypalOrderDto, approveUrl: string, returnUrl?: string, cancelUrl?: string): NextActionPaypalApprove {
        // No inventar URLs - deben venir del request preparado
        // Si no están disponibles, lanzar error claro
        if (!returnUrl) {
            throw new Error(
                'returnUrl is required for PayPal approval action. ' +
                'PaypalRedirectStrategy.enrichIntentWithPaypalApproval should set nextAction with URLs from StrategyContext. ' +
                'If this method is called, returnUrl must be provided explicitly.'
            );
        }

        return {
            type: 'paypal_approve',
            approveUrl,
            returnUrl,
            cancelUrl: cancelUrl ?? returnUrl,
            paypalOrderId: dto.id,
        };
    }

    // ============ HELPERS ============

    /**
     * Builds the request in PayPal Orders API format.
     */
    private buildPaypalCreateRequest(req: CreatePaymentRequest): PaypalCreateOrderRequest {
        // returnUrl/cancelUrl deben venir del request preparado (PaypalRedirectStrategy.prepare)
        // que usa StrategyContext como ÚNICA fuente
        // El builder/strategy deben garantizar que returnUrl esté presente
        // Si no está => error claro (no inventar URLs)
        if (!req.returnUrl) {
            throw new Error(
                'returnUrl is required for PayPal orders. ' +
                'PaypalRedirectStrategy.prepare() must set returnUrl from StrategyContext. ' +
                'Check that CheckoutComponent provides StrategyContext.returnUrl when starting payment.'
            );
        }

        const returnUrl = req.returnUrl;
        const cancelUrl = req.cancelUrl ?? returnUrl;

        return {
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: req.orderId,
                custom_id: req.orderId,
                description: `Orden ${req.orderId}`,
                amount: {
                    currency_code: req.currency,
                    value: req.amount.toFixed(2),
                },
            }],
            application_context: {
                brand_name: 'Payment Service',
                landing_page: 'LOGIN',
                user_action: 'PAY_NOW',
                return_url: returnUrl,
                cancel_url: cancelUrl,
            },
        };
    }

    /**
     * Generates a unique ID for idempotency.
     */
    private generateRequestId(orderId: string, operation: string = 'create'): string {
        return `${orderId}-${operation}-${Date.now()}`;
    }

    /**
     * Type guard for PayPal errors.
     */
    private isPaypalErrorResponse(err: unknown): err is PaypalErrorResponse {
        return err !== null &&
            typeof err === 'object' &&
            'name' in err &&
            'message' in err;
    }

    /**
     * Converts PayPal errors to readable messages.
     */
    private humanizePaypalError(error: PaypalErrorResponse): string {
        const errorKeyMap: Partial<Record<string, string>> = {
            'INVALID_REQUEST': I18nKeys.errors.paypal_invalid_request,
            'PERMISSION_DENIED': I18nKeys.errors.paypal_permission_denied,
            'RESOURCE_NOT_FOUND': I18nKeys.errors.paypal_resource_not_found,
            'INSTRUMENT_DECLINED': I18nKeys.errors.paypal_instrument_declined,
            'ORDER_NOT_APPROVED': I18nKeys.errors.paypal_order_not_approved,
            'INTERNAL_SERVICE_ERROR': I18nKeys.errors.paypal_internal_error,
        };

        if (error.details?.length) {
            const detail = error.details[0];
            return detail.description || detail.issue || error.message;
        }

        const translationKey = errorKeyMap[error.name];
        if (translationKey) {
            return this.i18n.t(translationKey);
        }

        return error.message ?? this.i18n.t(I18nKeys.errors.paypal_error);
    }
}