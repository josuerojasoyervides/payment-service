import { Injectable } from '@angular/core';
import { I18nKeys } from '@core/i18n';
import { BasePaymentGateway } from '@payments/application/ports/base-payment-gateway.port';
import { invalidRequestError } from '@payments/domain/models/payment/payment-error.factory';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { PaypalCreateOrderRequest, PaypalErrorResponse, PaypalOrderDto } from '../dto/paypal.dto';
import { ERROR_MAP } from '../mappers/error.mapper';
import { mapOrder } from '../mappers/map-order.mapper';

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
export class PaypalIntentFacade extends BasePaymentGateway<PaypalOrderDto, PaypalOrderDto> {
  readonly providerId = 'paypal' as const;

  private static readonly API_BASE = '/api/payments/paypal';

  /**
   * Creates an Order in PayPal.
   *
   * PayPal doesn't create an "intent" directly - it creates an Order
   * that the user must approve before it can be captured.
   */
  protected createIntentRaw(req: CreatePaymentRequest): Observable<PaypalOrderDto> {
    const paypalRequest = this.buildPaypalCreateRequest(req);

    return this.http.post<PaypalOrderDto>(`${PaypalIntentFacade.API_BASE}/orders`, paypalRequest, {
      headers: {
        'PayPal-Request-Id': this.generateRequestId(req.orderId),
        Prefer: 'return=representation',
      },
    });
  }
  protected mapIntent(dto: PaypalOrderDto): PaymentIntent {
    return mapOrder(dto, this.providerId);
  }

  /**
   * Confirms (captures) an approved Order.
   *
   * In PayPal, "confirm" = "capture" - the final step after
   * the user approved in PayPal.
   */
  protected confirmIntentRaw(req: ConfirmPaymentRequest): Observable<PaypalOrderDto> {
    return this.http.post<PaypalOrderDto>(
      `${PaypalIntentFacade.API_BASE}/orders/${req.intentId}/capture`,
      {},
      {
        headers: {
          'PayPal-Request-Id': this.generateRequestId(req.intentId, 'capture'),
        },
      },
    );
  }
  protected mapConfirmIntent(dto: PaypalOrderDto): PaymentIntent {
    return mapOrder(dto, this.providerId);
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
      `${PaypalIntentFacade.API_BASE}/orders/${req.intentId}/void`,
      {},
    );
  }
  protected mapCancelIntent(dto: PaypalOrderDto): PaymentIntent {
    return mapOrder(dto, this.providerId);
  }

  /**
   * Gets the current status of an Order.
   */
  protected getIntentRaw(req: GetPaymentStatusRequest): Observable<PaypalOrderDto> {
    return this.http.get<PaypalOrderDto>(`${PaypalIntentFacade.API_BASE}/orders/${req.intentId}`);
  }
  protected mapGetIntent(dto: PaypalOrderDto): PaymentIntent {
    return mapOrder(dto, this.providerId);
  }

  /**
   * Validation override: PayPal doesn't require token for card methods.
   * PayPal uses its own redirect flow.
   */
  protected override validateCreate(req: CreatePaymentRequest) {
    if (!req.orderId) throw invalidRequestError('errors.order_id_required', { field: 'orderId' });
    if (!req.currency) throw invalidRequestError('errors.currency_required', { field: 'currency' });
    if (!Number.isFinite(req.amount) || req.amount <= 0)
      throw invalidRequestError('errors.amount_invalid', { field: 'amount' });
    if (!req.method?.type)
      throw invalidRequestError('errors.payment_method_type_required', { field: 'method.type' });
  }

  /**
   * Normalizes PayPal errors to our format.
   */
  protected override normalizeError(err: unknown): PaymentError {
    if (this.isPaypalErrorResponse(err)) {
      const code = ERROR_MAP[err.name] ?? 'provider_error';

      return {
        code,
        messageKey: I18nKeys.errors.paypal_error,
        params: {
          reason: err.name, // opcional, por si UI quiere mostrarlo o logs
        },
        raw: err,
      };
    }

    if (err && typeof err === 'object' && 'status' in err) {
      const httpError = err as { status: number };

      if (httpError.status === 401) {
        return {
          code: 'provider_error',
          messageKey: I18nKeys.errors.paypal_auth_error,
          raw: err,
        };
      }

      if (httpError.status >= 500) {
        return {
          code: 'provider_unavailable',
          messageKey: I18nKeys.errors.paypal_unavailable,
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
          'Check that CheckoutComponent provides StrategyContext.returnUrl when starting payment.',
      );
    }

    const returnUrl = req.returnUrl;
    const cancelUrl = req.cancelUrl ?? returnUrl;

    return {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: req.orderId,
          custom_id: req.orderId,
          description: `Orden ${req.orderId}`,
          amount: {
            currency_code: req.currency,
            value: req.amount.toFixed(2),
          },
        },
      ],
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
  private generateRequestId(orderId: string, operation = 'create'): string {
    return `${orderId}-${operation}-${Date.now()}`;
  }

  /**
   * Type guard for PayPal errors.
   */
  private isPaypalErrorResponse(err: unknown): err is PaypalErrorResponse {
    return err !== null && typeof err === 'object' && 'name' in err && 'message' in err;
  }
}
