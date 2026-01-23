import { inject, Injectable } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';

import { PaymentMethodType } from '../../../domain/models';
import {
  FieldRequirements,
  PaymentGateway,
  PaymentRequestBuilder,
  PaymentStrategy,
  ProviderFactory,
} from '../../../domain/ports';
import { CardStrategy } from '../../../shared/strategies/card-strategy';
import { SpeiStrategy } from '../../../shared/strategies/spei-strategy';
import { StripeCardRequestBuilder } from '../builders/stripe-card-request.builder';
import { StripeSpeiRequestBuilder } from '../builders/stripe-spei-request.builder';
import { IntentFacade } from '../gateways/intent/intent.facade';
import { StripeTokenValidator } from '../validators/stripe-token.validator';

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

  private readonly gateway = inject(IntentFacade);
  private readonly i18n = inject(I18nService);

  /**
   * Strategy cache to avoid recreating them.
   */
  private readonly strategyCache = new Map<PaymentMethodType, PaymentStrategy>();

  /**
   * Payment methods supported by Stripe.
   */
  static readonly SUPPORTED_METHODS: PaymentMethodType[] = ['card', 'spei'];

  getGateway(): PaymentGateway {
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
        throw new Error(`No builder for payment method: ${type}`);
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
          description: this.i18n.t(I18nKeys.ui.card_payment_description),
          instructions: this.i18n.t(I18nKeys.ui.enter_card_data),
          fields: [
            {
              name: 'token',
              label: this.i18n.t(I18nKeys.ui.card_token),
              required: true,
              type: 'hidden',
              placeholder: '',
            },
            {
              name: 'saveForFuture',
              label: this.i18n.t(I18nKeys.ui.save_card_future),
              required: false,
              type: 'text',
              defaultValue: 'false',
            },
          ],
        };
      case 'spei':
        return {
          description: this.i18n.t(I18nKeys.ui.spei_bank_transfer),
          instructions: this.i18n.t(I18nKeys.ui.spei_email_instructions),
          fields: [
            {
              name: 'customerEmail',
              label: this.i18n.t(I18nKeys.ui.email_label),
              required: true,
              type: 'email',
              placeholder: 'tu@email.com',
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
      throw new Error(
        `Payment method "${type}" is not supported by Stripe. ` +
          `Supported methods: ${StripeProviderFactory.SUPPORTED_METHODS.join(', ')}`,
      );
    }
  }

  private instantiateStrategy(type: PaymentMethodType): PaymentStrategy {
    switch (type) {
      case 'card':
        return new CardStrategy(this.gateway, new StripeTokenValidator(), this.i18n);
      case 'spei':
        return new SpeiStrategy(this.gateway, this.i18n);
      default:
        throw new Error(`Unexpected payment method type: ${type}`);
    }
  }
}
