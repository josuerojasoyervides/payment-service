import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { intentRequiresUserAction } from '@app/features/payments/domain/subdomains/payment/policies/requires-user-action.policy';
import type { TokenValidator } from '@app/features/payments/domain/subdomains/payment/ports/token-validator/token-validator.port';
import {
  getCardMinAmount,
  validateCardAmount,
} from '@app/features/payments/domain/subdomains/payment/rules/min-amount-by-currency.rule';
import type { LoggerService } from '@core/logging';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type {
  PaymentStrategy,
  StrategyContext,
  StrategyPrepareResult,
} from '@payments/application/api/ports/payment-strategy.port';
import {
  PAYMENT_ERROR_KEYS,
  PAYMENT_MESSAGE_KEYS,
} from '@payments/shared/constants/payment-error-keys';
import { NoopTokenValidator } from '@payments/shared/token-validators/noop-token-validator';
import type { Observable } from 'rxjs';
import { map, tap } from 'rxjs';

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
    private readonly gateway: PaymentGatewayPort,
    private readonly tokenValidator: TokenValidator = new NoopTokenValidator(),
    private readonly logger: LoggerService,
  ) {}

  /**
   * Validates the request for card payments.
   *
   * Rules:
   * - Token is mandatory if provider requires it (delegated to TokenValidator)
   * - Minimum amount from domain rule (10 MXN / 1 USD)
   */
  validate(req: CreatePaymentRequest): void {
    if (this.tokenValidator.requiresToken()) {
      if (!req.method.token) {
        throw invalidRequestError(PAYMENT_ERROR_KEYS.CARD_TOKEN_REQUIRED);
      }
      this.tokenValidator.validate(req.method.token);
    }

    const violations = validateCardAmount(req.money);
    for (const v of violations) {
      if (v.code === 'CARD_AMOUNT_TOO_LOW') {
        const minAmount = getCardMinAmount(req.money.currency);
        throw invalidRequestError(PAYMENT_ERROR_KEYS.MIN_AMOUNT, {
          amount: minAmount,
          currency: req.money.currency,
        });
      }
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
    this.logger.info('Starting payment', 'CardStrategy', {
      orderId: req.orderId,
      amount: req.money.amount,
      currency: req.money.currency,
      tokenPrefix: req.method.token?.substring(0, 6),
      metadata,
    });

    return this.gateway.createIntent(preparedRequest).pipe(
      tap((intent) => {
        if (this.requiresUserAction(intent)) {
          this.logger.info('3DS required for intent', 'CardStrategy', {
            intentId: intent.id,
          });
        }
      }),
      map((intent) => this.enrichIntentWith3dsInfo(intent, context)),
    );
  }

  /**
   * Determines if the intent requires user action (3DS).
   */
  requiresUserAction(intent: PaymentIntent): boolean {
    return intentRequiresUserAction(intent) && intent.nextAction?.kind === 'client_confirm';
  }

  /**
   * Generates instructions for the user if 3DS is pending.
   */
  getUserInstructions(intent: PaymentIntent): string[] | null {
    if (!this.requiresUserAction(intent)) {
      return null;
    }

    return [PAYMENT_MESSAGE_KEYS.BANK_VERIFICATION_REQUIRED];
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
        kind: 'client_confirm',
        token: intent.clientSecret,
        returnUrl: context?.returnUrl ?? window.location.href,
      },
    };
  }
}
