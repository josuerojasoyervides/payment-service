import { inject, Injectable } from '@angular/core';
import { I18nKeys } from '@core/i18n';
import { LoggerService } from '@core/logging';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type { PaymentStrategy } from '@payments/application/api/ports/payment-strategy.port';
import type { ProviderFactory } from '@payments/application/api/ports/provider-factory.port';
import { invalidRequestError } from '@payments/domain/subdomains/payment/contracts/payment-error.factory';
import type { PaymentMethodType } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type {
  FieldRequirements,
  PaymentRequestBuilder,
} from '@payments/domain/subdomains/payment/ports/payment-request-builder.port';
import { StripeCardRequestBuilder } from '@payments/infrastructure/stripe/methods/card/builders/stripe-card-request.builder';
import { StripeSpeiRequestBuilder } from '@payments/infrastructure/stripe/methods/spei/builders/stripe-spei-request.builder';
import { StripeTokenValidator } from '@payments/infrastructure/stripe/validators/stripe-token.validator';
import { StripeIntentFacade } from '@payments/infrastructure/stripe/workflows/intent/facades/intent.facade';
import { CardStrategy } from '@payments/shared/strategies/card-strategy';
import { SpeiStrategy } from '@payments/shared/strategies/spei-strategy';

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
  readonly providerId = 'stripe' as const;

  private readonly gateway = inject(StripeIntentFacade);
  private readonly logger = inject(LoggerService);

  /**
   * Strategy cache to avoid recreating them.
   */
  private readonly strategyCache = new Map<PaymentMethodType, PaymentStrategy>();

  /**
   * Payment methods supported by Stripe.
   */
  static readonly SUPPORTED_METHODS: PaymentMethodType[] = ['card', 'spei'];

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
  createRequestBuilder(type: PaymentMethodType): PaymentRequestBuilder {
    this.assertSupported(type);

    switch (type) {
      case 'card':
        return new StripeCardRequestBuilder();
      case 'spei':
        return new StripeSpeiRequestBuilder();
      default:
        throw invalidRequestError(I18nKeys.errors.invalid_request, {
          reason: 'no_builder_for_payment_method',
          type,
        });
    }
  }

  /**
   * Returns field requirements for a payment method.
   *
   * The UI uses this to render the correct form.
   */
  getFieldRequirements(type: PaymentMethodType): FieldRequirements {
    this.assertSupported(type);

    switch (type) {
      case 'card':
        return {
          descriptionKey: 'ui.card_payment_description',
          instructionsKey: 'ui.enter_card_data',
          fields: [
            {
              name: 'token',
              labelKey: 'ui.card_token',
              required: true,
              type: 'hidden',
            },
            {
              name: 'saveForFuture',
              labelKey: 'ui.save_card_future',
              required: false,
              type: 'text',
              defaultValue: 'false',
            },
          ],
        };
      case 'spei':
        return {
          descriptionKey: 'ui.spei_bank_transfer',
          instructionsKey: 'ui.spei_email_instructions',
          fields: [
            {
              name: 'customerEmail',
              labelKey: 'ui.email_label',
              placeholderKey: 'ui.email_placeholder',
              required: true,
              type: 'email',
            },
          ],
        };

      default:
        return { fields: [] };
    }
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private assertSupported(type: PaymentMethodType): void {
    if (!this.supportsMethod(type)) {
      throw invalidRequestError(I18nKeys.errors.invalid_request, {
        reason: 'unsupported_payment_method',
        supportedMethods: StripeProviderFactory.SUPPORTED_METHODS.join(', '),
      });
    }
  }

  private instantiateStrategy(type: PaymentMethodType): PaymentStrategy {
    switch (type) {
      case 'card':
        return new CardStrategy(this.gateway, new StripeTokenValidator(), this.logger);
      case 'spei':
        return new SpeiStrategy(this.gateway, this.logger);
      default:
        throw invalidRequestError(I18nKeys.errors.invalid_request, {
          reason: 'unexpected_payment_method_type',
          type,
        });
    }
  }
}
