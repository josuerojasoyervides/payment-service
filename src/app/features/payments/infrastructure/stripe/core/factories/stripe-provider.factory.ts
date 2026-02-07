import { inject, Injectable } from '@angular/core';
import type { ProviderResilienceConfig } from '@app/features/payments/application/api/contracts/resilience.types';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { PaymentRequestBuilderPort } from '@app/features/payments/domain/subdomains/payment/ports/payment-request/payment-request-builder.port';
import {
  STRIPE_CARD_FIELD_REQUIREMENTS,
  STRIPE_SPEI_FIELD_REQUIREMENTS,
} from '@app/features/payments/infrastructure/stripe/config/field-requirements.config';
import { STRIPE_RESILIENCE_CONFIG } from '@app/features/payments/infrastructure/stripe/config/resillience.config';
import {
  CARD_RAW_KEYS,
  SPEI_RAW_KEYS,
} from '@app/features/payments/infrastructure/stripe/shared/constants/raw-keys.constants';
import { StripeTokenValidatorPolicy } from '@app/features/payments/infrastructure/stripe/shared/policies/stripe-token-validator.policy';
import { StripeIntentFacade } from '@app/features/payments/infrastructure/stripe/workflows/intent/intent.facade';
import { LoggerService } from '@core/logging';
import type { FieldRequirements } from '@payments/application/api/contracts/checkout-field-requirements.types';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type { PaymentStrategy } from '@payments/application/api/ports/payment-strategy.port';
import type { ProviderFactory } from '@payments/application/api/ports/provider-factory.port';
import { PAYMENTS_INFRA_CONFIG } from '@payments/infrastructure/config/payments-infra-config.token';
import {
  STRIPE_CARD_VALIDATION_CONFIG,
  STRIPE_SPEI_VALIDATION_CONFIG,
} from '@payments/infrastructure/shared/validation/provider-validation.config';
import { validateAmount } from '@payments/infrastructure/shared/validation/validate-amount';
import { StripeCardRequestBuilder } from '@payments/infrastructure/stripe/payment-methods/card/builders/stripe-card-request.builder';
import { StripeSpeiRequestBuilder } from '@payments/infrastructure/stripe/payment-methods/spei/builders/stripe-spei-request.builder';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { CardStrategy } from '@payments/shared/strategies/card-strategy';
import { SpeiStrategy } from '@payments/shared/strategies/spei-strategy';
import { match } from 'ts-pattern';

/**
 * Stripe provider factory.
 *
 * Responsibilities:
 * - Provide Stripe gateway
 * - Create Stripe-specific strategies
 * - Provide builders for each payment method
 * - Expose field requirements for UI
 *
 * Supported payment methods:
 * - card: Credit/debit cards with 3DS support
 * - spei: SPEI transfers (Mexico)
 */
@Injectable()
export class StripeProviderFactory implements ProviderFactory {
  readonly providerId: PaymentProviderId = PAYMENT_PROVIDER_IDS.stripe;

  private readonly gateway = inject(StripeIntentFacade);
  private readonly logger = inject(LoggerService);
  private readonly infraConfig = inject(PAYMENTS_INFRA_CONFIG);

  /**
   * Strategy cache to avoid recreating them.
   */
  private readonly strategyCache = new Map<PaymentMethodType, PaymentStrategy>();

  /**
   * Payment methods supported by Stripe.
   */
  static readonly SUPPORTED_METHODS: PaymentMethodType[] = [CARD_RAW_KEYS.CARD, SPEI_RAW_KEYS.SPEI];

  getGateway(): PaymentGatewayPort {
    return this.gateway;
  }

  /**
   * Creates or returns a cached strategy for the payment type.
   */
  createStrategy(type: PaymentMethodType): PaymentStrategy {
    this.assertSupported(type);

    const cached = this.strategyCache.get(type);
    if (cached) return cached;

    const strategy = this.instantiateStrategy(type);
    this.strategyCache.set(type, strategy);

    return strategy;
  }

  supportsMethod(type: PaymentMethodType): boolean {
    return StripeProviderFactory.SUPPORTED_METHODS.includes(type);
  }

  getSupportedMethods(): PaymentMethodType[] {
    return [...StripeProviderFactory.SUPPORTED_METHODS];
  }

  // ============================================================
  // BUILDER METHODS
  // ============================================================

  /**
   * Creates a builder specific to the payment method.
   *
   * The UI uses this to build the request with the correct fields.
   * Each builder knows what fields it needs and validates on build().
   */
  createRequestBuilder(type: PaymentMethodType): PaymentRequestBuilderPort {
    this.assertSupported(type);

    return match(type)
      .with(CARD_RAW_KEYS.CARD, () => new StripeCardRequestBuilder())
      .with(SPEI_RAW_KEYS.SPEI, () => new StripeSpeiRequestBuilder())
      .otherwise(() => {
        throw invalidRequestError(PAYMENT_ERROR_KEYS.INVALID_REQUEST, {
          reason: 'no_builder_for_payment_method',
          type,
        });
      });
  }

  /**
   * Returns field requirements for a payment method.
   *
   * The UI uses this to render the correct form.
   */
  getFieldRequirements(type: PaymentMethodType): FieldRequirements {
    this.assertSupported(type);

    return match(type)
      .with('card', () => STRIPE_CARD_FIELD_REQUIREMENTS)
      .with('spei', () => STRIPE_SPEI_FIELD_REQUIREMENTS)
      .exhaustive();
  }

  getResilienceConfig(): ProviderResilienceConfig {
    return STRIPE_RESILIENCE_CONFIG;
  }

  getDashboardUrl(intentId: string): string | null {
    if (!intentId) return null;
    return `https://dashboard.stripe.com/payments/${intentId}`;
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private assertSupported(type: PaymentMethodType): void {
    if (!this.supportsMethod(type)) {
      throw invalidRequestError(PAYMENT_ERROR_KEYS.INVALID_REQUEST, {
        reason: 'unsupported_payment_method',
        supportedMethods: StripeProviderFactory.SUPPORTED_METHODS.join(', '),
      });
    }
  }

  private instantiateStrategy(type: PaymentMethodType): PaymentStrategy {
    return match(type)
      .with(
        CARD_RAW_KEYS.CARD,
        () =>
          new CardStrategy(this.gateway, new StripeTokenValidatorPolicy(), this.logger, (money) =>
            validateAmount(money, STRIPE_CARD_VALIDATION_CONFIG),
          ),
      )
      .with(
        SPEI_RAW_KEYS.SPEI,
        () =>
          new SpeiStrategy(
            this.gateway,
            this.logger,
            this.infraConfig.spei.displayConfig,
            (money) => validateAmount(money, STRIPE_SPEI_VALIDATION_CONFIG),
          ),
      )
      .otherwise(() => {
        throw invalidRequestError(PAYMENT_ERROR_KEYS.INVALID_REQUEST, {
          reason: 'unexpected_payment_method_type',
          type,
        });
      });
  }
}
