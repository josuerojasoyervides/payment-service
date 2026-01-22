import { inject } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import {
  PaymentIntent,
  PaymentMethodType,
  CreatePaymentRequest,
  NextActionPaypalApprove,
} from '../../../domain/models';
import {
  PaymentStrategy,
  StrategyContext,
  StrategyPrepareResult,
  PaymentGateway,
} from '../../../domain/ports';
import { findPaypalLink, PaypalOrderDto } from '../dto/paypal.dto';
import { I18nService, I18nKeys } from '@core/i18n';

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

  private static readonly DEFAULT_LANDING_PAGE = 'LOGIN';
  private static readonly DEFAULT_USER_ACTION = 'PAY_NOW';

  constructor(
    private readonly gateway: PaymentGateway,
    private readonly i18n: I18nService = inject(I18nService),
  ) {}

  /**
   * Validates the request for PayPal.
   *
   * PayPal has its own restrictions:
   * - Supported currencies: USD, MXN, EUR, etc.
   * - Minimum amounts vary by currency
   */
  validate(req: CreatePaymentRequest): void {
    const supportedCurrencies = ['USD', 'MXN', 'EUR', 'GBP', 'CAD', 'AUD'];

    if (!supportedCurrencies.includes(req.currency)) {
      throw new Error(
        `PayPal does not support ${req.currency}. ` +
          `Supported currencies: ${supportedCurrencies.join(', ')}`,
      );
    }

    const minAmounts: Record<string, number> = {
      USD: 1,
      MXN: 10,
      EUR: 1,
      GBP: 1,
      CAD: 1,
      AUD: 1,
    };

    const minAmount = minAmounts[req.currency] ?? 1;
    if (req.amount < minAmount) {
      throw new Error(`Minimum amount for PayPal in ${req.currency} is ${minAmount}`);
    }

    if (req.method.token) {
      console.warn('[PaypalRedirectStrategy] Token provided but PayPal uses its own checkout flow');
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
    // StrategyContext es la ÚNICA fuente de URLs para PayPal
    // No usar fallbacks defensivos - si falta returnUrl => error claro y temprano
    if (!context?.returnUrl) {
      throw new Error(
        'PayPal requires StrategyContext.returnUrl. ' +
          'It must be provided by CheckoutComponent when starting the payment.',
      );
    }

    const returnUrl = context.returnUrl;
    const cancelUrl = context.cancelUrl ?? returnUrl;

    const metadata: Record<string, unknown> = {
      payment_method_type: 'paypal_redirect',
      return_url: returnUrl,
      cancel_url: cancelUrl,
      landing_page: PaypalRedirectStrategy.DEFAULT_LANDING_PAGE,
      user_action: PaypalRedirectStrategy.DEFAULT_USER_ACTION,
      brand_name: 'Payment Service',
      timestamp: new Date().toISOString(),
      formatted_amount: req.amount.toFixed(2),
    };

    if (context?.deviceData) {
      metadata['paypal_client_metadata_id'] = this.generateClientMetadataId(context.deviceData);
    }

    return {
      preparedRequest: {
        ...req,
        method: { type: 'card' },
        // Asegurar que returnUrl y cancelUrl estén en el request
        returnUrl,
        cancelUrl,
      },
      metadata,
    };
  }

  /**
   * Starts the PayPal Checkout flow.
   *
   * Flow:
   * 1. Validates the request
   * 2. Prepares with return URLs
   * 3. Creates Order in PayPal via gateway
   * 4. Extracts approve URL from HATEOAS links
   * 5. Returns intent with nextAction of type paypal_approve
   */
  start(req: CreatePaymentRequest, context?: StrategyContext): Observable<PaymentIntent> {
    this.validate(req);

    const { preparedRequest, metadata } = this.prepare(req, context);

    console.log(`[PaypalRedirectStrategy] Creating PayPal order:`, {
      orderId: req.orderId,
      amount: req.amount,
      currency: req.currency,
      returnUrl: metadata['return_url'],
    });
    return this.gateway.createIntent(preparedRequest).pipe(
      tap((intent) => {
        console.log(`[PaypalRedirectStrategy] PayPal order created: ${intent.id}`);
      }),
      map((intent) => this.enrichIntentWithPaypalApproval(intent, metadata)),
    );
  }

  /**
   * PayPal always requires user action (approve in PayPal).
   */
  requiresUserAction(intent: PaymentIntent): boolean {
    return (
      intent.status === 'requires_action' ||
      intent.nextAction?.type === 'paypal_approve' ||
      intent.nextAction?.type === 'redirect'
    );
  }

  /**
   * Instructions for the user about PayPal flow.
   */
  getUserInstructions(intent: PaymentIntent): string | null {
    if (intent.status === 'succeeded') {
      return null;
    }

    return [
      this.i18n.t(I18nKeys.ui.paypal_redirect_secure_message),
      '',
      this.i18n.t(I18nKeys.ui.redirected_to_paypal),
    ].join('\n');
  }

  /**
   * Enriches the intent with PayPal approval information.
   */
  private enrichIntentWithPaypalApproval(
    intent: PaymentIntent,
    metadata: Record<string, unknown>,
  ): PaymentIntent {
    const approveUrl = this.extractApproveUrl(intent);

    if (!approveUrl) {
      console.error('[PaypalRedirectStrategy] No approve URL found in PayPal response');
      if (intent.redirectUrl) {
        return {
          ...intent,
          status: 'requires_action',
          nextAction: {
            type: 'redirect',
            url: intent.redirectUrl,
            returnUrl: metadata['return_url'] as string,
          },
        };
      }
      return intent;
    }

    const paypalAction: NextActionPaypalApprove = {
      type: 'paypal_approve',
      approveUrl,
      returnUrl: metadata['return_url'] as string,
      cancelUrl: metadata['cancel_url'] as string,
      paypalOrderId: intent.id,
    };

    return {
      ...intent,
      status: 'requires_action',
      nextAction: paypalAction,
      redirectUrl: approveUrl,
    };
  }

  /**
   * Extracts the approval URL from PayPal response.
   */
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

  /**
   * Generates a client metadata ID for PayPal Risk/Fraud.
   */
  private generateClientMetadataId(deviceData: NonNullable<StrategyContext['deviceData']>): string {
    const data = [
      deviceData.ipAddress ?? 'unknown',
      deviceData.userAgent ?? 'unknown',
      Date.now().toString(36),
    ].join('|');

    return btoa(data).substring(0, 32);
  }
}
