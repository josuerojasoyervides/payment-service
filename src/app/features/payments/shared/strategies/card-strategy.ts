import { inject } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';
import {
  PaymentIntent,
  PaymentMethodType,
} from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import {
  NullTokenValidator,
  TokenValidator,
} from '@payments/domain/ports/provider/token-validator.port';
import { map, Observable, tap } from 'rxjs';

import { PaymentGateway } from '../../domain/ports/payment/payment-gateway.port';
import {
  PaymentStrategy,
  StrategyContext,
  StrategyPrepareResult,
} from '../../domain/ports/payment/payment-strategy.port';

/**
 * Strategy for credit/debit card payments.
 *
 * Features:
 * - Token validation delegated to provider's TokenValidator
 * - Support for 3D Secure (additional authentication)
 * - Handling of saved vs tokenized cards
 * - Device metadata for fraud prevention
 *
 * This strategy is shared between providers, but token validation
 * is specific to each one thanks to the injected TokenValidator.
 */
export class CardStrategy implements PaymentStrategy {
  readonly type: PaymentMethodType = 'card';

  /** Generic pattern to detect saved cards (PaymentMethod) */
  private static readonly SAVED_CARD_PATTERN = /^pm_[a-zA-Z0-9]+$/;

  constructor(
    private readonly gateway: PaymentGateway,
    private readonly tokenValidator: TokenValidator = new NullTokenValidator(),
    private readonly i18n: I18nService = inject(I18nService),
  ) {}

  /**
   * Validates the request for card payments.
   *
   * Rules:
   * - Token is mandatory if provider requires it (delegated to TokenValidator)
   * - Minimum amount of 10 MXN / 1 USD
   */
  validate(req: CreatePaymentRequest): void {
    if (this.tokenValidator.requiresToken()) {
      if (!req.method.token) {
        throw new Error(this.i18n.t(I18nKeys.errors.card_token_required));
      }
      this.tokenValidator.validate(req.method.token);
    }

    const minAmount = req.currency === 'MXN' ? 10 : 1;
    if (req.amount < minAmount) {
      throw new Error(
        this.i18n.t(I18nKeys.errors.min_amount, { amount: minAmount, currency: req.currency }),
      );
    }
  }

  /**
   * Prepares the request for the gateway.
   *
   * Enrichments:
   * - Adds device metadata for fraud prevention
   * - Detects if it's a saved card to apply SCA
   * - Configures return_url for 3DS
   */
  prepare(req: CreatePaymentRequest, context?: StrategyContext): StrategyPrepareResult {
    const isSavedCard = CardStrategy.SAVED_CARD_PATTERN.test(req.method.token!);

    const metadata: Record<string, unknown> = {
      payment_method_type: 'card',
      is_saved_card: isSavedCard,
      requires_sca: isSavedCard,
      timestamp: new Date().toISOString(),
    };

    if (context?.deviceData) {
      metadata['device_ip'] = context.deviceData.ipAddress;
      metadata['device_user_agent'] = context.deviceData.userAgent;
      metadata['device_screen'] =
        context.deviceData.screenWidth && context.deviceData.screenHeight
          ? `${context.deviceData.screenWidth}x${context.deviceData.screenHeight}`
          : undefined;
    }

    if (context?.returnUrl) {
      metadata['return_url'] = context.returnUrl;
    }

    return {
      preparedRequest: {
        ...req,
      },
      metadata,
    };
  }

  /**
   * Starts the card payment flow.
   *
   * Flow:
   * 1. Validates the request
   * 2. Prepares metadata and enrichments
   * 3. Creates intent in gateway
   * 4. Detects if 3DS is required
   */
  start(req: CreatePaymentRequest, context?: StrategyContext): Observable<PaymentIntent> {
    this.validate(req);

    const { preparedRequest, metadata } = this.prepare(req, context);
    console.log(`[CardStrategy] Starting payment:`, {
      orderId: req.orderId,
      amount: req.amount,
      currency: req.currency,
      tokenPrefix: req.method.token?.substring(0, 6),
      metadata,
    });

    return this.gateway.createIntent(preparedRequest).pipe(
      tap((intent) => {
        if (this.requiresUserAction(intent)) {
          console.log(`[CardStrategy] 3DS required for intent ${intent.id}`);
        }
      }),
      map((intent) => this.enrichIntentWith3dsInfo(intent, context)),
    );
  }

  /**
   * Determines if the intent requires user action (3DS).
   */
  requiresUserAction(intent: PaymentIntent): boolean {
    return intent.status === 'requires_action' && intent.nextAction?.type === '3ds';
  }

  /**
   * Generates instructions for the user if 3DS is pending.
   */
  getUserInstructions(intent: PaymentIntent): string | null {
    if (!this.requiresUserAction(intent)) {
      return null;
    }

    return this.i18n.t(I18nKeys.messages.bank_verification_required);
  }

  /**
   * Enriches the intent with 3DS information if applicable.
   */
  private enrichIntentWith3dsInfo(intent: PaymentIntent, context?: StrategyContext): PaymentIntent {
    if (intent.status !== 'requires_action' || !intent.clientSecret) {
      return intent;
    }

    return {
      ...intent,
      nextAction: {
        type: '3ds',
        clientSecret: intent.clientSecret,
        returnUrl: context?.returnUrl ?? window.location.href,
        threeDsVersion: '2.0',
      },
    };
  }
}
