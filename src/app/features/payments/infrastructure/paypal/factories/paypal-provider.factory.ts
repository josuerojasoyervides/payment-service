import { inject, Injectable } from '@angular/core';
import { I18nKeys } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import { ProviderFactory } from '@payments/application/api/ports/provider-factory.port';
import { invalidRequestError } from '@payments/domain/models/payment/payment-error.factory';
import { PaymentMethodType } from '@payments/domain/models/payment/payment-intent.types';

import { FinalizePort } from '../../../application/api/ports/finalize.port';
import { PaymentStrategy } from '../../../application/api/ports/payment-strategy.port';
import {
  FieldRequirements,
  PaymentRequestBuilder,
} from '../../../domain/ports/payment/payment-request-builder.port';
import { PaypalRedirectRequestBuilder } from '../builders/paypal-redirect-request.builder';
import { PaypalIntentFacade } from '../facades/intent.facade';
import { PaypalFinalizeHandler } from '../handlers/paypal-finalize.handler';
import { PaypalRedirectStrategy } from '../strategies/paypal-redirect.strategy';

/**
 * PayPal provider factory.
 *
 * Key differences vs Stripe:
 * - PayPal handles cards through its checkout (redirect)
 * - Does not support SPEI (only PayPal payment methods)
 * - All methods use redirect flow
 * - ALWAYS requires returnUrl and cancelUrl
 *
 * Supported methods:
 * - card: Cards via PayPal checkout (with redirect)
 */
@Injectable()
export class PaypalProviderFactory implements ProviderFactory {
  readonly providerId = 'paypal' as const;

  private readonly gateway = inject(PaypalIntentFacade);
  private readonly logger = inject(LoggerService);
  private readonly finalizeHandler = inject(PaypalFinalizeHandler);
  /**
   * Strategy cache.
   */
  private readonly strategyCache = new Map<PaymentMethodType, PaymentStrategy>();

  /**
   * Payment methods supported by PayPal.
   */
  static readonly SUPPORTED_METHODS: PaymentMethodType[] = ['card'];

  getGateway(): PaymentGatewayPort {
    return this.gateway;
  }

  createStrategy(type: PaymentMethodType): PaymentStrategy {
    this.assertSupported(type);

    const cached = this.strategyCache.get(type);
    if (cached) {
      return cached;
    }

    const strategy = this.instantiateStrategy(type);
    this.strategyCache.set(type, strategy);

    return strategy;
  }

  supportsMethod(type: PaymentMethodType): boolean {
    return PaypalProviderFactory.SUPPORTED_METHODS.includes(type);
  }

  getSupportedMethods(): PaymentMethodType[] {
    return [...PaypalProviderFactory.SUPPORTED_METHODS];
  }

  // ============================================================
  // BUILDER METHODS
  // ============================================================

  /**
   * Creates a builder specific to PayPal.
   *
   * PayPal ALWAYS uses redirect flow, so all methods
   * use the same builder that requires returnUrl.
   */
  createRequestBuilder(type: PaymentMethodType): PaymentRequestBuilder {
    this.assertSupported(type);

    return new PaypalRedirectRequestBuilder();
  }

  /**
   * Returns field requirements for PayPal.
   *
   * PayPal always needs redirect URLs.
   */
  getFieldRequirements(type: PaymentMethodType): FieldRequirements {
    this.assertSupported(type);

    return {
      descriptionKey: I18nKeys.ui.pay_with_paypal,
      instructionsKey: I18nKeys.ui.paypal_redirect_secure_message,
      fields: [
        {
          name: 'returnUrl',
          labelKey: I18nKeys.ui.return_url_label,
          required: true,
          type: 'hidden',
          autoComplete: 'current-url',
        },
        {
          name: 'cancelUrl',
          labelKey: I18nKeys.ui.cancel_url_label,
          required: false,
          type: 'hidden',
          autoComplete: 'current-url',
        },
      ],
    };
  }

  /**
   * Optional capability: PayPal supports finalize (capture) in redirect flow.
   */
  getFinalizeHandler(): FinalizePort | null {
    return this.finalizeHandler;
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private assertSupported(type: PaymentMethodType): void {
    if (!this.supportsMethod(type)) {
      throw invalidRequestError(I18nKeys.errors.invalid_request, {
        reason: 'unsupported_payment_method',
        supportedMethods: PaypalProviderFactory.SUPPORTED_METHODS.join(', '),
      });
    }
  }

  private instantiateStrategy(type: PaymentMethodType): PaymentStrategy {
    switch (type) {
      case 'card':
        return new PaypalRedirectStrategy(this.gateway, this.logger);
      default:
        throw invalidRequestError(I18nKeys.errors.invalid_request, {
          reason: 'unexpected_payment_method_type',
          type,
        });
    }
  }
}
