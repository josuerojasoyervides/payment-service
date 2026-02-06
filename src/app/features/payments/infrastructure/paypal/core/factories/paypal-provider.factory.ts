import { inject, Injectable } from '@angular/core';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { PaymentRequestBuilderPort } from '@app/features/payments/domain/subdomains/payment/ports/payment-request/payment-request-builder.port';
import { PaypalRedirectRequestBuilder } from '@app/features/payments/infrastructure/paypal/core/builders/paypal-redirect-request.builder';
import { PaypalRedirectStrategy } from '@app/features/payments/infrastructure/paypal/payment-methods/redirect/strategies/paypal-redirect.strategy';
import { PaypalIntentFacade } from '@app/features/payments/infrastructure/paypal/workflows/order/order.facade';
import { LoggerService } from '@core/logging';
import type { FieldRequirements } from '@payments/application/api/contracts/checkout-field-requirements.types';
import type { FinalizePort } from '@payments/application/api/ports/finalize.port';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type { PaymentStrategy } from '@payments/application/api/ports/payment-strategy.port';
import type { ProviderFactory } from '@payments/application/api/ports/provider-factory.port';
import { PAYMENTS_INFRA_CONFIG } from '@payments/infrastructure/config/payments-infra-config.token';
import { PaypalFinalizeHandler } from '@payments/infrastructure/paypal/workflows/redirect/handlers/paypal-finalize.handler';
import {
  PAYMENT_ERROR_KEYS,
  PAYMENT_MESSAGE_KEYS,
} from '@payments/shared/constants/payment-error-keys';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

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
  readonly providerId = PAYMENT_PROVIDER_IDS.paypal;

  private readonly gateway = inject(PaypalIntentFacade);
  private readonly logger = inject(LoggerService);
  private readonly finalizeHandler = inject(PaypalFinalizeHandler);
  private readonly infraConfig = inject(PAYMENTS_INFRA_CONFIG);
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
  createRequestBuilder(type: PaymentMethodType): PaymentRequestBuilderPort {
    this.assertSupported(type);

    return new PaypalRedirectRequestBuilder();
  }

  /**
   * Returns field requirements for PayPal.
   *
   * returnUrl/cancelUrl are supplied by StrategyContext (checkout); no hidden fields required.
   */
  getFieldRequirements(type: PaymentMethodType): FieldRequirements {
    this.assertSupported(type);

    return {
      descriptionKey: PAYMENT_MESSAGE_KEYS.PAY_WITH_PAYPAL,
      instructionsKey: PAYMENT_MESSAGE_KEYS.PAYPAL_REDIRECT_SECURE_MESSAGE,
      fields: [],
    };
  }

  /**
   * Optional capability: PayPal supports finalize (capture) in redirect flow.
   */
  getFinalizeHandler(): FinalizePort | null {
    return this.finalizeHandler;
  }

  getResilienceConfig() {
    return {
      circuitOpenCooldownMs: 30_000,
      rateLimitCooldownMs: 15_000,
    };
  }

  getDashboardUrl(intentId: string): string | null {
    if (!intentId) return null;
    return `https://www.paypal.com/activity/payment/${intentId}`;
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private assertSupported(type: PaymentMethodType): void {
    if (!this.supportsMethod(type)) {
      throw invalidRequestError(PAYMENT_ERROR_KEYS.INVALID_REQUEST, {
        reason: 'unsupported_payment_method',
        supportedMethods: PaypalProviderFactory.SUPPORTED_METHODS.join(', '),
      });
    }
  }

  private instantiateStrategy(type: PaymentMethodType): PaymentStrategy {
    switch (type) {
      case 'card':
        return new PaypalRedirectStrategy(
          this.gateway,
          this.logger,
          this.infraConfig.paypal.defaults,
        );
      default:
        throw invalidRequestError(PAYMENT_ERROR_KEYS.INVALID_REQUEST, {
          reason: 'unexpected_payment_method_type',
          type,
        });
    }
  }
}
