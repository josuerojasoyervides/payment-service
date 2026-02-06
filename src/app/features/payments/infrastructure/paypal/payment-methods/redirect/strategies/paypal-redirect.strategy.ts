import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { intentRequiresUserAction } from '@app/features/payments/domain/subdomains/payment/policies/requires-user-action.policy';
import type { PaypalOrderDto } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import { findPaypalLink } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import type { LoggerService } from '@core/logging';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type {
  PaymentStrategy,
  StrategyContext,
  StrategyPrepareResult,
} from '@payments/application/api/ports/payment-strategy.port';
import type { PaypalAppContextDefaults } from '@payments/infrastructure/config/payments-infra-config.types';
import { PAYPAL_CARD_VALIDATION_CONFIG } from '@payments/infrastructure/shared/validation/provider-validation.config';
import { validateAmount } from '@payments/infrastructure/shared/validation/validate-amount';
import {
  PAYMENT_ERROR_KEYS,
  PAYMENT_MESSAGE_KEYS,
} from '@payments/shared/constants/payment-error-keys';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { sanitizeForLogging } from '@payments/shared/logging/sanitize-for-logging.util';
import type { Observable } from 'rxjs';
import { map, tap } from 'rxjs';

/**
 * Redirect strategy for PayPal.
 *
 * PayPal uses a different flow than Stripe:
 * 1. An "Order" is created (not a PaymentIntent)
 * 2. User is redirected to PayPal to approve
 * 3. PayPal redirects back with token
 * 4. Payment is captured
 *
 * This strategy handles that complete flow.
 */
export class PaypalRedirectStrategy implements PaymentStrategy {
  readonly type: PaymentMethodType = 'card';

  constructor(
    private readonly gateway: PaymentGatewayPort,
    private readonly logger: LoggerService,
    private readonly defaults: PaypalAppContextDefaults,
  ) {}

  /**
   * Validates the request for PayPal.
   *
   * PayPal has its own restrictions:
   * - Supported currencies: USD, MXN, EUR, etc.
   * - Minimum amounts vary by currency
   */
  validate(req: CreatePaymentRequest): void {
    validateAmount(req.money, PAYPAL_CARD_VALIDATION_CONFIG);

    // Token is ignored in PayPal redirect flow (warn but do not fail)
    if (req.method?.token) {
      this.logger.warn(
        '[PaypalRedirectStrategy] Token provided but PayPal uses its own checkout flow',
        'PaypalRedirectStrategy',
        {
          hasToken: true,
        },
      );
    }
  }

  /**
   * Prepares the request for PayPal.
   *
   * PayPal requires:
   * - return_url and cancel_url mandatory
   * - Landing page and user action configuration
   * - Product/service description
   */
  prepare(req: CreatePaymentRequest, context?: StrategyContext): StrategyPrepareResult {
    // StrategyContext is the ONLY source of URLs for PayPal
    // Do not invent URLs - if returnUrl is missing, fail fast
    if (!context?.returnUrl) {
      throw invalidRequestError(
        PAYMENT_ERROR_KEYS.RETURN_URL_REQUIRED,
        { field: 'returnUrl', provider: PAYMENT_PROVIDER_IDS.paypal },
        { returnUrl: context?.returnUrl },
      );
    }

    const returnUrl = context.returnUrl;
    const cancelUrl = context.cancelUrl ?? returnUrl;

    const metadata: Record<string, unknown> = {
      payment_method_type: 'paypal_redirect',
      return_url: returnUrl,
      cancel_url: cancelUrl,
      landing_page: this.defaults.landing_page,
      user_action: this.defaults.user_action,
      brand_name: this.defaults.brand_name,
      timestamp: new Date().toISOString(),
      formatted_amount: req.money.amount.toFixed(2),
    };

    if (context?.deviceData) {
      metadata['paypal_client_metadata_id'] = this.generateClientMetadataId(context.deviceData);
    }

    return {
      preparedRequest: {
        ...req,
        // PayPal does not use client token, only needs type
        method: { type: 'card' },
        returnUrl,
        cancelUrl,
      },
      metadata,
    };
  }

  /**
   * Starts the PayPal Checkout flow.
   */
  start(req: CreatePaymentRequest, context?: StrategyContext): Observable<PaymentIntent> {
    this.validate(req);

    const { preparedRequest, metadata } = this.prepare(req, context);

    this.logger.warn(
      `[PaypalRedirectStrategy] Creating PayPal order:`,
      'PaypalRedirectStrategy',
      sanitizeForLogging({
        orderId: req.orderId,
        amount: req.money.amount,
        currency: req.money.currency,
        returnUrl: metadata['return_url'],
        cancelUrl: metadata['cancel_url'],
      }),
    );

    return this.gateway.createIntent(preparedRequest).pipe(
      tap((intent) => {
        this.logger.warn(
          `[PaypalRedirectStrategy] PayPal order created: ${intent.id}`,
          'PaypalRedirectStrategy',
          {
            intentId: intent.id,
          },
        );
      }),
      map((intent) => this.enrichIntentWithPaypalApproval(intent, metadata)),
    );
  }

  requiresUserAction(intent: PaymentIntent): boolean {
    return intentRequiresUserAction(intent) || intent.nextAction?.kind === 'redirect';
  }

  getUserInstructions(intent: PaymentIntent): string[] | null {
    if (intent.status === 'succeeded') {
      return null;
    }

    return [
      PAYMENT_MESSAGE_KEYS.PAYPAL_REDIRECT_SECURE_MESSAGE,
      PAYMENT_MESSAGE_KEYS.REDIRECTED_TO_PAYPAL,
    ];
  }

  /**
   * Enriches the intent with PayPal approval information.
   */
  private enrichIntentWithPaypalApproval(
    intent: PaymentIntent,
    _metadata: Record<string, unknown>,
  ): PaymentIntent {
    const approveUrl = this.extractApproveUrl(intent);

    if (!approveUrl) {
      this.logger.error(
        '[PaypalRedirectStrategy] No approve URL found in PayPal response',
        'PaypalRedirectStrategy',
        {
          intentId: intent.id,
        },
      );

      // Fallback: if intent already has redirectUrl, use it as a generic redirect
      if (intent.redirectUrl) {
        return {
          ...intent,
          status: 'requires_action',
          nextAction: {
            kind: 'redirect',
            url: intent.redirectUrl,
          },
        };
      }

      return intent;
    }

    return {
      ...intent,
      status: 'requires_action',
      nextAction: {
        kind: 'redirect',
        url: approveUrl,
      },
      redirectUrl: approveUrl,
    };
  }

  private extractApproveUrl(intent: PaymentIntent): string | null {
    const raw = intent.raw as PaypalOrderDto | undefined;

    if (raw?.links) {
      const approveLink = findPaypalLink(raw.links, 'approve');
      if (approveLink) return approveLink;

      const payerActionLink = findPaypalLink(raw.links, 'payer-action');
      if (payerActionLink) return payerActionLink;
    }

    if (intent.redirectUrl?.includes('paypal.com')) {
      return intent.redirectUrl;
    }

    return null;
  }

  private generateClientMetadataId(deviceData: NonNullable<StrategyContext['deviceData']>): string {
    const data = [
      deviceData.ipAddress ?? 'unknown',
      deviceData.userAgent ?? 'unknown',
      Date.now().toString(36),
    ].join('|');

    return btoa(data).substring(0, 32);
  }
}
